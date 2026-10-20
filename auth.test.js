import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { preparer, inscrire, inscrireAdmin, SECRET } from './outils.js';
import { trouverPourConnexion } from '../../server/db/dao.js';

describe('API — authentification', () => {
  let ctx;
  beforeAll(async () => (ctx = await preparer()));

  it('inscrit un joueur et renvoie un jeton', async () => {
    const res = await ctx.api
      .post('/api/auth/inscription')
      .send({ courriel: 'Ivan@Exemple.ca', nomUtilisateur: 'ivan', motDePasse: 'chroma2026' });
    expect(res.status).toBe(201);
    expect(res.body.utilisateur).toMatchObject({ courriel: 'ivan@exemple.ca', nomUtilisateur: 'ivan', role: 'joueur' });
    expect(jwt.verify(res.body.jeton, SECRET).sub).toBe(String(res.body.utilisateur.id));
    expect(res.body.utilisateur).not.toHaveProperty('mot_de_passe_hache');
  });

  it('hache le mot de passe avec bcrypt', async () => {
    const u = await trouverPourConnexion(ctx.db, 'ivan');
    expect(u.mot_de_passe_hache).toMatch(/^\$2[aby]\$10\$/);
    expect(u.mot_de_passe_hache).not.toContain('chroma2026');
    expect(await bcrypt.compare('chroma2026', u.mot_de_passe_hache)).toBe(true);
  });

  it('refuse un formulaire invalide avec le détail des erreurs', async () => {
    const res = await ctx.api
      .post('/api/auth/inscription')
      .send({ courriel: 'pas-un-courriel', nomUtilisateur: 'a', motDePasse: 'court' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details).sort()).toEqual(['courriel', 'motDePasse', 'nomUtilisateur']);
  });

  it('refuse un courriel ou un nom déjà pris', async () => {
    const res = await ctx.api
      .post('/api/auth/inscription')
      .send({ courriel: 'ivan@exemple.ca', nomUtilisateur: 'autre', motDePasse: 'chroma2026' });
    expect(res.status).toBe(409);
  });

  it('connecte avec le courriel ou le nom d’utilisateur', async () => {
    for (const identifiant of ['ivan@exemple.ca', 'IVAN']) {
      const res = await ctx.api.post('/api/auth/connexion').send({ identifiant, motDePasse: 'chroma2026' });
      expect(res.status).toBe(200);
      expect(res.body.jeton).toBeTruthy();
    }
  });

  it('refuse un mauvais mot de passe avec un message générique', async () => {
    const a = await ctx.api.post('/api/auth/connexion').send({ identifiant: 'ivan', motDePasse: 'mauvais123' });
    const b = await ctx.api.post('/api/auth/connexion').send({ identifiant: 'inconnu', motDePasse: 'mauvais123' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.erreur).toBe(b.body.erreur);
  });

  it('protège les routes : sans jeton, jeton falsifié ou expiré → 401', async () => {
    expect((await ctx.api.get('/api/auth/moi')).status).toBe(401);
    const faux = jwt.sign({ sub: '1', role: 'admin' }, 'autre-secret');
    expect((await ctx.api.get('/api/auth/moi').set('Authorization', `Bearer ${faux}`)).status).toBe(401);
    const expire = jwt.sign({ sub: '1' }, SECRET, { expiresIn: -10 });
    expect((await ctx.api.get('/api/auth/moi').set('Authorization', `Bearer ${expire}`)).status).toBe(401);
  });

  it('renvoie le profil avec un jeton valide', async () => {
    const { entete, utilisateur } = await inscrire(ctx.api);
    const res = await ctx.api.get('/api/auth/moi').set('Authorization', entete);
    expect(res.status).toBe(200);
    expect(res.body.utilisateur.id).toBe(utilisateur.id);
  });

  it('réserve les routes admin aux administrateurs', async () => {
    const joueur = await inscrire(ctx.api);
    const admin = await inscrireAdmin(ctx.api, ctx.db);
    expect((await ctx.api.get('/api/admin/utilisateurs').set('Authorization', joueur.entete)).status).toBe(403);
    expect((await ctx.api.get('/api/admin/utilisateurs').set('Authorization', admin.entete)).status).toBe(200);
  });

  it('un compte désactivé est bloqué immédiatement, même avec un jeton valide', async () => {
    const joueur = await inscrire(ctx.api);
    const admin = await inscrireAdmin(ctx.api, ctx.db);
    const res = await ctx.api
      .patch(`/api/admin/utilisateurs/${joueur.utilisateur.id}`)
      .set('Authorization', admin.entete)
      .send({ actif: false });
    expect(res.status).toBe(200);
    expect((await ctx.api.get('/api/auth/moi').set('Authorization', joueur.entete)).status).toBe(403);
    const connexion = await ctx.api
      .post('/api/auth/connexion')
      .send({ identifiant: joueur.utilisateur.courriel, motDePasse: 'motdepasse1' });
    expect(connexion.status).toBe(403);
  });

  it('un admin ne peut pas désactiver son propre compte', async () => {
    const admin = await inscrireAdmin(ctx.api, ctx.db);
    const res = await ctx.api
      .patch(`/api/admin/utilisateurs/${admin.utilisateur.id}`)
      .set('Authorization', admin.entete)
      .send({ actif: false });
    expect(res.status).toBe(409);
  });

  it('limite les tentatives de connexion répétées', async () => {
    const { creerApp } = await import('../../server/app.js');
    const request = (await import('supertest')).default;
    const app = creerApp({ db: ctx.db, secret: SECRET, limiteAuth: 3 });
    const codes = [];
    for (let i = 0; i < 5; i++) {
      codes.push((await request(app).post('/api/auth/connexion').send({ identifiant: 'x', motDePasse: 'y' })).status);
    }
    expect(codes).toEqual([401, 401, 401, 429, 429]);
  });
});
