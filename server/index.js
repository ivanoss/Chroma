// Point d'entrée : ouvre la base et démarre le serveur HTTP.
import { randomBytes } from 'node:crypto';
import { ouvrirBase } from './db/connexion.js';
import { creerApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const PRODUCTION = process.env.NODE_ENV === 'production';

let secret = process.env.JWT_SECRET;
if (!secret) {
  if (PRODUCTION) {
    console.error('JWT_SECRET est obligatoire en production.');
    process.exit(1);
  }
  secret = randomBytes(32).toString('hex');
  console.warn('JWT_SECRET absent : secret temporaire généré (les sessions seront perdues au redémarrage).');
}

const db = await ouvrirBase();
const app = creerApp({ db, secret, journaliser: !PRODUCTION });

const serveur = app.listen(PORT, () => {
  console.log(`Chroma : http://localhost:${PORT}  (base : ${db.dialecte})`);
});

const arreter = async () => {
  serveur.close();
  await db.fermer();
  process.exit(0);
};
process.on('SIGINT', arreter);
process.on('SIGTERM', arreter);
