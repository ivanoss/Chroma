// Service des parties : fait le lien entre les routes, le moteur, les bots et la base.
//
// À chaque coup du joueur :
//   1. on charge la partie et on vérifie qu'elle lui appartient ;
//   2. le moteur valide et applique le coup ;
//   3. les bots jouent jusqu'au prochain tour du joueur (ou la fin) ;
//   4. on enregistre l'état et tous les coups dans une transaction ;
//   5. on renvoie la vue publique + la liste des événements à animer.
import { creerPartie, appliquerAction, vuePublique, calculerRangs, CoupIllegal } from '../moteur/moteur.js';
import { creerAleatoire, nouvelleGraine } from '../moteur/aleatoire.js';
import { carteParId, estJoker, PAQUET_REFERENCE } from '../moteur/cartes.js';
import { choisirActionBot, DIFFICULTES } from '../bots/index.js';
import { reconstruirePartie } from '../moteur/rejeu.js';
import * as dao from '../db/dao.js';
import { nonTrouve, requeteInvalide, conflit } from '../erreurs.js';

export const NOMS_BOTS = ['Ambre', 'Céleste', 'Indigo'];
const POSITION_HUMAIN = 0;
const MAX_COUPS_BOTS = 1000; // garde-fou contre une boucle infinie

// --------------------------------------------------------------------------

async function chargerPartieDuJoueur(db, utilisateur, partieId) {
  const partie = await dao.lirePartie(db, partieId);
  // Une partie d'un autre joueur est traitée comme inexistante (pas de fuite d'info).
  if (!partie || partie.utilisateur_id !== utilisateur.id) throw nonTrouve('Partie introuvable.');
  return partie;
}

function resume(partie, participants) {
  return {
    id: partie.id,
    difficulte: partie.difficulte_bot,
    statut: partie.statut,
    dateDebut: partie.date_debut,
    dateFin: partie.date_fin,
    participants: participants.map((p) => ({
      nom: p.nom_affiche,
      estBot: Boolean(p.est_bot),
      position: p.position_table,
      rang: p.rang_final,
    })),
  };
}

function vueComplete(partie, participants) {
  return { partie: resume(partie, participants), vue: vuePublique(partie.etat, POSITION_HUMAIN) };
}

// Applique une action et décrit ce qui s'est passé (pour le journal et l'animation).
function jouerEtDecrire(etat, index, action, aleatoire) {
  const avant = etat.joueurs[index].main.length;
  const numeroTour = etat.numeroTour;
  const apres = appliquerAction(etat, index, action, numeroTour, aleatoire);
  const joue = action.type === 'jouer';
  const coup = {
    position: index,
    numeroTour,
    type: action.type,
    carteId: joue ? action.idCarte : null,
    couleurChoisie: joue && estJoker(carteParId(action.idCarte)) ? action.couleurChoisie : null,
    derniereCarte: Boolean(joue && action.derniereCarte),
    cartesPiochees: apres.joueurs[index].main.length - avant + (joue ? 1 : 0),
  };
  return { etat: apres, coup };
}

async function terminerPartie(tx, partie, etat, participants, statut) {
  await dao.clorePartie(tx, partie.id, statut);
  const rangs = statut === 'terminee' ? calculerRangs(etat) : null;
  if (rangs) {
    for (const p of participants) await dao.enregistrerRang(tx, p.id, rangs[p.position_table]);
  }
  const humain = participants.find((p) => !p.est_bot);
  const { n } = await dao.compterCartesJouees(tx, humain.id);
  const dureeSec = Math.max(0, Math.round((Date.now() - Date.parse(partie.date_debut)) / 1000));
  await dao.enregistrerResultat(tx, partie.utilisateur_id, {
    gagne: statut === 'terminee' && etat.gagnant === POSITION_HUMAIN,
    cartesJouees: Number(n),
    dureeSec,
  });
}

// --------------------------------------------------------------------------
// Cas d'utilisation
// --------------------------------------------------------------------------

export async function nouvellePartie(db, utilisateur, { difficulte = 'facile', nbBots = 3 } = {}) {
  if (!DIFFICULTES.includes(difficulte)) throw requeteInvalide('Difficulté invalide.');
  nbBots = Number(nbBots);
  if (!Number.isInteger(nbBots) || nbBots < 1 || nbBots > 3) {
    throw requeteInvalide('Le nombre de bots doit être entre 1 et 3.');
  }
  if (await dao.partieEnCours(db, utilisateur.id)) {
    throw conflit('Vous avez déjà une partie en cours : reprenez-la ou abandonnez-la.');
  }

  const graine = nouvelleGraine();
  const aleatoire = creerAleatoire(graine);
  const noms = [utilisateur.nom_utilisateur, ...NOMS_BOTS.slice(0, nbBots)];
  const etat = creerPartie({ noms, aleatoire });
  // L'état du générateur reste côté serveur : vuePublique() ne l'envoie jamais,
  // sinon on pourrait prédire la pioche.
  etat.etatAleatoire = aleatoire.etat();

  const id = await dao.insererPartie(db, {
    utilisateurId: utilisateur.id,
    difficulte,
    etat,
    graine,
    participants: noms.map((nom, position) => ({
      nom,
      position,
      estBot: position !== POSITION_HUMAIN,
      utilisateurId: position === POSITION_HUMAIN ? utilisateur.id : null,
    })),
  });
  return obtenirPartie(db, utilisateur, id);
}

export async function obtenirPartie(db, utilisateur, partieId) {
  const partie = await chargerPartieDuJoueur(db, utilisateur, partieId);
  return vueComplete(partie, await dao.lireParticipants(db, partie.id));
}

export async function partieEnCours(db, utilisateur) {
  const partie = await dao.partieEnCours(db, utilisateur.id);
  if (!partie) return null;
  return vueComplete(partie, await dao.lireParticipants(db, partie.id));
}

export async function jouerCoup(db, utilisateur, partieId, { action, numeroTour }) {
  if (!action || typeof action !== 'object') throw requeteInvalide('Action manquante.');
  if (!Number.isInteger(numeroTour)) throw requeteInvalide('Numéro de tour manquant.');
  const actionPropre =
    action.type === 'jouer'
      ? {
          type: 'jouer',
          idCarte: Number(action.idCarte),
          couleurChoisie: action.couleurChoisie,
          derniereCarte: Boolean(action.derniereCarte),
        }
      : { type: action.type };

  return db.transaction(async (tx) => {
    const partie = await chargerPartieDuJoueur(tx, utilisateur, partieId);
    if (partie.statut !== 'en_cours') throw conflit('La partie est terminée.');
    const participants = await dao.lireParticipants(tx, partie.id);

    let etat = partie.etat;
    const aleatoire = creerAleatoire(etat.etatAleatoire);
    const coups = [];

    // 1. Le coup du joueur. Le moteur refuse tout ce qui est illégal.
    if (numeroTour !== etat.numeroTour) throw new CoupIllegal('Numéro de tour périmé.');
    let resultat = jouerEtDecrire(etat, POSITION_HUMAIN, actionPropre, aleatoire);
    etat = resultat.etat;
    coups.push(resultat.coup);

    // 2. Les bots jouent jusqu'au retour du joueur.
    while (etat.statut === 'en_cours' && etat.joueurCourant !== POSITION_HUMAIN) {
      if (coups.length > MAX_COUPS_BOTS) throw new Error('Les bots ne terminent pas leur tour.');
      const i = etat.joueurCourant;
      const choix = choisirActionBot(partie.difficulte_bot, etat, i);
      resultat = jouerEtDecrire(etat, i, choix, aleatoire);
      etat = resultat.etat;
      coups.push(resultat.coup);
    }
    etat.etatAleatoire = aleatoire.etat();

    // 3. Sauvegarde. Si une autre requête a modifié la partie entre-temps, on refuse.
    if (!(await dao.sauvegarderEtat(tx, partie.id, etat, partie.version))) {
      throw conflit('La partie a été modifiée par une autre requête. Rechargez.');
    }
    const participantParPosition = new Map(participants.map((p) => [p.position_table, p.id]));
    await dao.insererCoups(
      tx,
      partie.id,
      coups.map((c) => ({ ...c, participantId: participantParPosition.get(c.position) })),
    );
    if (etat.statut === 'terminee') {
      await terminerPartie(tx, partie, etat, participants, 'terminee');
    }

    const misAJour = await dao.lirePartie(tx, partie.id);
    const parts = await dao.lireParticipants(tx, partie.id);
    return {
      ...vueComplete(misAJour, parts),
      evenements: coups.map((c) => ({
        ...c,
        nom: participants[c.position].nom_affiche,
        carte: c.carteId ? carteParId(c.carteId) : null,
      })),
    };
  });
}

export async function abandonner(db, utilisateur, partieId) {
  return db.transaction(async (tx) => {
    const partie = await chargerPartieDuJoueur(tx, utilisateur, partieId);
    if (partie.statut !== 'en_cours') throw conflit("Cette partie n'est pas en cours.");
    const participants = await dao.lireParticipants(tx, partie.id);
    await terminerPartie(tx, partie, partie.etat, participants, 'abandonnee');
    return vueComplete(await dao.lirePartie(tx, partie.id), participants);
  });
}

export async function supprimer(db, utilisateur, partieId) {
  const partie = await chargerPartieDuJoueur(db, utilisateur, partieId);
  if (partie.statut === 'en_cours') {
    throw conflit("Impossible de supprimer une partie en cours : abandonnez-la d'abord.");
  }
  await dao.supprimerPartie(db, partie.id);
}

// --------------------------------------------------------------------------
// Rejeu : on repart de la graine, on redistribue exactement les mêmes cartes,
// puis on rejoue les coups du journal un par un avec le moteur.
// --------------------------------------------------------------------------

export async function rejeu(db, utilisateur, partieId) {
  const partie = await chargerPartieDuJoueur(db, utilisateur, partieId);
  if (partie.statut === 'en_cours') throw conflit('Le rejeu est disponible une fois la partie finie.');
  const participants = await dao.lireParticipants(db, partie.id);
  const coups = await dao.lireCoups(db, partie.id);
  const { images } = reconstruirePartie(partie, participants, coups);
  // Le référentiel des cartes permet au client d'afficher les id des images.
  return { partie: resume(partie, participants), cartes: PAQUET_REFERENCE, images };
}
