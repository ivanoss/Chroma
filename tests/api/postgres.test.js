// Vérifie que la même application fonctionne avec PostgreSQL (production).
// pg-mem simule un serveur PostgreSQL en mémoire : pas besoin d'installation.
import { describe, it, expect } from 'vitest';
import { newDb } from 'pg-mem';
import { preparer, inscrire, jouerJusquALaFin } from './outils.js';

describe('API — avec PostgreSQL (pg-mem)', () => {
  it('inscription, partie complète, stats, historique et rejeu', async () => {
    const { Pool } = newDb().adapters.createPg();
    const { api, db } = await preparer({ Pool });
    expect(db.dialecte).toBe('postgres');

    const { entete } = await inscrire(api);
    const creation = await api
      .post('/api/parties')
      .set('Authorization', entete)
      .send({ difficulte: 'moyen', nbBots: 1 });
    expect(creation.status).toBe(201);

    const fin = await jouerJusquALaFin(api, entete, creation.body.partie.id, creation.body.vue);
    expect(fin.statut).toBe('terminee');

    const stats = (await api.get('/api/stats/moi').set('Authorization', entete)).body.stats;
    expect(stats.partiesJouees).toBe(1);
    const histo = (await api.get('/api/parties').set('Authorization', entete)).body.parties;
    expect(histo).toHaveLength(1);
    expect(histo[0].dateFin).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const rejeu = await api.get(`/api/parties/${creation.body.partie.id}/rejeu`).set('Authorization', entete);
    expect(rejeu.status).toBe(200);
    expect(rejeu.body.images.length).toBe(histo[0].nbCoups + 1);
    expect((await api.get('/api/stats/classement')).body.classement).toHaveLength(1);
  }, 60000);
});
