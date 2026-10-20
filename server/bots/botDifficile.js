// Bot difficile : il retient ce qui a été joué pour estimer les mains adverses.
//
// Il n'utilise QUE l'information publique : sa propre main, le nombre de cartes
// des autres, la défausse et les observations du moteur (couleurs sur
// lesquelles un joueur a dû piocher). Il ne regarde jamais la main des autres,
// sinon ce serait de la triche.
//
// Les poids ont été réglés en faisant jouer des milliers de parties
// (voir server/scripts/comparerBots.js).
import { COULEURS, TYPES, estJoker } from '../moteur/cartes.js';
import { coupsLegaux, indexSuivant } from '../moteur/moteur.js';
import { compterCouleurs } from './botMoyen.js';

// Intérêt d'une couleur : surtout le nombre de cartes que j'en ai encore.
// Si le joueur suivant a déjà pioché sur cette couleur (il ne l'a sans doute
// pas), c'est un petit bonus qui départage deux couleurs équivalentes.
function valeurCouleur(c, compteMain, suivantManque) {
  return compteMain[c] * 3 + (suivantManque.includes(c) ? 1 : 0);
}

function meilleureCouleur(compteMain, suivantManque) {
  return COULEURS.reduce((meilleure, c) =>
    valeurCouleur(c, compteMain, suivantManque) > valeurCouleur(meilleure, compteMain, suivantManque) ? c : meilleure,
  );
}

export function choisirActionDifficile(etat, indexJoueur) {
  const legaux = coupsLegaux(etat, indexJoueur);
  if (legaux.length === 0) return { type: 'piocher' };

  const main = etat.joueurs[indexJoueur].main;
  const suivant = indexSuivant(etat, indexJoueur);
  const precedent = indexSuivant(etat, indexJoueur, -1);
  const manquesSuivant = etat.observations.couleursManquantes[suivant];
  const cartesSuivant = etat.joueurs[suivant].main.length; // info publique : le compteur
  const cartesPrecedent = etat.joueurs[precedent].main.length;
  const menace = cartesSuivant <= 1; // le suivant peut gagner à son prochain coup

  let choix = null;
  for (const carte of legaux) {
    const reste = main.filter((c) => c.id !== carte.id);
    const compteReste = compterCouleurs(reste);
    const couleur = estJoker(carte) ? meilleureCouleur(compteReste, manquesSuivant) : carte.couleur;

    let score;
    switch (carte.type) {
      case TYPES.PLUS2:
        // Hors menace, on garde le +2 : il sert à se défendre contre un +2 adverse.
        score = menace ? 80 : 8;
        break;
      case TYPES.PASSE:
        score = 30 + (menace ? 50 : 0);
        break;
      case TYPES.INVERSION:
        // Inverser renvoie le tour vers le joueur précédent : excellent si le
        // suivant est près de gagner et que le précédent a plus de cartes.
        score = 30 + (menace && cartesPrecedent > cartesSuivant ? 45 : 0);
        break;
      case TYPES.PLUS4:
        score = menace ? 70 : 4; // la meilleure défense, sinon on la garde pour la fin
        break;
      case TYPES.COULEUR:
        score = 5;
        break;
      default:
        // Rester dans une couleur où il me reste des cartes, se défaire des gros chiffres.
        score = 10 + compteReste[couleur] * 4 + carte.valeur / 10 + (manquesSuivant.includes(couleur) ? 1 : 0);
    }

    if (!choix || score > choix.score) choix = { carte, couleur, score, reste: reste.length };
  }

  return {
    type: 'jouer',
    idCarte: choix.carte.id,
    couleurChoisie: estJoker(choix.carte) ? choix.couleur : undefined,
    derniereCarte: choix.reste === 1,
  };
}
