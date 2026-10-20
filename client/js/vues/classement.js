// Classement général (public).
import { h, formaterDuree, pourcentage } from '../dom.js';
import { api } from '../api.js';
import { obtenirSession } from '../session.js';

export async function vueClassement(conteneur) {
  const { classement } = await api.classement();
  const moi = obtenirSession()?.utilisateur?.nomUtilisateur;

  conteneur.append(
    h(
      'section',
      { class: 'panneau' },
      h('h1', {}, 'Classement'),
      h(
        'p',
        { class: 'discret' },
        api.autonome
          ? 'Joueurs de cet appareil, classés par nombre de victoires, puis par taux de victoire et meilleure série.'
          : 'Classé par nombre de victoires, puis par taux de victoire et meilleure série.',
      ),
      classement.length
        ? h(
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
                  h('th', {}, 'Rang'),
                  h('th', {}, 'Joueur'),
                  h('th', { class: 'nombre' }, 'Victoires'),
                  h('th', { class: 'nombre' }, 'Parties'),
                  h('th', { class: 'nombre' }, 'Taux'),
                  h('th', { class: 'nombre' }, 'Meilleure série'),
                  h('th', { class: 'nombre' }, 'Durée moyenne'),
                ),
              ),
              h(
                'tbody',
                {},
                classement.map((l) =>
                  h(
                    'tr',
                    { class: l.nomUtilisateur === moi ? 'moi' : undefined },
                    h('td', { class: l.rang <= 3 ? 'rang-podium' : undefined }, l.rang),
                    h('td', {}, l.nomUtilisateur),
                    h('td', { class: 'nombre' }, l.partiesGagnees),
                    h('td', { class: 'nombre' }, l.partiesJouees),
                    h('td', { class: 'nombre' }, pourcentage(l.tauxVictoire)),
                    h('td', { class: 'nombre' }, l.meilleureSerie),
                    h('td', { class: 'nombre' }, formaterDuree(l.dureeMoyenneSec)),
                  ),
                ),
              ),
            ),
          )
        : h('div', { class: 'vide' }, h('p', {}, 'Le classement est vide : terminez une partie pour y apparaître.')),
    ),
  );
}
