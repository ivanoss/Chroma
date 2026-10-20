// Authentification : inscription, connexion, jetons JWT.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dao from '../db/dao.js';
import { requeteInvalide, conflit, nonAuthentifie, interdit } from '../erreurs.js';

const COUT_BCRYPT = 10;
const DUREE_JETON = '7d';
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOM = /^[\p{L}\p{N}_.-]{3,20}$/u;

export function publicUtilisateur(u) {
  return {
    id: u.id,
    courriel: u.courriel,
    nomUtilisateur: u.nom_utilisateur,
    role: u.role,
    actif: Boolean(u.actif),
    dateInscription: u.date_inscription,
  };
}

export function validerInscription({ courriel, nomUtilisateur, motDePasse } = {}) {
  const erreurs = {};
  if (typeof courriel !== 'string' || !COURRIEL.test(courriel.trim())) {
    erreurs.courriel = 'Adresse courriel invalide.';
  }
  if (typeof nomUtilisateur !== 'string' || !NOM.test(nomUtilisateur.trim())) {
    erreurs.nomUtilisateur = '3 à 20 caractères : lettres, chiffres, « _ », « - » ou « . ».';
  }
  if (typeof motDePasse !== 'string' || motDePasse.length < 8 || motDePasse.length > 72) {
    erreurs.motDePasse = 'Le mot de passe doit contenir entre 8 et 72 caractères.';
  } else if (!/\d/.test(motDePasse) || !/\p{L}/u.test(motDePasse)) {
    erreurs.motDePasse = 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  return erreurs;
}

export function signerJeton(utilisateur, secret) {
  return jwt.sign({ sub: String(utilisateur.id), role: utilisateur.role }, secret, {
    expiresIn: DUREE_JETON,
  });
}

export async function inscrire(db, secret, donnees, role = 'joueur') {
  const erreurs = validerInscription(donnees);
  if (Object.keys(erreurs).length) {
    const err = requeteInvalide('Formulaire invalide.');
    err.details = erreurs;
    throw err;
  }
  const courriel = donnees.courriel.trim().toLowerCase();
  const nomUtilisateur = donnees.nomUtilisateur.trim();
  if (await dao.utilisateurExiste(db, courriel, nomUtilisateur)) {
    throw conflit('Ce courriel ou ce nom d’utilisateur est déjà pris.');
  }
  const motDePasseHache = await bcrypt.hash(donnees.motDePasse, COUT_BCRYPT);
  const utilisateur = await dao.creerUtilisateur(db, { courriel, nomUtilisateur, motDePasseHache, role });
  return { jeton: signerJeton(utilisateur, secret), utilisateur: publicUtilisateur(utilisateur) };
}

export async function connecter(db, secret, { identifiant, motDePasse } = {}) {
  if (typeof identifiant !== 'string' || typeof motDePasse !== 'string' || !identifiant || !motDePasse) {
    throw requeteInvalide('Identifiant et mot de passe requis.');
  }
  const u = await dao.trouverPourConnexion(db, identifiant.trim());
  // Même message que le compte existe ou non : on ne révèle pas quels comptes existent.
  const ok = u && (await bcrypt.compare(motDePasse, u.mot_de_passe_hache));
  if (!ok) throw nonAuthentifie('Identifiant ou mot de passe incorrect.');
  if (!u.actif) throw interdit('Ce compte a été désactivé.');
  return { jeton: signerJeton(u, secret), utilisateur: publicUtilisateur(u) };
}

export function verifierJeton(jeton, secret) {
  try {
    return jwt.verify(jeton, secret);
  } catch {
    throw nonAuthentifie('Session expirée ou invalide.');
  }
}
