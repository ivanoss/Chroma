// Écran 1 — connexion / inscription (un seul formulaire à bascule).
import { h, toast } from '../dom.js';
import { api } from '../api.js';
import { ouvrirSession, estConnecte } from '../session.js';
import { elementCarte } from '../cartes.js';

const CARTES_VITRINE = [
  { id: 'v1', couleur: 'bleu', type: 'nombre', valeur: 7 },
  { id: 'v2', couleur: 'vert', type: 'inversion' },
  { id: 'v3', couleur: null, type: 'couleur' },
  { id: 'v4', couleur: 'jaune', type: 'plus2' },
  { id: 'v5', couleur: 'rouge', type: 'nombre', valeur: 3 },
];

function champ({ id, libelle, type = 'text', autocomplete, aide }) {
  return h(
    'div',
    { class: 'champ' },
    h('label', { for: id }, libelle),
    h('input', { id, name: id, type, autocomplete, required: true, 'aria-describedby': `${id}-erreur` }),
    aide && h('span', { class: 'champ__aide' }, aide),
    h('span', { class: 'champ__erreur', id: `${id}-erreur` }),
  );
}

export function vueConnexion(conteneur) {
  if (estConnecte()) {
    location.hash = '#/';
    return;
  }
  let mode = 'connexion';

  const formulaire = h('form', { novalidate: true });
  const erreurGenerale = h('p', { class: 'message-erreur', role: 'alert' });
  const boutons = {
    connexion: h(
      'button',
      { type: 'button', 'aria-pressed': 'true', onclick: () => changer('connexion') },
      'Se connecter',
    ),
    inscription: h(
      'button',
      { type: 'button', 'aria-pressed': 'false', onclick: () => changer('inscription') },
      'Créer un compte',
    ),
  };

  function dessiner() {
    formulaire.replaceChildren(
      ...(mode === 'connexion'
        ? [
            champ({ id: 'identifiant', libelle: 'Courriel ou nom d’utilisateur', autocomplete: 'username' }),
            champ({ id: 'motDePasse', libelle: 'Mot de passe', type: 'password', autocomplete: 'current-password' }),
          ]
        : [
            champ({ id: 'courriel', libelle: 'Courriel', type: 'email', autocomplete: 'email' }),
            champ({
              id: 'nomUtilisateur',
              libelle: 'Nom d’utilisateur',
              autocomplete: 'username',
              aide: 'Affiché dans le classement. 3 à 20 caractères.',
            }),
            champ({
              id: 'motDePasse',
              libelle: 'Mot de passe',
              type: 'password',
              autocomplete: 'new-password',
              aide: 'Au moins 8 caractères, avec une lettre et un chiffre.',
            }),
          ]),
      erreurGenerale,
      h('button', { class: 'bouton', type: 'submit' }, mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'),
    );
    erreurGenerale.textContent = '';
  }

  function changer(nouveau) {
    mode = nouveau;
    boutons.connexion.setAttribute('aria-pressed', String(mode === 'connexion'));
    boutons.inscription.setAttribute('aria-pressed', String(mode === 'inscription'));
    dessiner();
    formulaire.querySelector('input')?.focus();
  }

  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valeurs = Object.fromEntries(new FormData(formulaire));
    formulaire.querySelectorAll('.champ__erreur').forEach((el) => (el.textContent = ''));
    erreurGenerale.textContent = '';
    const bouton = formulaire.querySelector('[type=submit]');
    bouton.disabled = true;
    try {
      const { jeton, utilisateur } =
        mode === 'connexion'
          ? await api.connexion(valeurs.identifiant, valeurs.motDePasse)
          : await api.inscription(valeurs);
      ouvrirSession(jeton, utilisateur);
      toast(mode === 'connexion' ? `Bon retour, ${utilisateur.nomUtilisateur}.` : 'Compte créé. Bienvenue !');
      // Si l'adresse est déjà « #/ », hashchange ne se déclenche pas : on le provoque.
      if (location.hash === '#/') window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.hash = '#/';
    } catch (err) {
      if (err.details) {
        for (const [cle, message] of Object.entries(err.details)) {
          const el = formulaire.querySelector(`#${cle}-erreur`);
          if (el) el.textContent = message;
        }
      }
      erreurGenerale.textContent = err.details ? 'Corrigez les champs indiqués.' : err.message;
    } finally {
      bouton.disabled = false;
    }
  });

  dessiner();
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
          'Associez la couleur ou la valeur, contrez les +2, changez de couleur au bon moment. Vos adversaires sont gérés par l’ordinateur : une partie commence tout de suite, à n’importe quelle heure.',
        ),
        h(
          'div',
          { class: 'eventail', 'aria-hidden': 'true' },
          CARTES_VITRINE.map((c) => elementCarte(c, { taille: 'grande' })),
        ),
        h(
          'p',
          { class: 'discret' },
          'Chaque coup est enregistré : revoyez vos parties, suivez vos statistiques et comparez-vous dans le ',
          h('a', { href: '#/classement' }, 'classement'),
          '. Nouveau ? Lisez les ',
          h('a', { href: '#/regles' }, 'règles'),
          '.',
        ),
      ),
      h(
        'section',
        { class: 'panneau', 'aria-label': 'Connexion ou inscription' },
        h(
          'div',
          { class: 'bascule', role: 'group', 'aria-label': 'Choisir le formulaire' },
          boutons.connexion,
          boutons.inscription,
        ),
        formulaire,
      ),
    ),
  );
}
