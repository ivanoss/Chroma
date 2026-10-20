// Outils partagés par les tests : construire un état de partie à la main.
import { COULEURS, TYPES, POINTS } from '../server/moteur/cartes.js';

let prochainId = 1000;

export function carte(couleur, type, valeur = null) {
  const points = type === TYPES.NOMBRE ? valeur : POINTS[type];
  return { id: prochainId++, couleur, type, valeur, points };
}

// Cartes « neutres » pour remplir une main ou une pioche.
export function remplissage(n = 3) {
  return Array.from({ length: n }, (_, i) => carte('vert', TYPES.NOMBRE, (i % 3) + 6));
}

export function etatDeTest({
  mains,
  sommet,
  pioche = [],
  couleurActive = sommet.couleur,
  sens = 1,
  joueurCourant = 0,
  numeroTour = 1,
  autresDefausse = [],
}) {
  return {
    statut: 'en_cours',
    joueurs: mains.map((main, i) => ({ nom: `J${i}`, main })),
    pioche,
    defausse: [...autresDefausse, sommet],
    couleurActive,
    sens,
    joueurCourant,
    numeroTour,
    penaliteEnCours: 0,
    typePenalite: null,
    passesConsecutives: 0,
    gagnant: null,
    finParBlocage: false,
    observations: {
      couleursJouees: Object.fromEntries(COULEURS.map((c) => [c, 0])),
      couleursManquantes: mains.map(() => []),
    },
  };
}
