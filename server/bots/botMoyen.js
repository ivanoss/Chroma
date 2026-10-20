// Bot moyen : heuristique simple.
// - il se débarrasse d'abord de ses cartes d'action (+2, passe, inversion) ;
// - sinon il joue dans sa couleur dominante, en commençant par les gros chiffres ;
// - il garde ses jokers pour la fin ;
// - quand il choisit une couleur, il prend celle qu'il a le plus en main.
import { COULEURS, TYPES, estJoker } from '../moteur/cartes.js';
import { coupsLegaux } from '../moteur/moteur.js';

export function compterCouleurs(main) {
  const compte = Object.fromEntries(COULEURS.map((c) => [c, 0]));
  for (const carte of main) if (carte.couleur) compte[carte.couleur]++;
  return compte;
}

export function couleurDominante(main, aleatoire = Math.random) {
  const compte = compterCouleurs(main);
  const max = Math.max(...Object.values(compte));
  if (max === 0) return COULEURS[Math.floor(aleatoire() * COULEURS.length)];
  return COULEURS.find((c) => compte[c] === max);
}

const ACTIONS = new Set([TYPES.PLUS2, TYPES.PASSE, TYPES.INVERSION]);

function score(carte, dominante) {
  if (ACTIONS.has(carte.type)) return 30;
  if (carte.type === TYPES.NOMBRE) {
    return (carte.couleur === dominante ? 20 : 10) + carte.valeur / 10;
  }
  return carte.type === TYPES.COULEUR ? 5 : 4; // jokers en dernier
}

export function choisirActionMoyen(etat, indexJoueur, aleatoire = Math.random) {
  const legaux = coupsLegaux(etat, indexJoueur);
  if (legaux.length === 0) return { type: 'piocher' };

  const main = etat.joueurs[indexJoueur].main;
  const dominante = couleurDominante(main, aleatoire);
  const carte = legaux.reduce((meilleure, c) => (score(c, dominante) > score(meilleure, dominante) ? c : meilleure));
  const reste = main.filter((c) => c.id !== carte.id);

  return {
    type: 'jouer',
    idCarte: carte.id,
    couleurChoisie: estJoker(carte) ? couleurDominante(reste, aleatoire) : undefined,
    derniereCarte: reste.length === 1,
  };
}
