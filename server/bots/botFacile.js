// Bot facile : joue au hasard parmi les coups légaux.
import { COULEURS, estJoker } from '../moteur/cartes.js';
import { coupsLegaux } from '../moteur/moteur.js';

export function choisirActionFacile(etat, indexJoueur, aleatoire = Math.random) {
  const legaux = coupsLegaux(etat, indexJoueur);
  if (legaux.length === 0) return { type: 'piocher' };

  const carte = legaux[Math.floor(aleatoire() * legaux.length)];
  const mainRestante = etat.joueurs[indexJoueur].main.length - 1;
  return {
    type: 'jouer',
    idCarte: carte.id,
    couleurChoisie: estJoker(carte) ? COULEURS[Math.floor(aleatoire() * COULEURS.length)] : undefined,
    derniereCarte: mainRestante === 1, // le bot n'oublie jamais de déclarer
  };
}
