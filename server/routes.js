// Routes REST de l'API Chroma.
import { Router } from 'express';
import * as auth from './services/auth.js';
import * as parties from './services/parties.js';
import * as dao from './db/dao.js';
import { authentifier, exigerRole, limiterDebit } from './middleware/auth.js';
import { requeteInvalide, conflit, nonTrouve } from './erreurs.js';

// Petit utilitaire : transmet les erreurs des fonctions async au gestionnaire d'erreurs.
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw requeteInvalide('Identifiant invalide.');
  return id;
};

function statsPubliques(s) {
  const jouees = Number(s.parties_jouees);
  return {
    partiesJouees: jouees,
    partiesGagnees: Number(s.parties_gagnees),
    tauxVictoire: jouees ? Number(s.parties_gagnees) / jouees : 0,
    cartesJouees: Number(s.cartes_jouees),
    dureeMoyenneSec: jouees ? Math.round(Number(s.duree_totale_sec) / jouees) : 0,
    meilleureSerie: Number(s.meilleure_serie),
    serieActuelle: s.serie_actuelle === undefined ? undefined : Number(s.serie_actuelle),
  };
}

export function creerRoutes({ db, secret, limiteAuth = 20 }) {
  const r = Router();
  const connecte = authentifier({ db, secret });
  const admin = [connecte, exigerRole('admin')];
  const limiteur = limiterDebit({ max: limiteAuth });

  // ---- Authentification ---------------------------------------------------
  r.post(
    '/auth/inscription',
    limiteur,
    route(async (req, res) => res.status(201).json(await auth.inscrire(db, secret, req.body))),
  );
  r.post(
    '/auth/connexion',
    limiteur,
    route(async (req, res) => res.json(await auth.connecter(db, secret, req.body))),
  );
  // Le jeton est sans état : se déconnecter = le client oublie son jeton.
  r.post('/auth/deconnexion', (_req, res) => res.status(204).end());
  r.get('/auth/moi', connecte, (req, res) => res.json({ utilisateur: auth.publicUtilisateur(req.utilisateur) }));

  // ---- Parties --------------------------------------------------------------
  r.get(
    '/parties',
    connecte,
    route(async (req, res) => {
      const { statut, difficulte, resultat } = req.query;
      const lignes = await dao.historique(db, req.utilisateur.id, { statut, difficulte, resultat });
      res.json({
        parties: lignes.map((p) => ({
          id: p.id,
          difficulte: p.difficulte_bot,
          nbJoueurs: p.nb_joueurs,
          statut: p.statut,
          dateDebut: p.date_debut,
          dateFin: p.date_fin,
          rang: p.rang_final,
          victoire: p.statut === 'terminee' && p.rang_final === 1,
          nbCoups: Number(p.nb_coups),
          cartesJouees: Number(p.cartes_jouees),
        })),
      });
    }),
  );
  r.post(
    '/parties',
    connecte,
    route(async (req, res) => res.status(201).json(await parties.nouvellePartie(db, req.utilisateur, req.body))),
  );
  r.get(
    '/parties/en-cours',
    connecte,
    route(async (req, res) => res.json((await parties.partieEnCours(db, req.utilisateur)) ?? { partie: null })),
  );
  r.get(
    '/parties/:id',
    connecte,
    route(async (req, res) => res.json(await parties.obtenirPartie(db, req.utilisateur, idParam(req)))),
  );
  r.post(
    '/parties/:id/coups',
    connecte,
    route(async (req, res) => res.json(await parties.jouerCoup(db, req.utilisateur, idParam(req), req.body ?? {}))),
  );
  r.post(
    '/parties/:id/abandon',
    connecte,
    route(async (req, res) => res.json(await parties.abandonner(db, req.utilisateur, idParam(req)))),
  );
  r.delete(
    '/parties/:id',
    connecte,
    route(async (req, res) => {
      await parties.supprimer(db, req.utilisateur, idParam(req));
      res.status(204).end();
    }),
  );
  r.get(
    '/parties/:id/rejeu',
    connecte,
    route(async (req, res) => res.json(await parties.rejeu(db, req.utilisateur, idParam(req)))),
  );

  // ---- Statistiques ---------------------------------------------------------
  r.get(
    '/stats/moi',
    connecte,
    route(async (req, res) => res.json({ stats: statsPubliques(await dao.lireStatistiques(db, req.utilisateur.id)) })),
  );
  r.get(
    '/stats/classement',
    route(async (_req, res) => {
      const lignes = await dao.classement(db);
      res.json({
        classement: lignes.map((l, i) => ({
          rang: i + 1,
          nomUtilisateur: l.nom_utilisateur,
          ...statsPubliques({ ...l, serie_actuelle: undefined }),
        })),
      });
    }),
  );

  // ---- Administration -------------------------------------------------------
  r.get(
    '/admin/utilisateurs',
    admin,
    route(async (_req, res) => {
      const lignes = await dao.listerUtilisateurs(db);
      res.json({
        utilisateurs: lignes.map((u) => ({
          ...auth.publicUtilisateur(u),
          partiesJouees: Number(u.parties_jouees ?? 0),
          partiesGagnees: Number(u.parties_gagnees ?? 0),
          partiesEnCours: Number(u.parties_en_cours ?? 0),
        })),
      });
    }),
  );
  r.patch(
    '/admin/utilisateurs/:id',
    admin,
    route(async (req, res) => {
      const id = idParam(req);
      if (typeof req.body?.actif !== 'boolean') throw requeteInvalide('Le champ « actif » doit être vrai ou faux.');
      if (id === req.utilisateur.id) throw conflit('Vous ne pouvez pas désactiver votre propre compte.');
      const cible = await dao.trouverUtilisateur(db, id);
      if (!cible) throw nonTrouve('Utilisateur introuvable.');
      await dao.changerActif(db, id, req.body.actif);
      res.json({ utilisateur: auth.publicUtilisateur(await dao.trouverUtilisateur(db, id)) });
    }),
  );
  r.get(
    '/admin/parties',
    admin,
    route(async (_req, res) => {
      const lignes = await dao.listerToutesParties(db);
      res.json({
        parties: lignes.map((p) => ({
          id: p.id,
          joueur: p.nom_utilisateur,
          difficulte: p.difficulte_bot,
          nbJoueurs: p.nb_joueurs,
          statut: p.statut,
          dateDebut: p.date_debut,
          dateFin: p.date_fin,
          nbCoups: Number(p.nb_coups),
        })),
      });
    }),
  );
  r.delete(
    '/admin/parties/abandonnees',
    admin,
    route(async (_req, res) => {
      const { changements } = await dao.purgerAbandonnees(db);
      res.json({ supprimees: changements });
    }),
  );

  return r;
}
