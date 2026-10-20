// Rejeu : on repart de la graine, on redistribue exactement les mêmes cartes,
// puis on rejoue les coups du journal un par un avec le moteur.
// Module pur, utilisé par le serveur et par la version autonome (navigateur).
import { creerPartie, appliquerAction } from './moteur.js';
import { creerAleatoire } from './aleatoire.js';

function image(etat, coup = null) {
  return {
    numeroTour: etat.numeroTour,
    joueurCourant: etat.joueurCourant,
    sens: etat.sens,
    couleurActive: etat.couleurActive,
    sommet: etat.defausse.at(-1).id,
    taillePioche: etat.pioche.length,
    penaliteEnCours: etat.penaliteEnCours,
    mains: etat.joueurs.map((j) => j.main.map((c) => c.id)),
    coup,
  };
}

export function reconstruirePartie(partie, participants, coups) {
  const aleatoire = creerAleatoire(partie.graine);
  const noms = participants.map((p) => p.nom_affiche);
  let etat = creerPartie({ noms, aleatoire });
  const images = [image(etat)];
  for (const c of coups) {
    const action =
      c.type_action === 'jouer'
        ? {
            type: 'jouer',
            idCarte: c.carte_id,
            couleurChoisie: c.couleur_choisie ?? undefined,
            derniereCarte: Boolean(c.derniere_carte),
          }
        : { type: 'piocher' };
    etat = appliquerAction(etat, c.position_table, action, c.numero_tour, aleatoire);
    images.push(
      image(etat, {
        position: c.position_table,
        type: c.type_action,
        carteId: c.carte_id,
        couleurChoisie: c.couleur_choisie,
        derniereCarte: Boolean(c.derniere_carte),
        cartesPiochees: c.cartes_piochees,
      }),
    );
  }
  return { etat, images };
}
