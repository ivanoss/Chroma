// Tableau de bord administrateur.
import { h, vider, toast, formaterDate, confirmer } from '../dom.js';
import { api } from '../api.js';
import { obtenirSession } from '../session.js';

const STATUTS = { en_cours: 'En cours', terminee: 'Terminée', abandonnee: 'Abandonnée' };

export async function vueAdmin(conteneur) {
  const zoneComptes = h('div', { class: 'tableau-conteneur' });
  const zoneParties = h('div', { class: 'tableau-conteneur' });
  const resume = h('p', { class: 'discret' });
  const moi = obtenirSession().utilisateur.id;

  async function charger() {
    const [{ utilisateurs }, { parties }] = await Promise.all([api.adminUtilisateurs(), api.adminParties()]);
    const abandonnees = parties.filter((p) => p.statut === 'abandonnee').length;
    resume.textContent = `${utilisateurs.length} comptes, ${parties.length} parties dont ${abandonnees} abandonnées.`;
    boutonPurge.disabled = abandonnees === 0;

    vider(zoneComptes).append(
      h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ['Nom', 'Courriel', 'Rôle', 'Inscription', 'Parties', 'Victoires', 'État', ''].map((t, i) =>
              h('th', { class: i === 4 || i === 5 ? 'nombre' : undefined }, t),
            ),
          ),
        ),
        h(
          'tbody',
          {},
          utilisateurs.map((u) =>
            h(
              'tr',
              {},
              h('td', {}, u.nomUtilisateur),
              h('td', {}, u.courriel),
              h('td', {}, u.role === 'admin' ? 'Admin' : 'Joueur'),
              h('td', {}, formaterDate(u.dateInscription)),
              h('td', { class: 'nombre' }, u.partiesJouees),
              h('td', { class: 'nombre' }, u.partiesGagnees),
              h('td', {}, u.actif ? 'Actif' : h('span', { class: 'pastille pastille--abandon' }, 'Désactivé')),
              h(
                'td',
                {},
                u.id !== moi &&
                  h(
                    'button',
                    {
                      type: 'button',
                      class: ['bouton', 'bouton--petit', u.actif ? 'bouton--danger' : 'bouton--secondaire'],
                      onclick: async () => {
                        try {
                          await api.adminActiver(u.id, !u.actif);
                          toast(u.actif ? `${u.nomUtilisateur} est désactivé.` : `${u.nomUtilisateur} est réactivé.`);
                          charger();
                        } catch (err) {
                          toast(err.message, 'erreur');
                        }
                      },
                    },
                    u.actif ? 'Désactiver' : 'Réactiver',
                  ),
              ),
            ),
          ),
        ),
      ),
    );

    vider(zoneParties).append(
      parties.length
        ? h(
            'table',
            {},
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                ['N°', 'Joueur', 'Niveau', 'Joueurs', 'Statut', 'Début', 'Coups'].map((t) => h('th', {}, t)),
              ),
            ),
            h(
              'tbody',
              {},
              parties.map((p) =>
                h(
                  'tr',
                  {},
                  h('td', {}, p.id),
                  h('td', {}, p.joueur),
                  h('td', {}, p.difficulte),
                  h('td', {}, p.nbJoueurs),
                  h('td', {}, STATUTS[p.statut]),
                  h('td', {}, formaterDate(p.dateDebut)),
                  h('td', {}, p.nbCoups),
                ),
              ),
            ),
          )
        : h('p', { class: 'vide' }, 'Aucune partie pour le moment.'),
    );
  }

  const boutonPurge = h(
    'button',
    {
      type: 'button',
      class: 'bouton bouton--danger',
      onclick: async () => {
        if (
          !(await confirmer('Supprimer définitivement toutes les parties abandonnées ?', {
            action: 'Supprimer',
            danger: true,
          }))
        )
          return;
        const { supprimees } = await api.adminPurger();
        toast(`${supprimees} partie${supprimees > 1 ? 's' : ''} supprimée${supprimees > 1 ? 's' : ''}.`);
        charger();
      },
    },
    'Supprimer les parties abandonnées',
  );

  conteneur.append(
    h('h1', {}, 'Administration'),
    resume,
    h('section', { class: 'panneau' }, h('h2', {}, 'Comptes'), zoneComptes),
    h('br'),
    h('section', { class: 'panneau' }, h('h2', {}, 'Parties'), h('p', {}, boutonPurge), zoneParties),
  );
  await charger();
}
