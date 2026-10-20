import request from 'supertest';
import { ouvrirBase } from '../../server/db/connexion.js';
import { creerApp } from '../../server/app.js';
import { changerRole, trouverPourConnexion } from '../../server/db/dao.js';

export const SECRET = 'secret-de-test';

export async function preparer(options = {}) {
  const db = await ouvrirBase({ fichier: ':memory:', ...options });
  const app = creerApp({ db, secret: SECRET, limiteAuth: 1000 });
  return { db, app, api: request(app) };
}

let compteur = 0;
export async function inscrire(api, prefixe = 'joueur') {
  compteur++;
  const nom = `${prefixe}${compteur}`;
  const res = await api
    .post('/api/auth/inscription')
    .send({ courriel: `${nom}@exemple.ca`, nomUtilisateur: nom, motDePasse: 'motdepasse1' });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return { jeton: res.body.jeton, utilisateur: res.body.utilisateur, entete: `Bearer ${res.body.jeton}` };
}

export async function inscrireAdmin(api, db) {
  const compte = await inscrire(api, 'admin');
  const u = await trouverPourConnexion(db, compte.utilisateur.courriel);
  await changerRole(db, u.id, 'admin');
  return compte;
}

// Choisit un coup simple : la première carte jouable, sinon piocher.
export function coupSimple(vue) {
  const id = vue.coupsJouables[0];
  if (!id) return { type: 'piocher' };
  const carte = vue.main.find((c) => c.id === id);
  return {
    type: 'jouer',
    idCarte: id,
    couleurChoisie: carte.couleur ? undefined : 'rouge',
    derniereCarte: vue.main.length === 2,
  };
}

export async function jouerJusquALaFin(api, entete, id, vueInitiale) {
  let vue = vueInitiale;
  let coups = 0;
  while (vue.statut === 'en_cours') {
    const res = await api
      .post(`/api/parties/${id}/coups`)
      .set('Authorization', entete)
      .send({ action: coupSimple(vue), numeroTour: vue.numeroTour });
    if (res.status !== 200) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
    vue = res.body.vue;
    if (++coups > 2000) throw new Error('Partie trop longue');
  }
  return vue;
}
