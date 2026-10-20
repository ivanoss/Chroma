// Couche d'accès aux données : toutes les requêtes SQL de l'application sont ici.
// Chaque fonction reçoit `db` (ou une transaction `tx`) en premier paramètre.

const maintenant = () => new Date().toISOString();
const lireJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

// --------------------------------------------------------------------------
// Utilisateurs
// --------------------------------------------------------------------------

const COLONNES_UTILISATEUR = 'id, courriel, nom_utilisateur, role, actif, date_inscription';

export async function creerUtilisateur(db, { courriel, nomUtilisateur, motDePasseHache, role = 'joueur' }) {
  return db.transaction(async (tx) => {
    const ligne = await tx.un(
      `INSERT INTO utilisateurs (courriel, nom_utilisateur, mot_de_passe_hache, role, date_inscription)
       VALUES (?, ?, ?, ?, ?) RETURNING ${COLONNES_UTILISATEUR}`,
      [courriel, nomUtilisateur, motDePasseHache, role, maintenant()],
    );
    await tx.executer('INSERT INTO statistiques_joueur (utilisateur_id) VALUES (?)', [ligne.id]);
    return ligne;
  });
}

export function trouverPourConnexion(db, identifiant) {
  return db.un(
    `SELECT ${COLONNES_UTILISATEUR}, mot_de_passe_hache FROM utilisateurs
     WHERE LOWER(courriel) = LOWER(?) OR LOWER(nom_utilisateur) = LOWER(?)`,
    [identifiant, identifiant],
  );
}

export function utilisateurExiste(db, courriel, nomUtilisateur) {
  return db.un('SELECT id FROM utilisateurs WHERE LOWER(courriel) = LOWER(?) OR LOWER(nom_utilisateur) = LOWER(?)', [
    courriel,
    nomUtilisateur,
  ]);
}

export function trouverUtilisateur(db, id) {
  return db.un(`SELECT ${COLONNES_UTILISATEUR} FROM utilisateurs WHERE id = ?`, [id]);
}

export function changerRole(db, id, role) {
  return db.executer('UPDATE utilisateurs SET role = ? WHERE id = ?', [role, id]);
}

export function changerActif(db, id, actif) {
  return db.executer('UPDATE utilisateurs SET actif = ? WHERE id = ?', [actif ? 1 : 0, id]);
}

export function listerUtilisateurs(db) {
  return db.tous(
    `SELECT u.id, u.courriel, u.nom_utilisateur, u.role, u.actif, u.date_inscription,
            s.parties_jouees, s.parties_gagnees,
            COUNT(p.id) AS parties_en_cours
     FROM utilisateurs u
     LEFT JOIN statistiques_joueur s ON s.utilisateur_id = u.id
     LEFT JOIN parties p ON p.utilisateur_id = u.id AND p.statut = 'en_cours'
     GROUP BY u.id, u.courriel, u.nom_utilisateur, u.role, u.actif, u.date_inscription,
              s.parties_jouees, s.parties_gagnees
     ORDER BY u.id`,
  );
}

// --------------------------------------------------------------------------
// Statistiques et classement
// --------------------------------------------------------------------------

export function lireStatistiques(db, utilisateurId) {
  return db.un('SELECT * FROM statistiques_joueur WHERE utilisateur_id = ?', [utilisateurId]);
}

export async function enregistrerResultat(db, utilisateurId, { gagne, cartesJouees, dureeSec }) {
  const s = await lireStatistiques(db, utilisateurId);
  const serie = gagne ? s.serie_actuelle + 1 : 0;
  await db.executer(
    `UPDATE statistiques_joueur SET
       parties_jouees = parties_jouees + 1,
       parties_gagnees = parties_gagnees + ?,
       cartes_jouees = cartes_jouees + ?,
       duree_totale_sec = duree_totale_sec + ?,
       serie_actuelle = ?,
       meilleure_serie = ?
     WHERE utilisateur_id = ?`,
    [gagne ? 1 : 0, cartesJouees, dureeSec, serie, Math.max(serie, s.meilleure_serie), utilisateurId],
  );
}

export function classement(db, limite = 50) {
  return db.tous(
    `SELECT u.id, u.nom_utilisateur, s.parties_jouees, s.parties_gagnees, s.meilleure_serie,
            s.cartes_jouees, s.duree_totale_sec
     FROM statistiques_joueur s JOIN utilisateurs u ON u.id = s.utilisateur_id
     WHERE u.actif = 1 AND s.parties_jouees > 0
     ORDER BY s.parties_gagnees DESC,
              (s.parties_gagnees * 1.0 / s.parties_jouees) DESC,
              s.meilleure_serie DESC,
              u.nom_utilisateur ASC
     LIMIT ?`,
    [limite],
  );
}

// --------------------------------------------------------------------------
// Parties et participants
// --------------------------------------------------------------------------

function versPartie(ligne) {
  if (!ligne) return ligne;
  return { ...ligne, etat: lireJson(ligne.etat_json), graine: Number(ligne.graine), etat_json: undefined };
}

export async function insererPartie(db, { utilisateurId, difficulte, etat, graine, participants }) {
  return db.transaction(async (tx) => {
    const { id } = await tx.un(
      `INSERT INTO parties (utilisateur_id, difficulte_bot, nb_joueurs, statut, etat_json, graine, version, date_debut)
       VALUES (?, ?, ?, 'en_cours', ?, ?, 0, ?) RETURNING id`,
      [utilisateurId, difficulte, participants.length, JSON.stringify(etat), graine, maintenant()],
    );
    for (const p of participants) {
      await tx.executer(
        `INSERT INTO participants (partie_id, utilisateur_id, est_bot, nom_affiche, position_table)
         VALUES (?, ?, ?, ?, ?)`,
        [id, p.utilisateurId ?? null, p.estBot ? 1 : 0, p.nom, p.position],
      );
    }
    return id;
  });
}

export async function lirePartie(db, id) {
  return versPartie(await db.un('SELECT * FROM parties WHERE id = ?', [id]));
}

export async function partieEnCours(db, utilisateurId) {
  return versPartie(
    await db.un("SELECT * FROM parties WHERE utilisateur_id = ? AND statut = 'en_cours' ORDER BY id DESC LIMIT 1", [
      utilisateurId,
    ]),
  );
}

export function lireParticipants(db, partieId) {
  return db.tous('SELECT * FROM participants WHERE partie_id = ? ORDER BY position_table', [partieId]);
}

// Sauvegarde optimiste : on n'écrit que si personne n'a modifié la partie
// depuis qu'on l'a lue (protection contre deux requêtes simultanées).
export async function sauvegarderEtat(db, id, etat, versionLue) {
  const { changements } = await db.executer(
    'UPDATE parties SET etat_json = ?, version = version + 1 WHERE id = ? AND version = ?',
    [JSON.stringify(etat), id, versionLue],
  );
  return changements === 1;
}

export function clorePartie(db, id, statut) {
  return db.executer('UPDATE parties SET statut = ?, date_fin = ? WHERE id = ?', [statut, maintenant(), id]);
}

export function enregistrerRang(db, participantId, rang) {
  return db.executer('UPDATE participants SET rang_final = ? WHERE id = ?', [rang, participantId]);
}

export function supprimerPartie(db, id) {
  return db.executer('DELETE FROM parties WHERE id = ?', [id]);
}

// Historique d'un joueur, avec filtres optionnels.
export function historique(db, utilisateurId, { statut, difficulte, resultat } = {}) {
  const conditions = ['p.utilisateur_id = ?'];
  const params = [utilisateurId];
  if (statut) {
    conditions.push('p.statut = ?');
    params.push(statut);
  } else {
    conditions.push("p.statut <> 'en_cours'");
  }
  if (difficulte) {
    conditions.push('p.difficulte_bot = ?');
    params.push(difficulte);
  }
  if (resultat === 'victoire') conditions.push("p.statut = 'terminee' AND moi.rang_final = 1");
  if (resultat === 'defaite') conditions.push("(p.statut = 'abandonnee' OR moi.rang_final > 1)");

  return db.tous(
    `SELECT p.id, p.difficulte_bot, p.nb_joueurs, p.statut, p.date_debut, p.date_fin,
            moi.rang_final,
            COUNT(c.id) AS nb_coups,
            COALESCE(SUM(CASE WHEN c.participant_id = moi.id AND c.type_action = 'jouer' THEN 1 ELSE 0 END), 0)
              AS cartes_jouees
     FROM parties p
     JOIN participants moi ON moi.partie_id = p.id AND moi.est_bot = 0
     LEFT JOIN coups c ON c.partie_id = p.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id, p.difficulte_bot, p.nb_joueurs, p.statut, p.date_debut, p.date_fin, moi.id, moi.rang_final
     ORDER BY p.id DESC`,
    params,
  );
}

export function listerToutesParties(db) {
  return db.tous(
    `SELECT p.id, p.difficulte_bot, p.nb_joueurs, p.statut, p.date_debut, p.date_fin,
            u.nom_utilisateur, COUNT(c.id) AS nb_coups
     FROM parties p
     JOIN utilisateurs u ON u.id = p.utilisateur_id
     LEFT JOIN coups c ON c.partie_id = p.id
     GROUP BY p.id, p.difficulte_bot, p.nb_joueurs, p.statut, p.date_debut, p.date_fin, u.nom_utilisateur
     ORDER BY p.id DESC`,
  );
}

export function purgerAbandonnees(db) {
  return db.executer("DELETE FROM parties WHERE statut = 'abandonnee'");
}

// --------------------------------------------------------------------------
// Journal des coups
// --------------------------------------------------------------------------

export async function insererCoups(db, partieId, coups) {
  const horodatage = maintenant();
  for (const c of coups) {
    await db.executer(
      `INSERT INTO coups (partie_id, participant_id, carte_id, numero_tour, type_action,
                          couleur_choisie, derniere_carte, cartes_piochees, horodatage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        partieId,
        c.participantId,
        c.carteId ?? null,
        c.numeroTour,
        c.type,
        c.couleurChoisie ?? null,
        c.derniereCarte ? 1 : 0,
        c.cartesPiochees ?? 0,
        horodatage,
      ],
    );
  }
}

export function lireCoups(db, partieId) {
  return db.tous(
    `SELECT c.*, pa.position_table FROM coups c
     JOIN participants pa ON pa.id = c.participant_id
     WHERE c.partie_id = ? ORDER BY c.numero_tour, c.id`,
    [partieId],
  );
}

export function compterCartesJouees(db, participantId) {
  return db.un("SELECT COUNT(*) AS n FROM coups WHERE participant_id = ? AND type_action = 'jouer'", [participantId]);
}
