// Appels réseau vers l'API REST. Toutes les requêtes passent par ici.
import { obtenirSession, fermerSession } from './session.js';

export class ErreurApi extends Error {
  constructor(statut, corps) {
    super(corps?.erreur ?? `Erreur ${statut}`);
    this.statut = statut;
    this.details = corps?.details;
  }
}

async function requete(methode, chemin, corps) {
  const entetes = { Accept: 'application/json' };
  const jeton = obtenirSession()?.jeton;
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';

  let reponse;
  try {
    reponse = await fetch(`/api${chemin}`, {
      method: methode,
      headers: entetes,
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch {
    throw new ErreurApi(0, { erreur: 'Serveur injoignable. Vérifiez votre connexion.' });
  }

  const donnees = reponse.status === 204 ? null : await reponse.json().catch(() => null);
  if (!reponse.ok) {
    // Jeton expiré ou compte désactivé : on renvoie vers la connexion.
    if ((reponse.status === 401 || reponse.status === 403) && jeton && !chemin.startsWith('/auth/')) {
      if (reponse.status === 401 || donnees?.erreur?.includes('désactivé')) {
        fermerSession();
        window.location.hash = '#/connexion';
      }
    }
    throw new ErreurApi(reponse.status, donnees);
  }
  return donnees;
}

export const api = {
  inscription: (donnees) => requete('POST', '/auth/inscription', donnees),
  connexion: (identifiant, motDePasse) => requete('POST', '/auth/connexion', { identifiant, motDePasse }),
  deconnexion: () => requete('POST', '/auth/deconnexion'),
  moi: () => requete('GET', '/auth/moi'),

  nouvellePartie: (difficulte, nbBots) => requete('POST', '/parties', { difficulte, nbBots }),
  partieEnCours: () => requete('GET', '/parties/en-cours'),
  partie: (id) => requete('GET', `/parties/${id}`),
  jouer: (id, action, numeroTour) => requete('POST', `/parties/${id}/coups`, { action, numeroTour }),
  abandonner: (id) => requete('POST', `/parties/${id}/abandon`),
  supprimer: (id) => requete('DELETE', `/parties/${id}`),
  historique: (filtres = {}) => {
    const q = new URLSearchParams(Object.entries(filtres).filter(([, v]) => v));
    return requete('GET', `/parties${q.size ? `?${q}` : ''}`);
  },
  rejeu: (id) => requete('GET', `/parties/${id}/rejeu`),

  mesStats: () => requete('GET', '/stats/moi'),
  classement: () => requete('GET', '/stats/classement'),

  adminUtilisateurs: () => requete('GET', '/admin/utilisateurs'),
  adminActiver: (id, actif) => requete('PATCH', `/admin/utilisateurs/${id}`, { actif }),
  adminParties: () => requete('GET', '/admin/parties'),
  adminPurger: () => requete('DELETE', '/admin/parties/abandonnees'),
};
