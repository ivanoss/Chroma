# Chroma

Jeu de cartes en ligne par correspondance de couleur et de valeur, jouable en solo contre un à trois adversaires contrôlés par l'ordinateur. Chaque partie est journalisée côté serveur, ce qui permet de la rejouer coup par coup, d'alimenter des statistiques personnelles et d'établir un classement entre joueurs inscrits.

Projet réalisé dans le cadre du cours **Projet intégrateur** (10 semaines).
Auteur : **Ivan Makarenkov**

![Table de jeu](docs/captures/3-table-de-jeu.png)

## Statut

MVP terminé (semaine 9) : toutes les fonctionnalités indispensables du [document de cadrage](docs/CADRAGE.md) sont codées et testées.

| Fonctionnalité du MVP                                                   | État |
| ----------------------------------------------------------------------- | ---- |
| Inscription, connexion, déconnexion (bcrypt, JWT, rôles joueur / admin) | ✅   |
| Moteur de règles côté serveur (seule autorité sur la partie)            | ✅   |
| Bots à trois niveaux (facile, moyen, difficile)                         | ✅   |
| Créer, reprendre, abandonner, supprimer une partie                      | ✅   |
| Historique filtrable et rejeu coup par coup                             | ✅   |
| Statistiques personnelles et classement général                         | ✅   |
| Tableau de bord administrateur                                          | ✅   |

Fonctionnalités secondaires réalisées en plus : mode sombre (suit le réglage du système) et formes ▲ ● ■ ◆ sur les cartes pour les daltoniens.

## Démarrer

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm start            # http://localhost:3000
```

La base SQLite est créée automatiquement dans `data/chroma.db`.

Créer un compte administrateur :

```bash
npm run creer-admin -- admin@exemple.ca admin MotDePasse123
```

### Variables d'environnement

| Variable       | Rôle                                                                 | Par défaut                           |
| -------------- | -------------------------------------------------------------------- | ------------------------------------ |
| `PORT`         | Port HTTP                                                            | `3000`                               |
| `JWT_SECRET`   | Secret de signature des jetons (**obligatoire en production**)       | généré au démarrage en développement |
| `DATABASE_URL` | URL PostgreSQL ; si présente, PostgreSQL remplace SQLite             | —                                    |
| `SQLITE_FILE`  | Fichier SQLite                                                       | `data/chroma.db`                     |
| `NODE_ENV`     | `production` désactive le journal des requêtes et exige `JWT_SECRET` | —                                    |

Production avec PostgreSQL :

```bash
NODE_ENV=production JWT_SECRET=... DATABASE_URL=postgres://user:mdp@hote/chroma npm start
```

Les tables sont créées au premier démarrage (`server/db/schema.postgres.sql`).

## Tests et qualité

```bash
npm test             # Vitest : moteur, bots, API (Supertest), PostgreSQL (pg-mem)
npm run test:e2e     # Playwright : partie complète dans un navigateur
npm run lint         # ESLint
npm run format       # Prettier
node server/scripts/comparerBots.js 4000   # taux de victoire des trois bots
```

Pour Playwright, installer le navigateur une fois : `npx playwright install chromium`.

## Pile technologique

| Couche          | Technologies                                                                  |
| --------------- | ----------------------------------------------------------------------------- |
| Frontend        | HTML5, CSS3 (variables, Grid, Flexbox), JavaScript natif (ES2022, modules ES) |
| Backend         | Node.js, Express, API REST (JSON), authentification par JWT                   |
| Base de données | SQLite (développement), PostgreSQL (production)                               |
| Tests           | Vitest, Supertest, Playwright                                                 |
| Qualité         | ESLint, Prettier                                                              |

## Organisation du dépôt

```
client/                 interface web (aucune règle de jeu ici)
  index.html
  css/styles.css
  js/main.js            routeur (#/...) et navigation
  js/api.js             appels à l'API
  js/vues/              un fichier par écran
server/
  moteur/               moteur de règles (pur : ni Express ni base de données)
  bots/                 bots facile, moyen, difficile
  db/                   schémas SQL, connexion SQLite/PostgreSQL, requêtes (dao.js)
  services/             logique des parties et de l'authentification
  middleware/auth.js    vérification du jeton, rôles, limite de tentatives
  routes.js             routes REST
  app.js, index.js      application Express et démarrage
tests/
  unitaires/            moteur et bots
  api/                  routes avec Supertest (SQLite et PostgreSQL)
  e2e/                  parcours complet avec Playwright
docs/                   cadrage et captures d'écran
```

## API REST

Toutes les routes sont sous `/api`. Les routes marquées 🔒 exigent l'en-tête `Authorization: Bearer <jeton>`.

| Méthode         | Route                            | Description                                                     |
| --------------- | -------------------------------- | --------------------------------------------------------------- |
| POST            | `/auth/inscription`              | Créer un compte → `{ jeton, utilisateur }`                      |
| POST            | `/auth/connexion`                | Se connecter (courriel ou nom d'utilisateur)                    |
| GET 🔒          | `/auth/moi`                      | Profil de l'utilisateur connecté                                |
| POST 🔒         | `/parties`                       | Nouvelle partie `{ difficulte, nbBots }`                        |
| GET 🔒          | `/parties/en-cours`              | Partie à reprendre (ou `{ partie: null }`)                      |
| GET 🔒          | `/parties?resultat=&difficulte=` | Historique filtrable                                            |
| GET 🔒          | `/parties/:id`                   | Vue publique d'une partie                                       |
| POST 🔒         | `/parties/:id/coups`             | Jouer `{ action, numeroTour }` → vue + coups des bots           |
| POST 🔒         | `/parties/:id/abandon`           | Abandonner                                                      |
| DELETE 🔒       | `/parties/:id`                   | Supprimer une partie finie                                      |
| GET 🔒          | `/parties/:id/rejeu`             | Toutes les étapes de la partie, reconstruites depuis le journal |
| GET 🔒          | `/stats/moi`                     | Statistiques personnelles                                       |
| GET             | `/stats/classement`              | Classement public                                               |
| GET 🔒 admin    | `/admin/utilisateurs`            | Liste des comptes                                               |
| PATCH 🔒 admin  | `/admin/utilisateurs/:id`        | Activer / désactiver `{ actif }`                                |
| GET 🔒 admin    | `/admin/parties`                 | Toutes les parties                                              |
| DELETE 🔒 admin | `/admin/parties/abandonnees`     | Purger les parties abandonnées                                  |

## Note

Le nom « Chroma » et l'habillage visuel sont originaux. Le projet s'inspire d'une mécanique de jeu de cartes classique sans reprendre de marque, de logo ni d'illustration appartenant à un tiers.
