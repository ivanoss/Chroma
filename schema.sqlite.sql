-- Schéma Chroma — SQLite (développement et tests)
-- Les dates sont stockées en texte ISO 8601 (UTC).

CREATE TABLE IF NOT EXISTS utilisateurs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  courriel            TEXT    NOT NULL UNIQUE,
  nom_utilisateur     TEXT    NOT NULL UNIQUE,
  mot_de_passe_hache  TEXT    NOT NULL,
  role                TEXT    NOT NULL DEFAULT 'joueur' CHECK (role IN ('joueur', 'admin')),
  actif               INTEGER NOT NULL DEFAULT 1,
  date_inscription    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS statistiques_joueur (
  utilisateur_id    INTEGER PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
  parties_jouees    INTEGER NOT NULL DEFAULT 0,
  parties_gagnees   INTEGER NOT NULL DEFAULT 0,
  cartes_jouees     INTEGER NOT NULL DEFAULT 0,
  duree_totale_sec  INTEGER NOT NULL DEFAULT 0,
  meilleure_serie   INTEGER NOT NULL DEFAULT 0,
  serie_actuelle    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cartes (
  id          INTEGER PRIMARY KEY,
  couleur     TEXT,
  valeur      TEXT,
  type_carte  TEXT    NOT NULL,
  points      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS parties (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  difficulte_bot  TEXT    NOT NULL CHECK (difficulte_bot IN ('facile', 'moyen', 'difficile')),
  nb_joueurs      INTEGER NOT NULL CHECK (nb_joueurs BETWEEN 2 AND 4),
  statut          TEXT    NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'terminee', 'abandonnee')),
  etat_json       TEXT    NOT NULL,
  graine          INTEGER NOT NULL,
  version         INTEGER NOT NULL DEFAULT 0,
  date_debut      TEXT    NOT NULL,
  date_fin        TEXT
);
CREATE INDEX IF NOT EXISTS idx_parties_utilisateur ON parties (utilisateur_id, statut);

CREATE TABLE IF NOT EXISTS participants (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  partie_id       INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  utilisateur_id  INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  est_bot         INTEGER NOT NULL DEFAULT 0,
  nom_affiche     TEXT    NOT NULL,
  position_table  INTEGER NOT NULL,
  rang_final      INTEGER,
  UNIQUE (partie_id, position_table)
);

CREATE TABLE IF NOT EXISTS coups (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  partie_id        INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  participant_id   INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  carte_id         INTEGER REFERENCES cartes(id),
  numero_tour      INTEGER NOT NULL,
  type_action      TEXT    NOT NULL CHECK (type_action IN ('jouer', 'piocher')),
  couleur_choisie  TEXT,
  derniere_carte   INTEGER NOT NULL DEFAULT 0,
  cartes_piochees  INTEGER NOT NULL DEFAULT 0,
  horodatage       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coups_partie ON coups (partie_id, numero_tour);
