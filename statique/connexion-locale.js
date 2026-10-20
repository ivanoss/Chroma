// Version autonome — écran d'entrée : on choisit simplement un nom de joueur.
import { h, toast } from '../client/js/dom.js';
import { estConnecte } from '../client/js/session.js';
import { elementCarte } from '../client/js/cartes.js';
import { api } from './api-local.js';

const CARTES_VITRINE = [
  { id: 'v1', couleur: 'bleu', type: 'nombre', valeur: 7 },
  { id: 'v2', couleur: 'vert', type: 'inversion' },
  { id: 'v3', couleur: null, type: 'couleur' },
  { id: 'v4', couleur: 'jaune', type: 'plus2' },
  { id: 'v5', couleur: 'rouge', type: 'nombre', valeur: 3 },
];

async function entrer(nom, erreur) {
  try {
    const { utilisateur } = await api.entrer(nom);
    toast(`Bonne partie, ${utilisateur.nomUtilisateur} !`);
    if (location.hash === '#/') window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = '#/';
  } catch (err) {
    erreur.textContent = err.message;
  }
}

export async function vueConnexion(conteneur) {
  if (estConnecte()) {
    location.hash = '#/';
    return;
  }
  const profils = await api.profils();
  const erreur = h('p', { class: 'message-erreur', role: 'alert', id: 'nom-erreur' });
  const champ = h('input', {
    id: 'nom',
    name: 'nom',
    autocomplete: 'nickname',
    required: true,
    'aria-describedby': 'nom-erreur',
  });
  const formulaire = h(
    'form',
    { novalidate: true },
    h('div', { class: 'champ' }, h('label', { for: 'nom' }, 'Votre nom de joueur'), champ),
    erreur,
    h('button', { class: 'bouton', type: 'submit' }, 'Jouer'),
  );
  formulaire.addEventListener('submit', (e) => {
    e.preventDefault();
    entrer(champ.value, erreur);
  });

  conteneur.append(
    h(
      'div',
      { class: 'accueil-visiteur' },
      h(
        'section',
        { class: 'accroche' },
        h('h1', {}, 'Videz votre main avant les trois autres.'),
        h(
          'p',
          {},
          'Associez la couleur ou la valeur, contrez les +2, changez de couleur au bon moment. Vos adversaires sont gérés par l’ordinateur : une partie commence tout de suite.',
        ),
        h(
          'div',
          { class: 'eventail', 'aria-hidden': 'true' },
          CARTES_VITRINE.map((c) => elementCarte(c, { taille: 'grande' })),
        ),
        h('p', { class: 'discret' }, 'Nouveau ? Lisez les ', h('a', { href: '#/regles' }, 'règles'), '.'),
      ),
      h(
        'section',
        { class: 'panneau', 'aria-label': 'Choisir un joueur' },
        h('h2', {}, 'Qui joue ?'),
        formulaire,
        profils.length > 0 &&
          h(
            'div',
            { class: 'profils' },
            h('p', { class: 'discret' }, 'Déjà venu sur cet appareil :'),
            h(
              'div',
              { class: 'profils__liste' },
              profils.map((nom) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'bouton bouton--secondaire bouton--petit',
                    onclick: () => entrer(nom, erreur),
                  },
                  nom,
                ),
              ),
            ),
          ),
        h(
          'p',
          { class: 'discret note-autonome' },
          'Cette version fonctionne entièrement dans votre navigateur. Vos parties, statistiques et rejeux sont enregistrés sur cet appareil seulement.',
        ),
      ),
    ),
  );
  champ.focus();
}
