# Chroma

Jeu de cartes en ligne par correspondance de couleur et de valeur, jouable en solo contre trois adversaires contrôlés par l'ordinateur. Chaque partie est journalisée côté serveur, ce qui permet de la rejouer coup par coup, d'alimenter des statistiques personnelles et d'établir un classement entre joueurs inscrits.

Projet réalisé dans le cadre du cours **Projet intégrateur** (10 semaines).
Auteur : **Ivan Makarenkov**

## Statut

En cadrage — semaine 3. Le développement débute en semaine 4.
Le document de cadrage technique et fonctionnel est disponible ici : [CADRAGE.md](CADRAGE.md)

## Pile technologique

| Couche | Technologies |
|---|---|
| Frontend | HTML5, CSS3 (variables, Grid, Flexbox), JavaScript natif (ES2022, modules ES) |
| Backend | Node.js, Express, API REST (JSON), authentification par JWT |
| Base de données | SQLite (développement), PostgreSQL (production) |
| Tests | Vitest, Supertest, Playwright |
| Qualité | ESLint, Prettier |

## Périmètre du MVP

- Inscription, connexion et gestion des rôles
- Moteur de règles complet exécuté côté serveur, seule autorité sur l'état de la partie
- Adversaires artificiels à trois niveaux de difficulté
- Création, reprise, abandon et suppression de parties
- Historique des parties et rejeu coup par coup
- Statistiques personnelles et classement général

Le mode multijoueur entre joueurs humains est une fonctionnalité secondaire, envisagée uniquement si le MVP est terminé et testé.

## Structure prévue du dépôt

```
/client        interface web (HTML, CSS, modules JS)
/server        API Express, moteur de règles, module des bots
/server/db     schéma SQL et migrations
/tests         tests unitaires, d'API et end-to-end
/docs          documents de cadrage, schémas et maquettes
```

## Note

Le nom « Chroma » et l'habillage visuel sont originaux. Le projet s'inspire d'une mécanique de jeu de cartes classique sans reprendre de marque, de logo ni d'illustration appartenant à un tiers.
