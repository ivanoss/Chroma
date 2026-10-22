# Chroma

Jeu de cartes en ligne par correspondance de couleur et de valeur, jouable en solo contre un à trois adversaires contrôlés par l'ordinateur. Chaque partie est journalisée côté serveur, ce qui permet de la rejouer coup par coup, d'alimenter des statistiques personnelles et d'établir un classement entre joueurs inscrits.

Projet réalisé dans le cadre du cours **Projet intégrateur** (10 semaines).
Auteur : **Ivan Makarenkov**

![Table de jeu](docs/captures/3-table-de-jeu.png)

## Jouer en ligne

**👉 [chroma-jgh1.onrender.com](https://chroma-jgh1.onrender.com)**

- Cliquez sur **Créer un compte** (courriel, nom d'utilisateur, mot de passe d'au moins 8 caractères avec une lettre et un chiffre), puis lancez une partie.
- Le site est hébergé gratuitement : s'il n'a pas été visité depuis 15 minutes, le premier chargement peut prendre environ une minute.
- Accès administrateur : identifiants fournis à l'enseignant sur demande.

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

Fonctionnalités secondaires réalisées en plus :

- **Animations de jeu** : les cartes volent du joueur vers la défausse et de la pioche vers celui qui pioche, avec des effets (« +2 », « Passe ! », « Inversion ! »).
- **Table de jeu façon arène** : adversaires assis autour de la table (avatar, nombre de cartes), main en éventail, halo de la couleur active et anneau qui tourne dans le sens du jeu.
- **Version téléphone** : toutes les pages s'adaptent à l'écran ; en partie, la table occupe tout l'écran ([capture](docs/captures/7-mobile.png)).
- **Fin de partie** : boutons « Rejouer », « Revoir la partie » et « Retour à l'accueil ».
- Mode sombre (suit le réglage du système) et formes ▲ ● ■ ◆ sur les cartes pour les daltoniens.

## Historique du projet

| Période                                | Travail                                                                                                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Semaine 3 (8 septembre 2026)           | Remise du [document de cadrage](docs/CADRAGE.md)                                                                                                                                                                                                                   |
| Semaines 4 à 6 (jusqu'au 30 septembre) | Paquet de cartes, moteur de règles, bot facile, 21 tests Vitest (suivi de la semaine 6)                                                                                                                                                                            |
| Semaine 9 (20 au 22 octobre)           | Base de données, authentification, API REST, bots moyen et difficile, interface, historique et rejeu, statistiques, classement, administration, tests d'API et de bout en bout, version autonome, mise en ligne sur Render, table de jeu animée, version téléphone |
| Semaine 10                             | Démonstration                                                                                                                                                                                                                                                      |

## Démarrer

Prérequis : Node.js 22.13 ou plus récent (version LTS conseillée). SQLite est intégré à Node.js : rien à compiler.

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

## Mise en ligne

### Sur Render (gratuit)

Le fichier `render.yaml` décrit tout : le serveur web, la base PostgreSQL et les variables.

1. Sur [render.com](https://render.com), se connecter avec GitHub.
2. **New → Blueprint**, choisir le dépôt `Chroma` et la branche à déployer.
3. Remplir les trois valeurs demandées : `ADMIN_COURRIEL`, `ADMIN_NOM`, `ADMIN_MOT_DE_PASSE`
   (au moins 8 caractères, avec une lettre et un chiffre). Le compte administrateur est créé au démarrage.
4. **Apply**. Après quelques minutes, le site est en ligne à l'adresse `https://chroma-xxxx.onrender.com`.

`JWT_SECRET` est généré automatiquement et `DATABASE_URL` est relié à la base.
Limites de l'offre gratuite : le serveur s'endort après 15 minutes sans visite (le premier
chargement prend alors environ une minute) et la base gratuite expire 30 jours après sa création.

Vérifier le site en ligne avec les tests de bout en bout :

```bash
E2E_URL=https://chroma-xxxx.onrender.com npm run test:e2e
```

### Ailleurs

- **Avec Docker** (Railway, Fly.io, un VPS) : le `Dockerfile` est fourni.
- **Variables** : `NODE_ENV=production`, `JWT_SECRET`, `DATABASE_URL`, et `DATABASE_SSL=true`
  si l'hébergeur exige une connexion chiffrée à la base.
- **Santé** : `GET /api/sante` répond `{"statut":"ok"}` quand le serveur et la base fonctionnent.

### Tester avec un vrai PostgreSQL

```bash
TEST_DATABASE_URL=postgres://user:mdp@localhost:5432/chroma_test npm test
```

Attention : ce test vide la base indiquée.

## Version autonome (sans serveur)

Pour une démo ou un hébergement qui n'accepte que des fichiers statiques, on peut générer
un seul fichier HTML :

```bash
npm run build:autonome   # → dist/chroma.html
```

Ce fichier s'ouvre directement dans un navigateur ou se dépose sur n'importe quel hébergement web.
Il réutilise le même client, le même moteur et les mêmes bots ; seuls deux modules sont remplacés
(`statique/api-local.js` et `statique/connexion-locale.js`). Les parties, statistiques et rejeux
sont enregistrés dans le navigateur (localStorage).

Limites, par rapport à la version avec serveur : pas de vrais comptes (un simple nom de joueur),
un classement limité aux joueurs du même appareil, pas d'administration, et c'est le navigateur
qui applique les règles. La version avec serveur reste l'architecture du projet décrite dans le cadrage.

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
