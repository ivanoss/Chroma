// Générateur pseudo-aléatoire à graine (mulberry32).
// L'état du générateur est sauvegardé avec la partie : en repartant de la même
// graine et des mêmes coups, on retrouve exactement la même partie (rejeu).

export function creerAleatoire(graine) {
  let a = graine >>> 0;
  const aleatoire = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  aleatoire.etat = () => a;
  return aleatoire;
}

export function nouvelleGraine() {
  return Math.floor(Math.random() * 2 ** 32);
}
