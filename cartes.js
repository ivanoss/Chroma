// Référentiel des cartes de Chroma : 108 cartes, 4 couleurs.
// Ce module ne dépend ni d'Express ni de la base de données.

export const COULEURS = ['rouge', 'jaune', 'vert', 'bleu'];

export const TYPES = Object.freeze({
  NOMBRE: 'nombre',
  INVERSION: 'inversion',
  PASSE: 'passe',
  PLUS2: 'plus2',
  COULEUR: 'couleur',
  PLUS4: 'plus4',
});

// Valeur en points des cartes spéciales (les chiffres valent leur valeur).
export const POINTS = Object.freeze({
  [TYPES.INVERSION]: 20,
  [TYPES.PASSE]: 20,
  [TYPES.PLUS2]: 20,
  [TYPES.COULEUR]: 50,
  [TYPES.PLUS4]: 50,
});

export function construirePaquet() {
  const paquet = [];
  let id = 1;
  const ajouter = (couleur, type, valeur = null) => {
    const points = type === TYPES.NOMBRE ? valeur : POINTS[type];
    paquet.push({ id: id++, couleur, type, valeur, points });
  };

  for (const couleur of COULEURS) {
    ajouter(couleur, TYPES.NOMBRE, 0);
    for (let v = 1; v <= 9; v++) {
      ajouter(couleur, TYPES.NOMBRE, v);
      ajouter(couleur, TYPES.NOMBRE, v);
    }
    for (const type of [TYPES.INVERSION, TYPES.PASSE, TYPES.PLUS2]) {
      ajouter(couleur, type);
      ajouter(couleur, type);
    }
  }
  for (let i = 0; i < 4; i++) {
    ajouter(null, TYPES.COULEUR);
    ajouter(null, TYPES.PLUS4);
  }
  return paquet;
}

// Le paquet de référence : sert à retrouver une carte à partir de son id
// (même numérotation que la table `cartes`).
export const PAQUET_REFERENCE = Object.freeze(construirePaquet().map((c) => Object.freeze(c)));
const PAR_ID = new Map(PAQUET_REFERENCE.map((c) => [c.id, c]));

export function carteParId(id) {
  return PAR_ID.get(id) ?? null;
}

export function estJoker(carte) {
  return carte.type === TYPES.COULEUR || carte.type === TYPES.PLUS4;
}

// Mélange de Fisher-Yates. `aleatoire` est injectable pour les tests et le rejeu.
export function melanger(cartes, aleatoire = Math.random) {
  const copie = [...cartes];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(aleatoire() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}
