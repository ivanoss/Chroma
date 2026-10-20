// Point d'entrée : ouvre la base et démarre le serveur HTTP.
import { randomBytes } from 'node:crypto';
import { ouvrirBase } from './db/connexion.js';
import { creerApp } from './app.js';
import { inscrire } from './services/auth.js';
import { trouverPourConnexion, changerRole } from './db/dao.js';

// Sur un hébergeur sans terminal, le compte administrateur se crée au démarrage
// à partir de ADMIN_COURRIEL, ADMIN_NOM et ADMIN_MOT_DE_PASSE (s'ils sont définis).
async function assurerAdmin(db) {
  const { ADMIN_COURRIEL: courriel, ADMIN_NOM: nomUtilisateur, ADMIN_MOT_DE_PASSE: motDePasse } = process.env;
  if (!courriel || !nomUtilisateur || !motDePasse) return;
  try {
    const existant = await trouverPourConnexion(db, courriel);
    if (existant) {
      if (existant.role !== 'admin') await changerRole(db, existant.id, 'admin');
    } else {
      await inscrire(db, 'inutilise', { courriel, nomUtilisateur, motDePasse }, 'admin');
      console.log(`Compte administrateur créé : ${nomUtilisateur}`);
    }
  } catch (err) {
    console.error('Impossible de créer le compte administrateur :', err.message, err.details ?? '');
  }
}

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
await assurerAdmin(db);
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
