// Couche de connexion : la même interface pour SQLite (dév) et PostgreSQL (prod).
//
//   db.tous(sql, params)   -> toutes les lignes
//   db.un(sql, params)     -> première ligne ou undefined
//   db.executer(sql, params) -> { changements }
//   db.transaction(async (tx) => { ... })
//
// Le SQL est écrit une seule fois avec des « ? » ; pour PostgreSQL ils sont
// convertis en $1, $2, ...
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAQUET_REFERENCE } from '../moteur/cartes.js';

const ICI = dirname(fileURLToPath(import.meta.url));

function versDollars(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

// PostgreSQL renvoie des objets Date pour les TIMESTAMPTZ : on les remet en
// texte ISO pour que le reste du code reçoive la même chose qu'avec SQLite.
function normaliserLigne(ligne) {
  if (!ligne) return ligne;
  for (const [cle, valeur] of Object.entries(ligne)) {
    if (valeur instanceof Date) ligne[cle] = valeur.toISOString();
  }
  return ligne;
}

async function ouvrirSqlite(fichier) {
  const { default: Database } = await import('better-sqlite3');
  if (fichier !== ':memory:') mkdirSync(dirname(fichier), { recursive: true });
  const base = new Database(fichier);
  base.pragma('foreign_keys = ON');
  if (fichier !== ':memory:') base.pragma('journal_mode = WAL');
  base.exec(readFileSync(join(ICI, 'schema.sqlite.sql'), 'utf8'));

  const db = {
    dialecte: 'sqlite',
    async tous(sql, params = []) {
      return base.prepare(sql).all(...params);
    },
    async un(sql, params = []) {
      return base.prepare(sql).get(...params);
    },
    async executer(sql, params = []) {
      return { changements: base.prepare(sql).run(...params).changes };
    },
    // better-sqlite3 est synchrone : tant que le callback n'attend que des
    // appels à la base, aucune autre requête HTTP ne peut s'intercaler.
    async transaction(fn) {
      if (base.inTransaction) return fn(db); // pas de transaction imbriquée
      base.exec('BEGIN');
      try {
        const resultat = await fn(db);
        base.exec('COMMIT');
        return resultat;
      } catch (err) {
        base.exec('ROLLBACK');
        throw err;
      }
    },
    async fermer() {
      base.close();
    },
  };
  return db;
}

async function ouvrirPostgres(url, PoolInjecte) {
  const Pool = PoolInjecte ?? (await import('pg')).default.Pool;
  const pool = new Pool(url ? { connectionString: url } : undefined);

  const adapter = (client) => ({
    dialecte: 'postgres',
    async tous(sql, params = []) {
      return (await client.query(versDollars(sql), params)).rows.map(normaliserLigne);
    },
    async un(sql, params = []) {
      return normaliserLigne((await client.query(versDollars(sql), params)).rows[0]);
    },
    async executer(sql, params = []) {
      return { changements: (await client.query(versDollars(sql), params)).rowCount };
    },
  });

  const db = {
    ...adapter(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = adapter(client);
        tx.transaction = (f) => f(tx); // pas de transaction imbriquée
        const resultat = await fn(tx);
        await client.query('COMMIT');
        return resultat;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async fermer() {
      await pool.end();
    },
  };
  const schema = readFileSync(join(ICI, 'schema.postgres.sql'), 'utf8').replace(/--.*$/gm, '');
  for (const instruction of schema.split(';')) {
    if (instruction.trim()) await pool.query(instruction);
  }
  return db;
}

// Remplit le référentiel des 108 cartes (mêmes id que le moteur).
async function remplirCartes(db) {
  const { n } = await db.un('SELECT COUNT(*) AS n FROM cartes');
  if (Number(n) === PAQUET_REFERENCE.length) return;
  await db.transaction(async (tx) => {
    await tx.executer('DELETE FROM cartes');
    for (const c of PAQUET_REFERENCE) {
      await tx.executer('INSERT INTO cartes (id, couleur, valeur, type_carte, points) VALUES (?, ?, ?, ?, ?)', [
        c.id,
        c.couleur,
        c.valeur === null ? null : String(c.valeur),
        c.type,
        c.points,
      ]);
    }
  });
}

export async function ouvrirBase({
  url = process.env.DATABASE_URL,
  fichier = process.env.SQLITE_FILE ?? join(ICI, '..', '..', 'data', 'chroma.db'),
  Pool,
} = {}) {
  const db = url || Pool ? await ouvrirPostgres(url, Pool) : await ouvrirSqlite(fichier);
  await remplirCartes(db);
  return db;
}
