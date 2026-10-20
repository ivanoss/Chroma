// Fabrique de l'application Express (utilisée par le serveur et par les tests).
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerRoutes } from './routes.js';
import { ErreurHttp } from './erreurs.js';
import { CoupIllegal } from './moteur/moteur.js';

const DOSSIER_CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..', 'client');

function entetesSecurite(_req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:",
  });
  next();
}

export function creerApp({ db, secret, journaliser = false, limiteAuth } = {}) {
  if (!db) throw new Error('creerApp : base de données manquante.');
  if (!secret) throw new Error('creerApp : secret JWT manquant.');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(entetesSecurite);
  app.use(express.json({ limit: '20kb' }));

  if (journaliser) {
    app.use('/api', (req, res, next) => {
      const debut = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - debut}ms`));
      next();
    });
  }

  app.use('/api', creerRoutes({ db, secret, limiteAuth }));
  app.use('/api', (_req, res) => res.status(404).json({ erreur: 'Route inconnue.' }));

  app.use(express.static(DOSSIER_CLIENT, { extensions: ['html'] }));
  // Application d'une seule page : toute autre URL renvoie index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(DOSSIER_CLIENT, 'index.html')));

  // Gestionnaire d'erreurs : traduit les erreurs en réponses JSON (Express exige 4 paramètres).
  app.use((err, _req, res, _next) => {
    if (err instanceof CoupIllegal) {
      const statut = err.message === 'Numéro de tour périmé.' ? 409 : 400;
      return res.status(statut).json({ erreur: err.message });
    }
    if (err instanceof ErreurHttp) {
      return res.status(err.statut).json({ erreur: err.message, ...(err.details ? { details: err.details } : {}) });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erreur: 'JSON invalide.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ erreur: 'Requête trop volumineuse.' });
    console.error(err);
    res.status(500).json({ erreur: 'Erreur interne du serveur.' });
  });

  return app;
}
