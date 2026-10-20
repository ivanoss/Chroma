// Version autonome : remplace client/js/api.js quand Chroma tourne sans serveur.
//
// Mêmes fonctions et mêmes réponses que l'API REST, mais tout se passe dans le
// navigateur : le moteur et les bots sont ceux du serveur (server/moteur, server/bots),
// et les parties sont enregistrées dans le localStorage de cet appareil.
//
// Attention : ici, le navigateur est l'autorité sur la partie. C'est très bien pour
// jouer hors ligne ou faire une démo, mais ce n'est pas l'architecture du projet :
// la version avec serveur reste la référence (pas de triche possible, vrais comptes,
// classement partagé).
import { creerPartie, appliquerAction, vuePublique, calculerRangs, CoupIllegal } from '../server/moteur/moteur.js';
import { creerAleatoire, nouvelleGraine } from '../server/moteur/aleatoire.js';
import { carteParId, estJoker, PAQUET_REFERENCE } from '../server/moteur/cartes.js';
import { choisirActionBot, DIFFICULTES } from '../server/bots/index.js';
import { reconstruirePartie } from '../server/moteur/rejeu.js';
import { obtenirSession, ouvrirSession } from '../client/js/session.js';

export class ErreurApi extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}

const NOMS_BOTS = ['Ambre', 'Céleste', 'Indigo'];
const HUMAIN = 0;
const CLE = 'chroma.autonome';

// ---------------------------------------------------------------- stockage

let donnees = null;

function charger() {
  if (donnees) return donnees;
  try {
    donnees = JSON.parse(localStorage.getItem(CLE));
  } catch {
    donnees = null;
  }
  if (!donnees || donnees.version !== 1) donnees = { version: 1, prochainId: 1, joueurs: {}, parties: [] };
  return donnees;
}

function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify(donnees));
  } catch {
    // Stockage indisponible (navigation privée...) : la partie reste en mémoire jusqu'à la fermeture.
  }
}

const copie = (x) => structuredClone(x);

function joueurConnecte() {
  const session = obtenirSession();
  const joueur = session && charger().joueurs[session.utilisateur.id];
  if (!joueur) throw new ErreurApi(401, 'Choisissez un nom de joueur.');
  return joueur;
}

function nouvellesStats() {
  return {
    partiesJouees: 0,
    partiesGagnees: 0,
    cartesJouees: 0,
    dureeTotaleSec: 0,
    meilleureSerie: 0,
    serieActuelle: 0,
  };
}

function statsPubliques(s) {
  const j = s.partiesJouees;
  return {
    partiesJouees: j,
    partiesGagnees: s.partiesGagnees,
    tauxVictoire: j ? s.partiesGagnees / j : 0,
    cartesJouees: s.cartesJouees,
    dureeMoyenneSec: j ? Math.round(s.dureeTotaleSec / j) : 0,
    meilleureSerie: s.meilleureSerie,
    serieActuelle: s.serieActuelle,
  };
}

// ---------------------------------------------------------------- parties

function partieDuJoueur(id) {
  const joueur = joueurConnecte();
  const partie = charger().parties.find((p) => p.id === Number(id) && p.joueur === joueur.id);
  if (!partie) throw new ErreurApi(404, 'Partie introuvable.');
  return partie;
}

function resume(p) {
  return {
    id: p.id,
    difficulte: p.difficulte,
    statut: p.statut,
    dateDebut: p.dateDebut,
    dateFin: p.dateFin,
    participants: p.noms.map((nom, position) => ({
      nom,
      estBot: position !== HUMAIN,
      position,
      rang: p.rangs ? p.rangs[position] : null,
    })),
  };
}

function participants(p) {
  return p.noms.map((nom, position) => ({ nom_affiche: nom, position_table: position }));
}

// Les parties finies ne gardent que leur journal : l'état se reconstruit avec la graine.
function etatDe(p) {
  return p.etat ?? reconstruirePartie(p, participants(p), p.coups).etat;
}

function vueComplete(p) {
  return copie({ partie: resume(p), vue: vuePublique(etatDe(p), HUMAIN) });
}

function cloturer(p, etat, statut) {
  const joueur = charger().joueurs[p.joueur];
  const s = joueur.stats;
  const gagne = statut === 'terminee' && etat.gagnant === HUMAIN;
  p.statut = statut;
  p.dateFin = new Date().toISOString();
  p.rangs = statut === 'terminee' ? calculerRangs(etat) : null;
  s.partiesJouees++;
  s.partiesGagnees += gagne ? 1 : 0;
  s.cartesJouees += p.coups.filter((c) => c.position_table === HUMAIN && c.type_action === 'jouer').length;
  s.dureeTotaleSec += Math.max(0, Math.round((Date.parse(p.dateFin) - Date.parse(p.dateDebut)) / 1000));
  s.serieActuelle = gagne ? s.serieActuelle + 1 : 0;
  s.meilleureSerie = Math.max(s.meilleureSerie, s.serieActuelle);
  delete p.etat;
}

function jouerEtDecrire(etat, index, action, aleatoire) {
  const avant = etat.joueurs[index].main.length;
  const numeroTour = etat.numeroTour;
  const apres = appliquerAction(etat, index, action, numeroTour, aleatoire);
  const joue = action.type === 'jouer';
  return {
    etat: apres,
    coup: {
      position_table: index,
      numero_tour: numeroTour,
      type_action: action.type,
      carte_id: joue ? action.idCarte : null,
      couleur_choisie: joue && estJoker(carteParId(action.idCarte)) ? action.couleurChoisie : null,
      derniere_carte: joue && action.derniereCarte ? 1 : 0,
      cartes_piochees: apres.joueurs[index].main.length - avant + (joue ? 1 : 0),
    },
  };
}

// ---------------------------------------------------------------- API

const asynchrone =
  (fn) =>
  async (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      if (err instanceof CoupIllegal)
        throw new ErreurApi(err.message === 'Numéro de tour périmé.' ? 409 : 400, err.message);
      throw err;
    }
  };

export const api = {
  autonome: true,

  // Pas de mot de passe : chaque nom est un profil sur cet appareil.
  entrer: asynchrone((nom) => {
    nom = String(nom ?? '').trim();
    if (!/^[\p{L}\p{N}_.-]{3,20}$/u.test(nom)) {
      throw new ErreurApi(400, 'Le nom doit avoir de 3 à 20 caractères : lettres, chiffres, « _ », « - » ou « . ».');
    }
    const d = charger();
    const id = nom.toLowerCase();
    d.joueurs[id] ??= { id, nom, dateInscription: new Date().toISOString(), stats: nouvellesStats() };
    sauver();
    const utilisateur = { id, nomUtilisateur: d.joueurs[id].nom, role: 'joueur' };
    ouvrirSession('local', utilisateur);
    return { utilisateur };
  }),
  profils: asynchrone(() => Object.values(charger().joueurs).map((j) => j.nom)),
  moi: asynchrone(() => ({ utilisateur: obtenirSession()?.utilisateur })),
  deconnexion: asynchrone(() => null),

  nouvellePartie: asynchrone((difficulte, nbBots) => {
    const joueur = joueurConnecte();
    if (!DIFFICULTES.includes(difficulte)) throw new ErreurApi(400, 'Difficulté invalide.');
    nbBots = Number(nbBots);
    if (!Number.isInteger(nbBots) || nbBots < 1 || nbBots > 3) throw new ErreurApi(400, 'Nombre de bots invalide.');
    const d = charger();
    if (d.parties.some((p) => p.joueur === joueur.id && p.statut === 'en_cours')) {
      throw new ErreurApi(409, 'Vous avez déjà une partie en cours : reprenez-la ou abandonnez-la.');
    }
    const graine = nouvelleGraine();
    const aleatoire = creerAleatoire(graine);
    const noms = [joueur.nom, ...NOMS_BOTS.slice(0, nbBots)];
    const etat = creerPartie({ noms, aleatoire });
    etat.etatAleatoire = aleatoire.etat();
    const partie = {
      id: d.prochainId++,
      joueur: joueur.id,
      difficulte,
      noms,
      graine,
      statut: 'en_cours',
      etat,
      coups: [],
      rangs: null,
      dateDebut: new Date().toISOString(),
      dateFin: null,
    };
    d.parties.push(partie);
    sauver();
    return vueComplete(partie);
  }),

  partieEnCours: asynchrone(() => {
    const joueur = joueurConnecte();
    const p = charger().parties.find((x) => x.joueur === joueur.id && x.statut === 'en_cours');
    return p ? vueComplete(p) : { partie: null };
  }),

  partie: asynchrone((id) => vueComplete(partieDuJoueur(id))),

  jouer: asynchrone((id, action, numeroTour) => {
    const p = partieDuJoueur(id);
    if (p.statut !== 'en_cours') throw new ErreurApi(409, 'La partie est terminée.');
    if (numeroTour !== p.etat.numeroTour) throw new ErreurApi(409, 'Numéro de tour périmé.');
    const actionPropre =
      action?.type === 'jouer'
        ? {
            type: 'jouer',
            idCarte: Number(action.idCarte),
            couleurChoisie: action.couleurChoisie,
            derniereCarte: Boolean(action.derniereCarte),
          }
        : { type: action?.type };

    let etat = p.etat;
    const aleatoire = creerAleatoire(etat.etatAleatoire);
    const coups = [];
    let r = jouerEtDecrire(etat, HUMAIN, actionPropre, aleatoire);
    etat = r.etat;
    coups.push(r.coup);
    while (etat.statut === 'en_cours' && etat.joueurCourant !== HUMAIN) {
      if (coups.length > 1000) throw new Error('Les bots ne terminent pas leur tour.');
      const i = etat.joueurCourant;
      r = jouerEtDecrire(etat, i, choisirActionBot(p.difficulte, etat, i), aleatoire);
      etat = r.etat;
      coups.push(r.coup);
    }
    etat.etatAleatoire = aleatoire.etat();
    p.etat = etat;
    p.coups.push(...coups);
    const vue = vuePublique(etat, HUMAIN);
    if (etat.statut === 'terminee') cloturer(p, etat, 'terminee');
    sauver();

    return copie({
      partie: resume(p),
      vue,
      evenements: coups.map((c) => ({
        position: c.position_table,
        numeroTour: c.numero_tour,
        type: c.type_action,
        carteId: c.carte_id,
        couleurChoisie: c.couleur_choisie,
        derniereCarte: Boolean(c.derniere_carte),
        cartesPiochees: c.cartes_piochees,
        nom: p.noms[c.position_table],
        carte: c.carte_id ? carteParId(c.carte_id) : null,
      })),
    });
  }),

  abandonner: asynchrone((id) => {
    const p = partieDuJoueur(id);
    if (p.statut !== 'en_cours') throw new ErreurApi(409, "Cette partie n'est pas en cours.");
    const etat = p.etat;
    cloturer(p, etat, 'abandonnee');
    sauver();
    return copie({ partie: resume(p), vue: vuePublique(etat, HUMAIN) });
  }),

  supprimer: asynchrone((id) => {
    const p = partieDuJoueur(id);
    if (p.statut === 'en_cours')
      throw new ErreurApi(409, "Impossible de supprimer une partie en cours : abandonnez-la d'abord.");
    const d = charger();
    d.parties = d.parties.filter((x) => x !== p);
    sauver();
    return null;
  }),

  historique: asynchrone((filtres = {}) => {
    const joueur = joueurConnecte();
    const parties = charger()
      .parties.filter((p) => p.joueur === joueur.id && p.statut !== 'en_cours')
      .filter((p) => !filtres.difficulte || p.difficulte === filtres.difficulte)
      .map((p) => {
        const rang = p.rangs ? p.rangs[HUMAIN] : null;
        return {
          id: p.id,
          difficulte: p.difficulte,
          nbJoueurs: p.noms.length,
          statut: p.statut,
          dateDebut: p.dateDebut,
          dateFin: p.dateFin,
          rang,
          victoire: p.statut === 'terminee' && rang === 1,
          nbCoups: p.coups.length,
          cartesJouees: p.coups.filter((c) => c.position_table === HUMAIN && c.type_action === 'jouer').length,
        };
      })
      .filter((p) => !filtres.resultat || (filtres.resultat === 'victoire' ? p.victoire : !p.victoire))
      .reverse();
    return copie({ parties });
  }),

  rejeu: asynchrone((id) => {
    const p = partieDuJoueur(id);
    if (p.statut === 'en_cours') throw new ErreurApi(409, 'Le rejeu est disponible une fois la partie finie.');
    const { images } = reconstruirePartie(p, participants(p), p.coups);
    return { partie: resume(p), cartes: PAQUET_REFERENCE, images };
  }),

  mesStats: asynchrone(() => ({ stats: statsPubliques(joueurConnecte().stats) })),

  // Sans serveur, le classement ne contient que les joueurs de cet appareil.
  classement: asynchrone(() => {
    const lignes = Object.values(charger().joueurs)
      .filter((j) => j.stats.partiesJouees > 0)
      .map((j) => ({ nomUtilisateur: j.nom, ...statsPubliques(j.stats) }))
      .sort(
        (a, b) =>
          b.partiesGagnees - a.partiesGagnees ||
          b.tauxVictoire - a.tauxVictoire ||
          b.meilleureSerie - a.meilleureSerie ||
          a.nomUtilisateur.localeCompare(b.nomUtilisateur),
      )
      .map((l, i) => ({ rang: i + 1, ...l, serieActuelle: undefined }));
    return { classement: lignes };
  }),
};
