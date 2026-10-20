// Point d'entrée du client : routeur par fragment d'URL (#/...) et navigation.
import { h, vider, toast } from './dom.js';
import { api } from './api.js';
import { estConnecte, estAdmin, obtenirSession, fermerSession } from './session.js';
import { vueConnexion } from './vues/connexion.js';
import { vueAccueil } from './vues/accueil.js';
import { vueTable } from './vues/table.js';
import { vueHistorique, vueRejeu } from './vues/historique.js';
import { vueClassement } from './vues/classement.js';
import { vueRegles } from './vues/regles.js';
import { vueAdmin } from './vues/admin.js';

const ROUTES = [
  {
    motif: /^\/?$/,
    vue: (c) => (estConnecte() ? vueAccueil(c) : vueConnexion(c)),
    titre: 'Accueil',
  },
  { motif: /^\/connexion$/, vue: vueConnexion, titre: 'Connexion' },
  { motif: /^\/partie$/, vue: vueTable, protegee: true, titre: 'Partie' },
  {
    motif: /^\/historique$/,
    vue: vueHistorique,
    protegee: true,
    titre: 'Historique',
  },
  {
    motif: /^\/historique\/(\d+)$/,
    vue: vueRejeu,
    protegee: true,
    titre: 'Rejeu',
  },
  { motif: /^\/classement$/, vue: vueClassement, titre: 'Classement' },
  { motif: /^\/regles$/, vue: vueRegles, titre: 'Règles' },
  {
    motif: /^\/admin$/,
    vue: vueAdmin,
    protegee: true,
    admin: true,
    titre: 'Administration',
  },
];

const contenu = document.getElementById('contenu');
let nettoyage = null;

function lienNav(chemin, texte) {
  const actuel = (location.hash.slice(1) || '/') === chemin;
  return h('a', { href: `#${chemin}`, 'aria-current': actuel ? 'page' : undefined }, texte);
}

function dessinerNav() {
  const nav = vider(document.getElementById('nav'));
  if (estConnecte()) {
    nav.append(
      ...[
        lienNav('/', 'Accueil'),
        lienNav('/historique', 'Historique'),
        lienNav('/classement', 'Classement'),
        lienNav('/regles', 'Règles'),
        estAdmin() && lienNav('/admin', 'Admin'),
        h('span', { class: 'nav__moi' }, obtenirSession().utilisateur.nomUtilisateur),
        h(
          'button',
          {
            type: 'button',
            onclick: async () => {
              await api.deconnexion().catch(() => {});
              fermerSession();
              toast('Vous êtes déconnecté.');
              location.hash = '#/';
              naviguer();
            },
          },
          'Se déconnecter',
        ),
      ].filter(Boolean),
    );
  } else {
    nav.append(
      lienNav('/regles', 'Règles'),
      lienNav('/classement', 'Classement'),
      lienNav('/connexion', 'Se connecter'),
    );
  }
}

export async function naviguer() {
  const chemin = location.hash.slice(1) || '/';
  const route = ROUTES.find((r) => r.motif.test(chemin));
  if (typeof nettoyage === 'function') nettoyage();
  nettoyage = null;

  if (!route) {
    location.hash = '#/';
    return;
  }
  if (route.protegee && !estConnecte()) {
    location.hash = '#/connexion';
    return;
  }
  if (route.admin && !estAdmin()) {
    location.hash = '#/';
    return;
  }

  dessinerNav();
  document.title = `${route.titre} · Chroma`;
  // Chaque écran se dessine dans sa propre zone : si l'utilisateur change de page
  // pendant un chargement, l'ancien écran se dessine dans une zone détachée.
  const zone = h('div', {});
  contenu.replaceChildren(zone);
  const params = chemin.match(route.motif).slice(1);
  try {
    const retour = await route.vue(zone, ...params);
    if (zone.isConnected) nettoyage = retour;
    else if (typeof retour === 'function') retour();
  } catch (err) {
    zone.append(h('p', { class: 'message-erreur' }, err.message));
  }
  contenu.focus({ preventScroll: true });
}

window.addEventListener('hashchange', naviguer);

// Au chargement, on vérifie que le jeton stocké est toujours valide.
if (estConnecte()) {
  api.moi().catch(() => {});
}
naviguer();
