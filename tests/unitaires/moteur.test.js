import { describe, it, expect } from 'vitest';
import { COULEURS, TYPES, construirePaquet, melanger, carteParId } from '../../server/moteur/cartes.js';
import {
  creerPartie,
  estCoupLegal,
  appliquerAction,
  vuePublique,
  CoupIllegal,
  calculerRangs,
} from '../../server/moteur/moteur.js';
import { creerAleatoire } from '../../server/moteur/aleatoire.js';
import { choisirActionFacile } from '../../server/bots/botFacile.js';
import { carte, remplissage, etatDeTest } from '../aides.js';

const jouer = (idCarte, extra = {}) => ({ type: 'jouer', idCarte, ...extra });
const PIOCHER = { type: 'piocher' };

describe('Paquet de cartes', () => {
  it('contient 108 cartes avec des id uniques de 1 à 108', () => {
    const paquet = construirePaquet();
    expect(paquet).toHaveLength(108);
    expect(new Set(paquet.map((c) => c.id)).size).toBe(108);
    expect(carteParId(1)).toMatchObject({ couleur: 'rouge', type: TYPES.NOMBRE, valeur: 0 });
    expect(carteParId(108)).not.toBeNull();
  });

  it('a 25 cartes par couleur et 8 jokers', () => {
    const paquet = construirePaquet();
    for (const c of COULEURS) expect(paquet.filter((x) => x.couleur === c)).toHaveLength(25);
    expect(paquet.filter((x) => x.type === TYPES.COULEUR)).toHaveLength(4);
    expect(paquet.filter((x) => x.type === TYPES.PLUS4)).toHaveLength(4);
  });

  it('mélange toujours de la même façon avec la même graine, sans toucher au paquet', () => {
    const paquet = construirePaquet();
    const a = melanger(paquet, creerAleatoire(42));
    const b = melanger(paquet, creerAleatoire(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(paquet.map((c) => c.id)).toEqual(construirePaquet().map((c) => c.id));
    expect(a.map((c) => c.id)).not.toEqual(paquet.map((c) => c.id));
  });
});

describe('Distribution', () => {
  it('donne 7 cartes à chacun et retourne un chiffre sur la défausse', () => {
    for (let graine = 1; graine <= 30; graine++) {
      const etat = creerPartie({ noms: ['A', 'B', 'C', 'D'], aleatoire: creerAleatoire(graine) });
      expect(etat.joueurs.every((j) => j.main.length === 7)).toBe(true);
      expect(etat.defausse).toHaveLength(1);
      expect(etat.defausse[0].type).toBe(TYPES.NOMBRE);
      expect(etat.pioche).toHaveLength(108 - 28 - 1);
      expect(etat.couleurActive).toBe(etat.defausse[0].couleur);
    }
  });

  it('refuse une partie à 1 ou 5 joueurs', () => {
    expect(() => creerPartie({ noms: ['A'] })).toThrow();
    expect(() => creerPartie({ noms: ['A', 'B', 'C', 'D', 'E'] })).toThrow();
  });
});

describe('Légalité des coups', () => {
  const sommet = carte('rouge', TYPES.NOMBRE, 5);
  const etat = etatDeTest({ mains: [remplissage(), remplissage()], sommet });

  it('accepte la même couleur, le même chiffre et les jokers', () => {
    expect(estCoupLegal(etat, carte('rouge', TYPES.NOMBRE, 9))).toBe(true);
    expect(estCoupLegal(etat, carte('bleu', TYPES.NOMBRE, 5))).toBe(true);
    expect(estCoupLegal(etat, carte(null, TYPES.COULEUR))).toBe(true);
    expect(estCoupLegal(etat, carte(null, TYPES.PLUS4))).toBe(true);
  });

  it('refuse une carte sans rapport', () => {
    expect(estCoupLegal(etat, carte('bleu', TYPES.NOMBRE, 4))).toBe(false);
    expect(estCoupLegal(etat, carte('bleu', TYPES.PASSE))).toBe(false);
  });

  it('accepte une action sur la même action, même de couleur différente', () => {
    const e = etatDeTest({ mains: [remplissage(), remplissage()], sommet: carte('rouge', TYPES.PASSE) });
    expect(estCoupLegal(e, carte('bleu', TYPES.PASSE))).toBe(true);
    expect(estCoupLegal(e, carte('bleu', TYPES.INVERSION))).toBe(false);
  });

  it('avec une pénalité en attente, seule une carte du même type est acceptée', () => {
    const e = { ...etat, penaliteEnCours: 2, typePenalite: TYPES.PLUS2 };
    expect(estCoupLegal(e, carte('bleu', TYPES.PLUS2))).toBe(true);
    expect(estCoupLegal(e, carte('rouge', TYPES.NOMBRE, 5))).toBe(false);
    expect(estCoupLegal(e, carte(null, TYPES.PLUS4))).toBe(false);
  });
});

describe('Cartes spéciales', () => {
  it("l'inversion change le sens de jeu", () => {
    const inv = carte('rouge', TYPES.INVERSION);
    let etat = etatDeTest({
      mains: [[inv, ...remplissage()], remplissage(), remplissage(), remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    etat = appliquerAction(etat, 0, jouer(inv.id), 1);
    expect(etat.sens).toBe(-1);
    expect(etat.joueurCourant).toBe(3);
  });

  it("à deux joueurs, l'inversion fait rejouer le même joueur", () => {
    const inv = carte('rouge', TYPES.INVERSION);
    let etat = etatDeTest({ mains: [[inv, ...remplissage()], remplissage()], sommet: carte('rouge', TYPES.NOMBRE, 1) });
    etat = appliquerAction(etat, 0, jouer(inv.id), 1);
    expect(etat.joueurCourant).toBe(0);
  });

  it('la passe saute le joueur suivant', () => {
    const passe = carte('rouge', TYPES.PASSE);
    let etat = etatDeTest({
      mains: [[passe, ...remplissage()], remplissage(), remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    etat = appliquerAction(etat, 0, jouer(passe.id), 1);
    expect(etat.joueurCourant).toBe(2);
  });

  it('un +2 fait piocher 2 cartes au joueur suivant, qui perd son tour', () => {
    const p2 = carte('rouge', TYPES.PLUS2);
    let etat = etatDeTest({
      mains: [[p2, ...remplissage()], remplissage(), remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
      pioche: remplissage(5),
    });
    etat = appliquerAction(etat, 0, jouer(p2.id), 1);
    expect(etat.penaliteEnCours).toBe(2);
    etat = appliquerAction(etat, 1, PIOCHER, 2);
    expect(etat.joueurs[1].main).toHaveLength(5);
    expect(etat.penaliteEnCours).toBe(0);
    expect(etat.joueurCourant).toBe(2);
  });

  it('deux +2 cumulés font piocher 4 cartes au joueur suivant', () => {
    const p1 = carte('rouge', TYPES.PLUS2);
    const p2 = carte('bleu', TYPES.PLUS2);
    let etat = etatDeTest({
      mains: [[p1, ...remplissage()], [p2, ...remplissage()], remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
      pioche: remplissage(),
    });
    etat = appliquerAction(etat, 0, { type: 'jouer', idCarte: p1.id }, 1);
    etat = appliquerAction(etat, 1, { type: 'jouer', idCarte: p2.id }, 2);
    expect(etat.penaliteEnCours).toBe(4);
    const avant = etat.joueurs[2].main.length;
    etat = appliquerAction(etat, 2, { type: 'piocher' }, 3);
    expect(etat.joueurs[2].main.length).toBe(avant + 4);
  });

  it('un +4 ne peut pas être contré par un +2', () => {
    const p4 = carte(null, TYPES.PLUS4);
    const p2 = carte('bleu', TYPES.PLUS2);
    let etat = etatDeTest({
      mains: [
        [p4, ...remplissage()],
        [p2, ...remplissage()],
      ],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    etat = appliquerAction(etat, 0, jouer(p4.id, { couleurChoisie: 'bleu' }), 1);
    expect(() => appliquerAction(etat, 1, jouer(p2.id), 2)).toThrow(CoupIllegal);
  });

  it('le changement de couleur impose la couleur choisie, et la couleur est obligatoire', () => {
    const joker = carte(null, TYPES.COULEUR);
    const etat = etatDeTest({
      mains: [[joker, ...remplissage()], remplissage()],
      sommet: carte('rouge', TYPES.NOMBRE, 1),
    });
    expect(() => appliquerAction(etat, 0, jouer(joker.id), 1)).toThrow('Choisissez une couleur.');
    const apres = appliquerAction(etat, 0, jouer(joker.id, { couleurChoisie: 'jaune' }), 1);
    expect(apres.couleurActive).toBe('jaune');
    expect(estCoupLegal(apres, carte('jaune', TYPES.NOMBRE, 3))).toBe(true);
    expect(estCoupLegal(apres, carte('rouge', TYPES.NOMBRE, 3))).toBe(false);
  });
});

describe('Dernière carte et fin de partie', () => {
  const sommet = carte('rouge', TYPES.NOMBRE, 1);

  it("oublier d'annoncer « dernière carte » coûte 2 cartes", () => {
    const a = carte('rouge', TYPES.NOMBRE, 2);
    const b = carte('vert', TYPES.NOMBRE, 3);
    const etat = etatDeTest({ mains: [[a, b], remplissage()], sommet, pioche: remplissage(4) });
    const apres = appliquerAction(etat, 0, jouer(a.id), 1);
    expect(apres.joueurs[0].main).toHaveLength(3);
  });

  it("l'annoncer évite la pénalité", () => {
    const a = carte('rouge', TYPES.NOMBRE, 2);
    const b = carte('vert', TYPES.NOMBRE, 3);
    const etat = etatDeTest({ mains: [[a, b], remplissage()], sommet, pioche: remplissage(4) });
    const apres = appliquerAction(etat, 0, jouer(a.id, { derniereCarte: true }), 1);
    expect(apres.joueurs[0].main).toHaveLength(1);
  });

  it('poser sa dernière carte termine la partie et calcule les rangs', () => {
    const a = carte('rouge', TYPES.NOMBRE, 2);
    const etat = etatDeTest({
      mains: [[a], [carte('bleu', TYPES.NOMBRE, 9)], [carte(null, TYPES.PLUS4)]],
      sommet,
    });
    const fin = appliquerAction(etat, 0, jouer(a.id), 1);
    expect(fin.statut).toBe('terminee');
    expect(fin.gagnant).toBe(0);
    expect(calculerRangs(fin)).toEqual([1, 2, 3]);
    expect(() => appliquerAction(fin, 1, PIOCHER, 2)).toThrow('La partie est terminée.');
  });
});

describe('Pioche vide', () => {
  it('remélange la défausse en gardant la carte du dessus', () => {
    const sommet = carte('rouge', TYPES.NOMBRE, 1);
    const dessous = remplissage(4);
    const etat = etatDeTest({ mains: [remplissage(), remplissage()], sommet, autresDefausse: dessous, pioche: [] });
    const apres = appliquerAction(etat, 0, PIOCHER, 1, creerAleatoire(7));
    expect(apres.defausse).toEqual([sommet]);
    expect(apres.pioche).toHaveLength(3);
    expect(apres.joueurs[0].main).toHaveLength(4);
  });

  it("s'il n'y a plus aucune carte et que personne ne peut jouer, la partie s'arrête aux points", () => {
    const sommet = carte('rouge', TYPES.NOMBRE, 1);
    let etat = etatDeTest({
      mains: [[carte('bleu', TYPES.NOMBRE, 9)], [carte('bleu', TYPES.NOMBRE, 2)]],
      sommet,
    });
    for (let tour = 1; etat.statut === 'en_cours'; tour++) {
      etat = appliquerAction(etat, etat.joueurCourant, PIOCHER, tour);
      expect(tour).toBeLessThan(10);
    }
    expect(etat.finParBlocage).toBe(true);
    expect(etat.gagnant).toBe(1);
  });
});

describe('Contrôles de sécurité', () => {
  const a = carte('rouge', TYPES.NOMBRE, 2);
  const etat = etatDeTest({
    mains: [
      [a, ...remplissage()],
      [carte('rouge', TYPES.NOMBRE, 4), ...remplissage()],
    ],
    sommet: carte('rouge', TYPES.NOMBRE, 1),
  });

  it("refuse de jouer quand ce n'est pas son tour", () => {
    expect(() => appliquerAction(etat, 1, PIOCHER, 1)).toThrow("Ce n'est pas votre tour.");
  });

  it('refuse un numéro de tour périmé (double clic)', () => {
    const apres = appliquerAction(etat, 0, jouer(a.id), 1);
    expect(() => appliquerAction(apres, 1, PIOCHER, 1)).toThrow('Numéro de tour périmé.');
  });

  it("refuse une carte qui n'est pas dans la main", () => {
    expect(() => appliquerAction(etat, 0, jouer(99999), 1)).toThrow("Cette carte n'est pas dans votre main.");
    expect(() => appliquerAction(etat, 0, { type: 'tricher' }, 1)).toThrow('Action inconnue.');
  });

  it("ne modifie jamais l'état reçu", () => {
    const copie = structuredClone(etat);
    appliquerAction(etat, 0, jouer(a.id), 1);
    appliquerAction(etat, 0, PIOCHER, 1);
    expect(etat).toEqual(copie);
  });

  it('la vue publique cache la main des adversaires', () => {
    const vue = vuePublique(etat, 0);
    expect(vue.main).toHaveLength(4);
    expect(vue.joueurs[1]).toEqual({ nom: 'J1', nbCartes: 4 });
    expect(vue.coupsJouables).toEqual([a.id]);
    expect(JSON.stringify(vue)).not.toContain(String(etat.joueurs[1].main[0].id) + ',"couleur"');
    expect(vuePublique(etat, 1).coupsJouables).toEqual([]);
  });
});

describe('Simulation', () => {
  it('100 parties entre 4 bots faciles se terminent toutes sans erreur', () => {
    for (let graine = 1; graine <= 100; graine++) {
      const aleatoire = creerAleatoire(graine);
      let etat = creerPartie({ noms: ['A', 'B', 'C', 'D'], aleatoire });
      let coups = 0;
      while (etat.statut === 'en_cours') {
        const i = etat.joueurCourant;
        etat = appliquerAction(etat, i, choisirActionFacile(etat, i, aleatoire), etat.numeroTour, aleatoire);
        coups++;
        expect(coups).toBeLessThan(5000);
      }
      const total = etat.joueurs.reduce((n, j) => n + j.main.length, 0) + etat.pioche.length + etat.defausse.length;
      expect(total).toBe(108); // aucune carte perdue ni dupliquée
    }
  });
});
