// Test contre un vrai serveur PostgreSQL, seulement si TEST_DATABASE_URL est défini :
//   TEST_DATABASE_URL=postgres://user:mdp@localhost:5432/chroma_test npm test
// Attention : la base indiquée est vidée au début du test.
import { describe, it, expect } from 'vitest';
import pg from 'pg';
import { preparer, inscrire, jouerJusquALaFin, coupSimple } from './outils.js';

const URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL)('API — avec un vrai serveur PostgreSQL', () => {
  it('partie complète, rejeu, deux coups simultanés et réouverture de la base', async () => {
    const nettoyage = new pg.Client({ connectionString: URL });
    await nettoyage.connect();
    await nettoyage.query(
      'DROP TABLE IF EXISTS coups, participants, parties, statistiques_joueur, cartes, utilisateurs CASCADE',
    );
    await nettoyage.end();

    const { api, db } = await preparer({ url: URL });
    expect(db.dialecte).toBe('postgres');
    const { entete } = await inscrire(api);
    const { body } = await api
      .post('/api/parties')
      .set('Authorization', entete)
      .send({ difficulte: 'difficile', nbBots: 3 });
    const id = body.partie.id;

    // Deux requêtes identiques envoyées en même temps : une seule doit passer.
    const envoi = { action: coupSimple(body.vue), numeroTour: body.vue.numeroTour };
    const [a, b] = await Promise.all([
      api.post(`/api/parties/${id}/coups`).set('Authorization', entete).send(envoi),
      api.post(`/api/parties/${id}/coups`).set('Authorization', entete).send(envoi),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const vue = (a.status === 200 ? a : b).body.vue;

    const fin = await jouerJusquALaFin(api, entete, id, vue);
    expect(fin.statut).toBe('terminee');
    const rejeu = await api.get(`/api/parties/${id}/rejeu`).set('Authorization', entete);
    expect(rejeu.body.images.at(-1).mains.map((m) => m.length)).toEqual(fin.joueurs.map((j) => j.nbCartes));
    await db.fermer();

    // Redémarrage : les tables existent déjà, les données sont toujours là.
    const deux = await preparer({ url: URL });
    const histo = await deux.api.get('/api/parties').set('Authorization', entete);
    expect(histo.body.parties).toHaveLength(1);
    await deux.db.fermer();
  }, 120000);
});
