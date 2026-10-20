// Session côté navigateur : on ne garde que le jeton et le profil.
// L'état d'une partie n'est jamais conservé ici : il est redemandé au serveur.
const CLE = 'chroma.session';

let session = null;
try {
  session = JSON.parse(localStorage.getItem(CLE));
} catch {
  session = null;
}

export function obtenirSession() {
  return session;
}

export function ouvrirSession(jeton, utilisateur) {
  session = { jeton, utilisateur };
  try {
    localStorage.setItem(CLE, JSON.stringify(session));
  } catch {
    /* stockage indisponible : la session ne durera que le temps de l'onglet */
  }
}

export function fermerSession() {
  session = null;
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
}

export const estConnecte = () => Boolean(session?.jeton);
export const estAdmin = () => session?.utilisateur?.role === 'admin';
