// Écran 2 — accueil du joueur : nouvelle partie, reprise, stats, classement.
import { h, toast, formaterDuree, pourcentage } from '../dom.js';
import { api } from '../api.js';
import { obtenirSession } from '../session.js';

const NIVEAUX = [
  { valeur: 'facile', nom: 'Facile', texte: 'Joue une carte au hasard parmi celles permises.' },
  { valeur: 'moyen', nom: 'Moyen', texte: 'Place ses cartes d’action en premier et garde sa couleur forte.' },
  {
    valeur: 'difficile',
    nom: 'Difficile',
    texte: 'Se souvient des couleurs qui manquent à chacun et attaque au bon moment.',
  },
];

export function blocStats(stats) {
  return h(
    'dl',
    { class: 'stats' },
    [
      ['Parties jouées', stats.partiesJouees],
      ['Victoires', stats.partiesGagnees],
      ['Taux de victoire', stats.partiesJouees ? pourcentage(stats.tauxVictoire) : '—'],
      ['Cartes jouées', stats.cartesJouees],
      ['Durée moyenne', formaterDuree(stats.dureeMoyenneSec)],
      ['Meilleure série', stats.meilleureSerie],
    ].map(([libelle, valeur]) => h('div', {}, h('dt', {}, libelle), h('dd', {}, valeur))),
  );
}

export async function vueAccueil(conteneur) {
  const [enCours, { stats }, { classement }] = await Promise.all([
    api.partieEnCours(),
    api.mesStats(),
    api.classement(),
  ]);
  const moi = obtenirSession().utilisateur;

  const formulaire = h(
    'form',
    { class: 'panneau', 'aria-labelledby': 'titre-nouvelle' },
    h('h2', { id: 'titre-nouvelle' }, 'Nouvelle partie'),
    h(
      'fieldset',
      { class: 'niveaux' },
      h('legend', {}, 'Niveau des adversaires'),
      NIVEAUX.map((n, i) =>
        h(
          'div',
          { class: 'niveau' },
          h('input', { type: 'radio', name: 'difficulte', id: `niv-${n.valeur}`, value: n.valeur, checked: i === 0 }),
          h('label', { for: `niv-${n.valeur}` }, h('strong', {}, n.nom), h('span', {}, n.texte)),
        ),
      ),
    ),
    h(
      'fieldset',
      { class: 'nb-bots' },
      h('legend', {}, 'Nombre d’adversaires'),
      h(
        'div',
        {},
        [1, 2, 3].map((n) => [
          h('input', { type: 'radio', name: 'nbBots', id: `bots-${n}`, value: n, checked: n === 3 }),
          h('label', { for: `bots-${n}` }, n),
        ]),
      ),
    ),
    h('button', { class: 'bouton', type: 'submit', disabled: Boolean(enCours.partie) }, 'Lancer la partie'),
    enCours.partie &&
      h('p', { class: 'discret' }, 'Terminez ou abandonnez votre partie en cours pour en lancer une autre.'),
  );

  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { difficulte, nbBots } = Object.fromEntries(new FormData(formulaire));
    try {
      await api.nouvellePartie(difficulte, Number(nbBots));
      location.hash = '#/partie';
    } catch (err) {
      toast(err.message, 'erreur');
    }
  });

  const top = classement.slice(0, 5);

  conteneur.append(
    h(
      'div',
      { class: 'accueil' },
      h('h1', { class: 'accueil__titre' }, `Bonjour, ${moi.nomUtilisateur}.`),
      enCours.partie &&
        h(
          'div',
          { class: 'reprise' },
          h(
            'p',
            {},
            h('strong', {}, 'Une partie vous attend. '),
            `Niveau ${enCours.partie.difficulte}, tour ${enCours.vue.numeroTour}, ${enCours.vue.main.length} cartes en main.`,
          ),
          h('a', { class: 'bouton', href: '#/partie' }, 'Reprendre la partie'),
        ),
      formulaire,
      h(
        'div',
        { class: 'panneau' },
        h('h2', {}, 'Vos statistiques'),
        blocStats(stats),
        h('h2', { class: 'titre-classement' }, 'Classement'),
        top.length
          ? h(
              'div',
              { class: 'tableau-conteneur' },
              h(
                'table',
                {},
                h(
                  'thead',
                  {},
                  h('tr', {}, h('th', {}, 'Rang'), h('th', {}, 'Joueur'), h('th', { class: 'nombre' }, 'Victoires')),
                ),
                h(
                  'tbody',
                  {},
                  top.map((l) =>
                    h(
                      'tr',
                      { class: l.nomUtilisateur === moi.nomUtilisateur ? 'moi' : undefined },
                      h('td', {}, l.rang),
                      h('td', {}, l.nomUtilisateur),
                      h('td', { class: 'nombre' }, l.partiesGagnees),
                    ),
                  ),
                ),
              ),
            )
          : h('p', { class: 'discret' }, 'Personne n’a encore terminé de partie.'),
        h('p', {}, h('a', { href: '#/classement' }, 'Voir le classement complet')),
      ),
    ),
  );
}
