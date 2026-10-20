// Moteur de règles de Chroma.
// Règle d'or : aucune fonction exportée ne modifie l'état qu'elle reçoit.
// appliquerAction() clone l'état et retourne la nouvelle version.

import { COULEURS, TYPES, construirePaquet, estJoker, melanger } from './cartes.js';

export const TAILLE_MAIN = 7;
export const PENALITE_OUBLI = 2; // cartes piochées si on oublie « dernière carte »

export class CoupIllegal extends Error {
  constructor(message) {
    super(message);
    this.name = 'CoupIllegal';
  }
}

const cloner = (etat) => structuredClone(etat);

// ---------------------------------------------------------------------------
// Création d'une partie
// ---------------------------------------------------------------------------

export function creerPartie({ noms, aleatoire = Math.random, tailleMain = TAILLE_MAIN }) {
  if (!Array.isArray(noms) || noms.length < 2 || noms.length > 4) {
    throw new Error('Une partie se joue de 2 à 4 joueurs.');
  }
  let pioche = melanger(construirePaquet(), aleatoire);
  const joueurs = noms.map((nom) => ({ nom, main: [] }));

  // Distribution une carte à la fois, comme à une vraie table.
  for (let tour = 0; tour < tailleMain; tour++) {
    for (const joueur of joueurs) joueur.main.push(pioche.pop());
  }

  // La première carte retournée doit être un chiffre : sinon on la remet
  // sous la pioche et on retourne la suivante.
  let premiere = pioche.pop();
  while (premiere.type !== TYPES.NOMBRE) {
    pioche = [premiere, ...pioche];
    premiere = pioche.pop();
  }

  return {
    statut: 'en_cours',
    joueurs,
    pioche,
    defausse: [premiere],
    couleurActive: premiere.couleur,
    sens: 1,
    joueurCourant: 0,
    numeroTour: 1,
    penaliteEnCours: 0,
    typePenalite: null,
    passesConsecutives: 0,
    gagnant: null,
    finParBlocage: false,
    // Informations publiques (ce que n'importe quel joueur à la table a vu).
    // Le bot difficile s'en sert pour estimer les mains adverses.
    observations: {
      couleursJouees: Object.fromEntries(COULEURS.map((c) => [c, 0])),
      couleursManquantes: joueurs.map(() => []),
    },
  };
}

// ---------------------------------------------------------------------------
// Lecture de l'état
// ---------------------------------------------------------------------------

export function sommetDefausse(etat) {
  return etat.defausse[etat.defausse.length - 1];
}

export function estCoupLegal(etat, carte) {
  const sommet = sommetDefausse(etat);

  // Pénalité en attente : on ne peut que la cumuler avec une carte du même type.
  if (etat.penaliteEnCours > 0) {
    return carte.type === etat.typePenalite;
  }
  if (estJoker(carte)) return true;
  if (carte.couleur === etat.couleurActive) return true;
  if (carte.type === TYPES.NOMBRE) {
    return sommet.type === TYPES.NOMBRE && carte.valeur === sommet.valeur;
  }
  return carte.type === sommet.type; // action sur action du même type
}

export function coupsLegaux(etat, indexJoueur) {
  return etat.joueurs[indexJoueur].main.filter((c) => estCoupLegal(etat, c));
}

export function indexSuivant(etat, depuis = etat.joueurCourant, pas = 1) {
  const n = etat.joueurs.length;
  return (((depuis + etat.sens * pas) % n) + n) % n;
}

export function pointsMain(main) {
  return main.reduce((total, c) => total + c.points, 0);
}

// Rang final de chaque joueur : le gagnant est 1er, les autres sont classés
// selon les points restant en main (moins de points = meilleur rang).
export function calculerRangs(etat) {
  const ordre = etat.joueurs
    .map((j, index) => ({ index, points: pointsMain(j.main), gagnant: index === etat.gagnant }))
    .sort((a, b) => b.gagnant - a.gagnant || a.points - b.points || a.index - b.index);
  const rangs = new Array(etat.joueurs.length);
  ordre.forEach((o, i) => (rangs[o.index] = i + 1));
  return rangs;
}

// ---------------------------------------------------------------------------
// Modifications internes (appelées uniquement sur une copie)
// ---------------------------------------------------------------------------

function passerLaMain(etat, pas = 1) {
  etat.joueurCourant = indexSuivant(etat, etat.joueurCourant, pas);
}

// Quand la pioche est vide, on garde le sommet de la défausse et on remélange
// le reste pour refaire une pioche.
function refairePioche(etat, aleatoire) {
  if (etat.defausse.length <= 1) return false;
  const sommet = etat.defausse.pop();
  etat.pioche = melanger(etat.defausse, aleatoire);
  etat.defausse = [sommet];
  return true;
}

function piocherCartes(etat, indexJoueur, nombre, aleatoire) {
  let piochees = 0;
  for (let i = 0; i < nombre; i++) {
    if (etat.pioche.length === 0 && !refairePioche(etat, aleatoire)) break;
    etat.joueurs[indexJoueur].main.push(etat.pioche.pop());
    piochees++;
  }
  return piochees;
}

function terminer(etat, gagnant, parBlocage = false) {
  etat.statut = 'terminee';
  etat.gagnant = gagnant;
  etat.finParBlocage = parBlocage;
  etat.penaliteEnCours = 0;
  etat.typePenalite = null;
}

// Cas extrême : plus aucune carte à piocher et personne ne peut jouer.
// On arrête la partie et le joueur avec le moins de points gagne.
function gagnantAuxPoints(etat) {
  let meilleur = 0;
  etat.joueurs.forEach((j, i) => {
    if (pointsMain(j.main) < pointsMain(etat.joueurs[meilleur].main)) meilleur = i;
  });
  return meilleur;
}

function retirerDeLaListe(liste, valeur) {
  const i = liste.indexOf(valeur);
  if (i !== -1) liste.splice(i, 1);
}

// ---------------------------------------------------------------------------
// Appliquer une action
// action = { type: 'jouer', idCarte, couleurChoisie?, derniereCarte? }
//        | { type: 'piocher' }
// ---------------------------------------------------------------------------

export function appliquerAction(etatInitial, indexJoueur, action, numeroTour, aleatoire = Math.random) {
  if (etatInitial.statut !== 'en_cours') throw new CoupIllegal('La partie est terminée.');
  if (indexJoueur !== etatInitial.joueurCourant) throw new CoupIllegal("Ce n'est pas votre tour.");
  if (numeroTour !== etatInitial.numeroTour) throw new CoupIllegal('Numéro de tour périmé.');

  const etat = cloner(etatInitial);
  const joueur = etat.joueurs[indexJoueur];
  const obs = etat.observations;

  if (action?.type === 'jouer') {
    const position = joueur.main.findIndex((c) => c.id === action.idCarte);
    if (position === -1) throw new CoupIllegal("Cette carte n'est pas dans votre main.");
    const carte = joueur.main[position];
    if (!estCoupLegal(etat, carte)) throw new CoupIllegal('Cette carte ne peut pas être jouée.');
    if (estJoker(carte) && !COULEURS.includes(action.couleurChoisie)) {
      throw new CoupIllegal('Choisissez une couleur.');
    }

    joueur.main.splice(position, 1);
    etat.defausse.push(carte);
    etat.couleurActive = estJoker(carte) ? action.couleurChoisie : carte.couleur;
    etat.passesConsecutives = 0;
    etat.numeroTour++;

    if (carte.couleur) obs.couleursJouees[carte.couleur]++;
    // Le joueur a montré qu'il avait cette couleur : on ne la croit plus manquante.
    retirerDeLaListe(obs.couleursManquantes[indexJoueur], carte.couleur);

    if (joueur.main.length === 0) {
      terminer(etat, indexJoueur);
      return etat;
    }

    // Règle de la dernière carte : poser son avant-dernière carte sans
    // l'annoncer coûte deux cartes.
    if (joueur.main.length === 1 && !action.derniereCarte) {
      piocherCartes(etat, indexJoueur, PENALITE_OUBLI, aleatoire);
    }

    switch (carte.type) {
      case TYPES.INVERSION:
        etat.sens *= -1;
        // À deux joueurs, l'inversion agit comme une passe : on rejoue.
        passerLaMain(etat, etat.joueurs.length === 2 ? 2 : 1);
        break;
      case TYPES.PASSE:
        passerLaMain(etat, 2);
        break;
      case TYPES.PLUS2:
      case TYPES.PLUS4:
        etat.penaliteEnCours += carte.type === TYPES.PLUS2 ? 2 : 4;
        etat.typePenalite = carte.type;
        passerLaMain(etat);
        break;
      default:
        passerLaMain(etat);
    }
    return etat;
  }

  if (action?.type === 'piocher') {
    const penalite = etat.penaliteEnCours;
    if (penalite === 0) {
      // Piocher sans pénalité : le joueur n'avait (sans doute) pas la couleur active.
      const manquantes = obs.couleursManquantes[indexJoueur];
      if (!manquantes.includes(etat.couleurActive)) manquantes.push(etat.couleurActive);
    }
    const piochees = piocherCartes(etat, indexJoueur, penalite > 0 ? penalite : 1, aleatoire);
    etat.penaliteEnCours = 0;
    etat.typePenalite = null;
    etat.numeroTour++;
    etat.passesConsecutives = piochees === 0 ? etat.passesConsecutives + 1 : 0;

    if (etat.passesConsecutives >= etat.joueurs.length * 2) {
      terminer(etat, gagnantAuxPoints(etat), true);
      return etat;
    }
    passerLaMain(etat);
    return etat;
  }

  throw new CoupIllegal('Action inconnue.');
}

// ---------------------------------------------------------------------------
// Ce que le navigateur reçoit
// ---------------------------------------------------------------------------

export function vuePublique(etat, indexJoueur) {
  const termine = etat.statut !== 'en_cours';
  const sonTour = !termine && etat.joueurCourant === indexJoueur;
  return {
    statut: etat.statut,
    numeroTour: etat.numeroTour,
    joueurCourant: etat.joueurCourant,
    sens: etat.sens,
    couleurActive: etat.couleurActive,
    sommet: sommetDefausse(etat),
    taillePioche: etat.pioche.length,
    penaliteEnCours: etat.penaliteEnCours,
    typePenalite: etat.typePenalite,
    gagnant: etat.gagnant,
    finParBlocage: etat.finParBlocage,
    moi: indexJoueur,
    main: etat.joueurs[indexJoueur].main,
    joueurs: etat.joueurs.map((j, i) => ({
      nom: j.nom,
      nbCartes: j.main.length,
      // Les mains adverses ne sont révélées qu'en fin de partie.
      ...(termine && i !== indexJoueur ? { main: j.main } : {}),
    })),
    coupsJouables: sonTour ? coupsLegaux(etat, indexJoueur).map((c) => c.id) : [],
    rangs: termine ? calculerRangs(etat) : null,
  };
}
