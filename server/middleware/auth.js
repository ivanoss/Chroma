import { verifierJeton } from '../services/auth.js';
import { trouverUtilisateur } from '../db/dao.js';
import { nonAuthentifie, interdit } from '../erreurs.js';

// Vérifie le jeton « Authorization: Bearer ... » et charge l'utilisateur.
// On relit l'utilisateur en base à chaque requête : un compte désactivé par
// l'administrateur est bloqué immédiatement, même avec un jeton encore valide.
export function authentifier({ db, secret }) {
  return async (req, _res, next) => {
    try {
      const entete = req.get('authorization') ?? '';
      const [schema, jeton] = entete.split(' ');
      if (schema !== 'Bearer' || !jeton) throw nonAuthentifie();
      const { sub } = verifierJeton(jeton, secret);
      const utilisateur = await trouverUtilisateur(db, Number(sub));
      if (!utilisateur) throw nonAuthentifie();
      if (!utilisateur.actif) throw interdit('Ce compte a été désactivé.');
      req.utilisateur = utilisateur;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function exigerRole(role) {
  return (req, _res, next) => {
    if (req.utilisateur?.role !== role) return next(interdit('Réservé aux administrateurs.'));
    next();
  };
}

// Limiteur très simple en mémoire, pour freiner les essais de mots de passe.
export function limiterDebit({ fenetreMs = 60_000, max = 20 } = {}) {
  const essais = new Map();
  return (req, res, next) => {
    const cle = req.ip;
    const maintenant = Date.now();
    const entree = essais.get(cle);
    if (!entree || maintenant - entree.debut > fenetreMs) {
      essais.set(cle, { debut: maintenant, n: 1 });
      return next();
    }
    entree.n++;
    if (entree.n > max) {
      res.set('Retry-After', String(Math.ceil((entree.debut + fenetreMs - maintenant) / 1000)));
      return res.status(429).json({ erreur: 'Trop de tentatives. Réessayez dans une minute.' });
    }
    next();
  };
}
