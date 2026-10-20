// Écran 4 — historique des parties et rejeu coup par coup.
import { h, vider, toast, formaterDate } from '../dom.js';
import { api } from '../api.js';
import { elementCarte, libelleCarte, couleurCss, FORMES } from '../cartes.js';

function pastilleResultat(p) {
  if (p.statut === 'abandonnee') return h('span', { class: 'pastille pastille--abandon' }, 'Abandonnée');
  if (p.victoire) return h('span', { class: 'pastille pastille--victoire' }, 'Victoire');
  return h('span', { class: 'pastille' }, `${p.rang}e place`);
}

export async function vueHistorique(conteneur) {
  const filtres = { resultat: '', difficulte: '' };
  const zone = h('div', {});

  const select = (id, libelle, options) =>
    h(
      'div',
      { class: 'champ' },
      h('label', { for: id }, libelle),
      h(
        'select',
        {
          id,
          onchange: (e) => {
            filtres[id] = e.target.value;
            charger();
          },
        },
        options.map(([valeur, texte]) => h('option', { value: valeur }, texte)),
      ),
    );

  async function charger() {
    const { parties } = await api.historique(filtres);
    vider(zone);
    if (!parties.length) {
      zone.append(
        h(
          'div',
          { class: 'vide' },
          h(
            'p',
            {},
            filtres.resultat || filtres.difficulte
              ? 'Aucune partie ne correspond à ces filtres.'
              : 'Vous n’avez pas encore terminé de partie.',
          ),
          h('a', { class: 'bouton', href: '#/' }, 'Lancer une partie'),
        ),
      );
      return;
    }
    zone.append(
      h(
        'div',
        { class: 'tableau-conteneur' },
        h(
          'table',
          {},
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', {}, 'Date'),
              h('th', {}, 'Niveau'),
              h('th', { class: 'nombre' }, 'Joueurs'),
              h('th', {}, 'Résultat'),
              h('th', { class: 'nombre' }, 'Coups'),
              h('th', { class: 'nombre' }, 'Cartes posées'),
              h('th', {}, h('span', { class: 'visuellement-cache' }, 'Actions')),
            ),
          ),
          h(
            'tbody',
            {},
            parties.map((p) =>
              h(
                'tr',
                {},
                h('td', {}, formaterDate(p.dateDebut)),
                h('td', {}, p.difficulte),
                h('td', { class: 'nombre' }, p.nbJoueurs),
                h('td', {}, pastilleResultat(p)),
                h('td', { class: 'nombre' }, p.nbCoups),
                h('td', { class: 'nombre' }, p.cartesJouees),
                h(
                  'td',
                  {},
                  h('a', { class: 'bouton bouton--petit', href: `#/historique/${p.id}` }, 'Revoir'),
                  ' ',
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'bouton bouton--petit bouton--danger',
                      'aria-label': `Supprimer la partie du ${formaterDate(p.dateDebut)}`,
                      onclick: async () => {
                        if (!confirm('Supprimer cette partie de votre historique ?')) return;
                        try {
                          await api.supprimer(p.id);
                          toast('Partie supprimée.');
                          charger();
                        } catch (err) {
                          toast(err.message, 'erreur');
                        }
                      },
                    },
                    'Supprimer',
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  conteneur.append(
    h(
      'section',
      { class: 'panneau' },
      h('h1', {}, 'Historique'),
      h(
        'div',
        { class: 'filtres' },
        select('resultat', 'Résultat', [
          ['', 'Tous'],
          ['victoire', 'Victoires'],
          ['defaite', 'Défaites et abandons'],
        ]),
        select('difficulte', 'Niveau', [
          ['', 'Tous'],
          ['facile', 'Facile'],
          ['moyen', 'Moyen'],
          ['difficile', 'Difficile'],
        ]),
      ),
      zone,
    ),
  );
  await charger();
}

// ---------------------------------------------------------------- Rejeu

function decrire(coup, noms, cartes) {
  if (!coup) return 'Distribution des cartes.';
  const qui = noms[coup.position];
  if (coup.type === 'piocher')
    return `${qui} pioche ${coup.cartesPiochees} carte${coup.cartesPiochees > 1 ? 's' : ''}.`;
  let texte = `${qui} joue ${libelleCarte(cartes.get(coup.carteId))}`;
  if (coup.couleurChoisie) texte += ` et choisit le ${coup.couleurChoisie}`;
  if (coup.derniereCarte) texte += ' — « Dernière carte ! »';
  if (coup.cartesPiochees > 0) texte += ` (oubli : +${coup.cartesPiochees})`;
  return `${texte}.`;
}

export async function vueRejeu(conteneur, id) {
  let donnees;
  try {
    donnees = await api.rejeu(Number(id));
  } catch (err) {
    conteneur.append(
      h(
        'div',
        { class: 'panneau vide' },
        h('p', {}, err.message),
        h('a', { class: 'bouton', href: '#/historique' }, 'Retour à l’historique'),
      ),
    );
    return;
  }
  const { partie, images } = donnees;
  const cartes = new Map(donnees.cartes.map((c) => [c.id, c]));
  const noms = partie.participants.map((p) => p.nom);
  let index = 0;
  let minuterie = null;

  const plateau = h('div', { class: 'rejeu__plateau' });
  const description = h('p', { class: 'rejeu__description', 'aria-live': 'polite' });
  const curseur = h('input', {
    type: 'range',
    min: 0,
    max: images.length - 1,
    value: 0,
    'aria-label': 'Position dans la partie',
    oninput: (e) => aller(Number(e.target.value)),
  });
  const compteur = h('span', { class: 'compteur-tour' });
  const boutonLecture = h('button', { type: 'button', class: 'bouton', onclick: () => basculerLecture() }, 'Lecture');

  function dessiner() {
    const img = images[index];
    const actif = img.coup?.position;
    vider(plateau).append(
      h(
        'div',
        { class: 'rejeu__joueurs' },
        img.mains.map((main, i) =>
          h(
            'div',
            { class: ['rejeu__joueur', i === actif && 'actif'] },
            h(
              'div',
              {},
              h('strong', {}, noms[i]),
              h('div', { class: 'discret-table' }, `${main.length} carte${main.length > 1 ? 's' : ''}`),
            ),
            h(
              'div',
              { class: 'main-revelee' },
              main.map((cid) => elementCarte(cartes.get(cid), { taille: 'petite' })),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'rejeu__centre' },
        h(
          'div',
          { class: 'defausse__anneau', style: { '--anneau': couleurCss(img.couleurActive) } },
          elementCarte(cartes.get(img.sommet), { taille: 'grande' }),
        ),
        h('span', { class: 'defausse__couleur' }, `${FORMES[img.couleurActive]} Couleur : ${img.couleurActive}`),
        h('span', {}, `${img.sens === 1 ? '↻ Sens horaire' : '↺ Sens antihoraire'}`),
        h('span', {}, `${img.taillePioche} en pioche`),
        img.penaliteEnCours > 0 && h('span', {}, `Pénalité en attente : ${img.penaliteEnCours}`),
      ),
    );
    description.textContent = decrire(img.coup, noms, cartes);
    curseur.value = index;
    compteur.textContent = `${index} / ${images.length - 1}`;
  }

  function aller(i) {
    index = Math.max(0, Math.min(images.length - 1, i));
    dessiner();
    if (index === images.length - 1) arreter();
  }
  function arreter() {
    clearInterval(minuterie);
    minuterie = null;
    boutonLecture.textContent = 'Lecture';
  }
  function basculerLecture() {
    if (minuterie) return arreter();
    if (index === images.length - 1) index = 0;
    boutonLecture.textContent = 'Pause';
    minuterie = setInterval(() => aller(index + 1), 800);
  }
  const clavier = (e) => {
    if (e.target.matches('input, select')) return;
    if (e.key === 'ArrowRight') aller(index + 1);
    if (e.key === 'ArrowLeft') aller(index - 1);
  };
  document.addEventListener('keydown', clavier);

  const gagnant = partie.participants.find((p) => p.rang === 1);
  conteneur.append(
    h(
      'section',
      { class: 'rejeu' },
      h('p', {}, h('a', { href: '#/historique' }, 'Retour à l’historique')),
      h('h1', {}, `Partie du ${formaterDate(partie.dateDebut)}`),
      h(
        'p',
        { class: 'discret' },
        `Niveau ${partie.difficulte}. `,
        partie.statut === 'abandonnee' ? 'Partie abandonnée.' : `Gagnant : ${gagnant?.nom ?? '—'}.`,
        ' Utilisez les flèches du clavier pour avancer coup par coup.',
      ),
      plateau,
      description,
      h(
        'div',
        { class: 'commandes' },
        h(
          'button',
          { type: 'button', class: 'bouton bouton--secondaire', onclick: () => aller(0), 'aria-label': 'Début' },
          '⏮',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'bouton bouton--secondaire',
            onclick: () => aller(index - 1),
            'aria-label': 'Coup précédent',
          },
          '◀',
        ),
        boutonLecture,
        h(
          'button',
          {
            type: 'button',
            class: 'bouton bouton--secondaire',
            onclick: () => aller(index + 1),
            'aria-label': 'Coup suivant',
          },
          '▶',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'bouton bouton--secondaire',
            onclick: () => aller(images.length - 1),
            'aria-label': 'Fin',
          },
          '⏭',
        ),
        curseur,
        compteur,
      ),
    ),
  );
  dessiner();

  return () => {
    arreter();
    document.removeEventListener('keydown', clavier);
  };
}
