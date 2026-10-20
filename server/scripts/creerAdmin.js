// Crée un compte administrateur, ou donne le rôle admin à un compte existant.
// Usage : npm run creer-admin -- <courriel> <nom_utilisateur> <mot_de_passe>
import { ouvrirBase } from '../db/connexion.js';
import { inscrire } from '../services/auth.js';
import { trouverPourConnexion, changerRole } from '../db/dao.js';

const [courriel, nomUtilisateur, motDePasse] = process.argv.slice(2);
if (!courriel) {
  console.log('Usage : npm run creer-admin -- <courriel> <nom_utilisateur> <mot_de_passe>');
  process.exit(1);
}

const db = await ouvrirBase();
try {
  const existant = await trouverPourConnexion(db, courriel);
  if (existant) {
    await changerRole(db, existant.id, 'admin');
    console.log(`${existant.nom_utilisateur} est maintenant administrateur.`);
  } else {
    const { utilisateur } = await inscrire(db, 'inutile-ici', { courriel, nomUtilisateur, motDePasse }, 'admin');
    console.log(`Administrateur créé : ${utilisateur.nomUtilisateur}`);
  }
} catch (err) {
  console.error(err.message, err.details ?? '');
  process.exitCode = 1;
} finally {
  await db.fermer();
}
