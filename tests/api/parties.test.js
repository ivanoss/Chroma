import { describe, it, expect, beforeAll } from 'vitest';
import { preparer, inscrire, inscrireAdmin, jouerJusquALaFin, coupSimple } from './outils.js';
import * as dao from '../../server/db/dao.js';
import { reconstruirePartie } from '../../server/services/parties.js';

describe('API — parties', () => {
  let ctx;
  beforeAll(async () => (ctx = await preparer()));

  const creer = (entete, corps = { difficulte: 'facile', nbBots: 3 }) =>
    ctx.api.post('/api/parties').set('Authorization', entete).send(corps);

  it('crée une partie et ne révèle jamais la main des bots', async () => {
    const { entete } = await inscrire(ctx.api);
    const res = await creer(entete);
    expect(res.status).toBe(201);
    const { vue, partie } = res.body;
    expect(partie.participants).toHaveLength(4);
    expect(vue.main).toHaveLength(7);
    expect(vue.joueurs.slice(1).every((j) => j.nbCartes === 7 && !('main' in j))).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('etatAleatoire');
    expect(JSON.stringify(res.body)).not.toContain('pioche"');
  });

  it('valide la difficulté et le nombre de bots', async () => {
    const { entete } = await inscrire(ctx.api);
    expect((await creer(entete, { difficulte: 'impossible' })).status).toBe(400);
    expect((await creer(entete, { difficulte: 'facile', nbBots: 5 })).status).toBe(400);
  });

  it("n'autorise qu'une partie en cours à la fois, et permet de la reprendre", async () => {
    const { entete } = await inscrire(ctx.api);
    const premiere = await creer(entete);
    expect((await creer(entete)).status).toBe(409);
    const reprise = await ctx.api.get('/api/parties/en-cours').set('Authorization', entete);
    expect(reprise.body.partie.id).toBe(premiere.body.partie.id);
    expect(reprise.body.vue.main).toEqual(premiere.body.vue.main);
  });

  it('joue un coup : les bots répondent et les coups sont journalisés', async () => {
    const { entete } = await inscrire(ctx.api);
    const { body } = await creer(entete);
    const res = await ctx.api
      .post(`/api/parties/${body.partie.id}/coups`)
      .set('Authorization', entete)
      .send({ action: coupSimple(body.vue), numeroTour: body.vue.numeroTour });
    expect(res.status).toBe(200);
    expect(res.body.evenements[0].position).toBe(0);
    if (res.body.vue.statut === 'en_cours') expect(res.body.vue.joueurCourant).toBe(0);
    const coups = await dao.lireCoups(ctx.db, body.partie.id);
    expect(coups).toHaveLength(res.body.evenements.length);
  });

  it('refuse un double envoi du même coup (numéro de tour périmé)', async () => {
    const { entete } = await inscrire(ctx.api);
    const { body } = await creer(entete);
    const envoi = { action: { type: 'piocher' }, numeroTour: body.vue.numeroTour };
    const url = `/api/parties/${body.partie.id}/coups`;
    expect((await ctx.api.post(url).set('Authorization', entete).send(envoi)).status).toBe(200);
    const deuxieme = await ctx.api.post(url).set('Authorization', entete).send(envoi);
    expect(deuxieme.status).toBe(409);
    expect(deuxieme.body.erreur).toBe('Numéro de tour périmé.');
  });

  it('refuse un coup illégal ou une carte qui n’est pas dans la main', async () => {
    const { entete } = await inscrire(ctx.api);
    const { body } = await creer(entete);
    const url = `/api/parties/${body.partie.id}/coups`;
    const pasDansLaMain = await ctx.api
      .post(url)
      .set('Authorization', entete)
      .send({ action: { type: 'jouer', idCarte: 9999 }, numeroTour: body.vue.numeroTour });
    expect(pasDansLaMain.status).toBe(400);
    const illegale = body.vue.main.find((c) => !body.vue.coupsJouables.includes(c.id));
    if (illegale) {
      const res = await ctx.api
        .post(url)
        .set('Authorization', entete)
        .send({ action: { type: 'jouer', idCarte: illegale.id }, numeroTour: body.vue.numeroTour });
      expect(res.status).toBe(400);
    }
  });

  it("un joueur ne peut ni voir ni jouer la partie d'un autre", async () => {
    const a = await inscrire(ctx.api);
    const b = await inscrire(ctx.api);
    const { body } = await creer(a.entete);
    const id = body.partie.id;
    expect((await ctx.api.get(`/api/parties/${id}`).set('Authorization', b.entete)).status).toBe(404);
    const coup = await ctx.api
      .post(`/api/parties/${id}/coups`)
      .set('Authorization', b.entete)
      .send({ action: { type: 'piocher' }, numeroTour: 1 });
    expect(coup.status).toBe(404);
    expect((await ctx.api.post(`/api/parties/${id}/abandon`).set('Authorization', b.entete)).status).toBe(404);
  });

  it('joue une partie complète, met à jour les stats et le rejeu redonne exactement la même partie', async () => {
    const { entete, utilisateur } = await inscrire(ctx.api);
    const { body } = await creer(entete, { difficulte: 'difficile', nbBots: 2 });
    const id = body.partie.id;
    const fin = await jouerJusquALaFin(ctx.api, entete, id, body.vue);
    expect(fin.statut).toBe('terminee');
    expect(fin.rangs).toHaveLength(3);
    expect(fin.joueurs.slice(1).every((j) => Array.isArray(j.main))).toBe(true); // mains révélées à la fin

    const stats = await ctx.api.get('/api/stats/moi').set('Authorization', entete);
    expect(stats.body.stats.partiesJouees).toBe(1);
    expect(stats.body.stats.partiesGagnees).toBe(fin.gagnant === 0 ? 1 : 0);
    expect(stats.body.stats.cartesJouees).toBeGreaterThan(0);

    const histo = await ctx.api.get('/api/parties').set('Authorization', entete);
    expect(histo.body.parties[0]).toMatchObject({ id, statut: 'terminee', victoire: fin.gagnant === 0 });

    // Rejeu : reconstruit à partir de la graine et du journal, il doit retomber
    // exactement sur l'état sauvegardé.
    const rejeu = await ctx.api.get(`/api/parties/${id}/rejeu`).set('Authorization', entete);
    expect(rejeu.status).toBe(200);
    const derniere = rejeu.body.images.at(-1);
    const partie = await dao.lirePartie(ctx.db, id);
    expect(derniere.mains).toEqual(partie.etat.joueurs.map((j) => j.main.map((c) => c.id)));
    expect(rejeu.body.images[0].mains.every((m) => m.length === 7)).toBe(true);
    const { etat } = await reconstruirePartie(
      partie,
      await dao.lireParticipants(ctx.db, id),
      await dao.lireCoups(ctx.db, id),
    );
    expect(etat.gagnant).toBe(partie.etat.gagnant);
    expect(utilisateur.id).toBe(partie.utilisateur_id);
  }, 60000);

  it("le rejeu n'est pas disponible pendant la partie", async () => {
    const { entete } = await inscrire(ctx.api);
    const { body } = await creer(entete);
    expect((await ctx.api.get(`/api/parties/${body.partie.id}/rejeu`).set('Authorization', entete)).status).toBe(409);
  });

  it('abandonne une partie : compte comme une défaite et casse la série', async () => {
    const { entete } = await inscrire(ctx.api);
    const { body } = await creer(entete);
    const res = await ctx.api.post(`/api/parties/${body.partie.id}/abandon`).set('Authorization', entete);
    expect(res.status).toBe(200);
    expect(res.body.partie.statut).toBe('abandonnee');
    const stats = (await ctx.api.get('/api/stats/moi').set('Authorization', entete)).body.stats;
    expect(stats).toMatchObject({ partiesJouees: 1, partiesGagnees: 0, serieActuelle: 0 });
    // On peut ensuite relancer une partie.
    expect((await creer(entete)).status).toBe(201);
  });

  it("supprime une partie finie de l'historique, mais pas une partie en cours", async () => {
    const { entete } = await inscrire(ctx.api);
    const { body } = await creer(entete);
    const id = body.partie.id;
    expect((await ctx.api.delete(`/api/parties/${id}`).set('Authorization', entete)).status).toBe(409);
    await ctx.api.post(`/api/parties/${id}/abandon`).set('Authorization', entete);
    expect((await ctx.api.delete(`/api/parties/${id}`).set('Authorization', entete)).status).toBe(204);
    expect((await ctx.api.get(`/api/parties/${id}`).set('Authorization', entete)).status).toBe(404);
    expect(await dao.lireCoups(ctx.db, id)).toHaveLength(0); // les coups partent avec (ON DELETE CASCADE)
  });

  it("filtre l'historique par résultat et difficulté", async () => {
    const { entete } = await inscrire(ctx.api);
    const { body } = await creer(entete, { difficulte: 'moyen', nbBots: 1 });
    await ctx.api.post(`/api/parties/${body.partie.id}/abandon`).set('Authorization', entete);
    const get = (q) => ctx.api.get(`/api/parties?${q}`).set('Authorization', entete);
    expect((await get('difficulte=moyen')).body.parties).toHaveLength(1);
    expect((await get('difficulte=facile')).body.parties).toHaveLength(0);
    expect((await get('resultat=defaite')).body.parties).toHaveLength(1);
    expect((await get('resultat=victoire')).body.parties).toHaveLength(0);
  });

  it('le classement est public et ne liste que les comptes actifs ayant joué', async () => {
    const res = await ctx.api.get('/api/stats/classement');
    expect(res.status).toBe(200);
    expect(res.body.classement.length).toBeGreaterThan(0);
    expect(res.body.classement.every((l) => l.partiesJouees > 0)).toBe(true);
    expect(res.body.classement[0]).not.toHaveProperty('courriel');
  });

  it("l'administrateur voit toutes les parties et purge les abandonnées", async () => {
    const admin = await inscrireAdmin(ctx.api, ctx.db);
    const avant = (await ctx.api.get('/api/admin/parties').set('Authorization', admin.entete)).body.parties;
    const abandonnees = avant.filter((p) => p.statut === 'abandonnee').length;
    expect(abandonnees).toBeGreaterThan(0);
    const purge = await ctx.api.delete('/api/admin/parties/abandonnees').set('Authorization', admin.entete);
    expect(purge.body.supprimees).toBe(abandonnees);
    const apres = (await ctx.api.get('/api/admin/parties').set('Authorization', admin.entete)).body.parties;
    expect(apres.some((p) => p.statut === 'abandonnee')).toBe(false);
  });
});
