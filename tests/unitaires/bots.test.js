import { describe, it, expect } from 'vitest';
import { TYPES } from '../../server/moteur/cartes.js';
import { creerPartie, appliquerAction, estCoupLegal } from '../../server/moteur/moteur.js';
import { creerAleatoire } from '../../server/moteur/aleatoire.js';
import { choisirActionBot, DIFFICULTES } from '../../server/bots/index.js';
import { choisirActionMoyen } from '../../server/bots/botMoyen.js';
import { choisirActionDifficile } from '../../server/bots/botDifficile.js';
import { tauxDeVictoire } from '../../server/scripts/comparerBots.js';
import { carte, remplissage, etatDeTest } from '../aides.js';

function simuler(niveaux, graine) {
  const aleatoire = creerAleatoire(graine);
  let etat = creerPartie({ noms: niveaux, aleatoire });
  while (etat.statut === 'en_cours') {
    const i = etat.joueurCourant;
    const action = choisirActionBot(niveaux[i], etat, i, aleatoire);
    if (action.type === 'jouer') {
      const c = etat.joueurs[i].main.find((x) => x.id === action.idCarte);
      expect(estCoupLegal(etat, c)).toBe(true);
    }
    etat = appliquerAction(etat, i, action, etat.numeroTour, aleatoire);
  }
  return etat;
}

describe('Bots', () => {
  it('les trois niveaux ne jouent que des coups légaux et finissent leurs parties', () => {
    for (const niveau of DIFFICULTES) {
      for (let graine = 1; graine <= 30; graine++) simuler([niveau, niveau, niveau, niveau], graine);
    }
  });

  it("le bot moyen joue ses cartes d'action avant ses chiffres", () => {
    const passe = carte('rouge', TYPES.PASSE);
    const neuf = carte('rouge', TYPES.NOMBRE, 9);
    const etat = etatDeTest({
      mains: [[neuf, passe, ...remplissage()], remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    expect(choisirActionMoyen(etat, 0).idCarte).toBe(passe.id);
  });

  it('le bot moyen garde ses jokers et choisit sa couleur dominante', () => {
    const joker = carte(null, TYPES.COULEUR);
    const etat1 = etatDeTest({
      mains: [
        [joker, carte('rouge', TYPES.NOMBRE, 3), carte('bleu', TYPES.NOMBRE, 4), carte('bleu', TYPES.NOMBRE, 6)],
        remplissage(),
      ],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    expect(choisirActionMoyen(etat1, 0).idCarte).not.toBe(joker.id);

    const etat2 = etatDeTest({
      mains: [[joker, carte('bleu', TYPES.NOMBRE, 4), carte('bleu', TYPES.NOMBRE, 6)], remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    expect(choisirActionMoyen(etat2, 0)).toMatchObject({ idCarte: joker.id, couleurChoisie: 'bleu' });
  });

  it("le bot difficile attaque quand le joueur suivant n'a plus qu'une carte", () => {
    const p2 = carte('rouge', TYPES.PLUS2);
    const huit = carte('rouge', TYPES.NOMBRE, 8);
    const etat = etatDeTest({
      mains: [[huit, p2, ...remplissage()], [carte('bleu', TYPES.NOMBRE, 1)], remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    expect(choisirActionDifficile(etat, 0).idCarte).toBe(p2.id);
  });

  it("le bot difficile impose une couleur que le joueur suivant n'a pas", () => {
    const joker = carte(null, TYPES.COULEUR);
    const etat = etatDeTest({
      mains: [[joker, carte('bleu', TYPES.NOMBRE, 2), carte('jaune', TYPES.NOMBRE, 2)], remplissage(5), remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    etat.observations.couleursManquantes[1] = ['jaune'];
    expect(choisirActionDifficile(etat, 0)).toMatchObject({ couleurChoisie: 'jaune' });
  });

  it('les niveaux sont bien ordonnés : facile < moyen < difficile', () => {
    // Graines fixes : le résultat est toujours le même. Au hasard, on gagne 25 %.
    const facile = tauxDeVictoire('facile', 'facile', 600);
    const moyen = tauxDeVictoire('moyen', 'facile', 600);
    const difficile = tauxDeVictoire('difficile', 'facile', 600);
    expect(moyen).toBeGreaterThan(facile);
    expect(difficile).toBeGreaterThan(moyen);
    expect(difficile).toBeGreaterThan(0.3);
  }, 60000);
});
