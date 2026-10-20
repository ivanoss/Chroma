// Écran 3 — table de jeu.
// Le client n'applique aucune règle : il affiche la vue publique envoyée par le
// serveur, n'active que les cartes listées dans `coupsJouables`, envoie l'action
// et anime les coups des bots renvoyés dans `evenements`.
import { h, vider, toast, attendre, mouvementReduit, confirmer } from '../dom.js';
import { api } from '../api.js';
import { elementCarte, dosDeCarte, libelleCarte, COULEURS, couleurCss, FORMES } from '../cartes.js';

const DELAI_BOT = 650; // un court délai entre les coups des bots rend la partie lisible

const PLACES = { 1: ['haut'], 2: ['gauche', 'droite'], 3: ['gauche', 'haut', 'droite'] };

export async function vueTable(conteneur) {
  const reponse = await api.partieEnCours();
  if (!reponse.partie) {
    conteneur.append(
      h(
        'div',
        { class: 'panneau vide' },
        h('h1', {}, 'Aucune partie en cours'),
        h('p', {}, 'Lancez une partie depuis l’accueil pour vous asseoir à la table.'),
        h('a', { class: 'bouton', href: '#/' }, 'Aller à l’accueil'),
      ),
    );
    return;
  }

  const etat = {
    partie: reponse.partie,
    vue: reponse.vue,
    affichage: structuredClone(reponse.vue), // ce qui est dessiné (peut être en retard pendant l'animation)
    occupe: false,
    annonce: false,
    journal: [],
    actif: true,
  };

  const plateau = h('section', { class: 'plateau', 'aria-label': 'Table de jeu' });
  const listeJournal = h('ol', {});
  const journal = h(
    'aside',
    { class: 'journal', 'aria-label': 'Journal des coups' },
    h('h2', {}, 'Journal'),
    listeJournal,
  );
  const annonceVocale = h('p', { class: 'visuellement-cache', 'aria-live': 'polite' });
  conteneur.append(h('div', { class: 'jeu' }, plateau, journal), annonceVocale);

  const nom = (i) => etat.affichage.joueurs[i].nom;

  // ---------------------------------------------------------------- dessin
  function dessiner() {
    const v = etat.affichage;
    const monTour = v.statut === 'en_cours' && v.joueurCourant === v.moi && !etat.occupe;
    const nbAdversaires = v.joueurs.length - 1;
    plateau.classList.toggle('deux-adversaires', nbAdversaires === 2);
    vider(plateau);

    // Adversaires
    PLACES[nbAdversaires].forEach((place, k) => {
      const i = k + 1;
      const j = v.joueurs[i];
      const nb = j.nbCartes;
      plateau.append(
        h(
          'div',
          {
            class: ['adversaire', `adversaire--${place}`, v.joueurCourant === i && v.statut === 'en_cours' && 'actif'],
            dataset: { joueur: i },
          },
          h('span', { class: 'adversaire__nom' }, j.nom),
          j.main
            ? h(
                'div',
                { class: 'main-revelee' },
                j.main.map((c) => elementCarte(c, { taille: 'mini' })),
              )
            : h(
                'div',
                { class: 'dos-eventail' },
                Array.from({ length: Math.min(nb, 10) }, () => dosDeCarte('mini')),
              ),
          h(
            'span',
            { class: ['adversaire__compte', nb === 1 && 'alerte'] },
            nb === 1 ? 'Dernière carte !' : `${nb} cartes`,
          ),
        ),
      );
    });

    // Centre : pioche, défausse, sens
    const penalite = v.penaliteEnCours;
    const peutPiocher = monTour;
    plateau.append(
      h(
        'div',
        { class: 'centre' },
        h(
          'button',
          {
            type: 'button',
            class: 'pioche',
            disabled: !peutPiocher,
            onclick: () => envoyer({ type: 'piocher' }),
            'aria-label': penalite ? `Piocher ${penalite} cartes` : 'Piocher une carte',
          },
          dosDeCarte('grande'),
          h('span', { class: 'pioche__texte' }, penalite ? `Piocher ${penalite}` : 'Piocher'),
          h('span', { class: 'discret-table' }, `${v.taillePioche} en pioche`),
        ),
        h(
          'div',
          { class: 'defausse' },
          h(
            'div',
            { class: 'defausse__anneau', style: { '--anneau': couleurCss(v.couleurActive) } },
            elementCarte(v.sommet, { taille: 'grande' }),
          ),
          h('span', { class: 'defausse__couleur' }, `${FORMES[v.couleurActive]} Couleur : ${v.couleurActive}`),
        ),
        h(
          'div',
          { class: 'sens' },
          h('span', { class: 'sens__fleche', 'aria-hidden': 'true' }, v.sens === 1 ? '↻' : '↺'),
          v.sens === 1 ? 'Sens horaire' : 'Sens antihoraire',
        ),
      ),
    );

    // Message d'état
    let message;
    let classeMessage = 'statut';
    if (v.statut !== 'en_cours') message = v.gagnant === v.moi ? 'Vous avez gagné !' : `${nom(v.gagnant)} a gagné.`;
    else if (v.joueurCourant !== v.moi) message = `${nom(v.joueurCourant)} réfléchit…`;
    else if (penalite) {
      const type = v.typePenalite === 'plus4' ? '+4' : '+2';
      message = `Contrez avec un ${type} ou piochez ${penalite} cartes.`;
      classeMessage = 'statut statut--penalite';
    } else message = v.coupsJouables.length ? 'À vous de jouer.' : 'Aucune carte jouable : piochez.';
    plateau.append(h('p', { class: classeMessage, id: 'message-jeu' }, message));

    // Main du joueur
    plateau.append(
      h(
        'div',
        { class: ['main-joueur', monTour && 'mon-tour'], 'aria-label': 'Votre main', role: 'group' },
        v.main.map((c) => {
          const jouable = monTour && v.coupsJouables.includes(c.id);
          return elementCarte(c, {
            bouton: true,
            jouable,
            desactivee: !jouable,
            onclick: jouable ? () => jouerCarte(c) : undefined,
          });
        }),
      ),
    );

    // Actions
    const peutAnnoncer = monTour && v.main.length === 2 && v.coupsJouables.length > 0;
    if (!peutAnnoncer) etat.annonce = false;
    plateau.append(
      h(
        'div',
        { class: 'actions-jeu' },
        v.statut === 'en_cours' &&
          h(
            'button',
            {
              type: 'button',
              class: 'bouton bouton-annonce',
              'aria-pressed': String(etat.annonce),
              disabled: !peutAnnoncer,
              onclick: () => {
                etat.annonce = !etat.annonce;
                dessiner();
                plateau.querySelector('.bouton-annonce')?.focus();
              },
            },
            etat.annonce ? 'Dernière carte annoncée' : 'Annoncer « Dernière carte »',
          ),
        v.statut === 'en_cours' &&
          h(
            'button',
            { type: 'button', class: 'bouton bouton--secondaire', disabled: etat.occupe, onclick: abandonner },
            'Abandonner',
          ),
      ),
    );
  }

  function ajouterJournal(evt) {
    const carte = evt.carte;
    let texte;
    if (evt.type === 'jouer') {
      texte = `${evt.nom} joue ${libelleCarte(carte)}`;
      if (evt.couleurChoisie) texte += ` et choisit le ${evt.couleurChoisie}`;
      if (evt.derniereCarte) texte += ' — « Dernière carte ! »';
      if (evt.cartesPiochees > 0) texte += ` (oubli de l’annonce : +${evt.cartesPiochees})`;
    } else {
      texte = `${evt.nom} pioche ${evt.cartesPiochees} carte${evt.cartesPiochees > 1 ? 's' : ''}`;
    }
    const couleur = evt.type === 'jouer' ? (evt.couleurChoisie ?? carte.couleur) : null;
    listeJournal.prepend(
      h(
        'li',
        {},
        h('span', { class: 'journal__tour' }, evt.numeroTour),
        h('span', { class: 'puce', style: { '--c': couleurCss(couleur) }, 'aria-hidden': 'true' }),
        h('span', {}, texte),
      ),
    );
    annonceVocale.textContent = texte;
  }

  // Met à jour l'affichage avec un coup de bot, sans attendre la vue finale.
  function appliquerEvenementAffichage(evt) {
    const v = etat.affichage;
    const j = v.joueurs[evt.position];
    if (evt.type === 'jouer') {
      j.nbCartes += evt.cartesPiochees - 1;
      v.sommet = evt.carte;
      v.couleurActive = evt.couleurChoisie ?? evt.carte.couleur;
    } else {
      j.nbCartes += evt.cartesPiochees;
      v.penaliteEnCours = 0;
    }
  }

  async function animer(evenements, vueFinale) {
    const [premier, ...bots] = evenements;
    if (premier) ajouterJournal(premier);
    // Après le coup du joueur, on affiche sa main à jour et on anime les bots.
    etat.affichage = { ...structuredClone(etat.affichage), main: vueFinale.main, coupsJouables: [] };
    if (premier?.type === 'jouer') {
      etat.affichage.sommet = premier.carte;
      etat.affichage.couleurActive = premier.couleurChoisie ?? premier.carte.couleur;
    }
    etat.affichage.penaliteEnCours = 0;
    for (const evt of bots) {
      if (!etat.actif) return;
      etat.affichage.joueurCourant = evt.position;
      dessiner();
      await attendre(mouvementReduit() ? 150 : DELAI_BOT);
      appliquerEvenementAffichage(evt);
      ajouterJournal(evt);
    }
    etat.vue = vueFinale;
    etat.affichage = structuredClone(vueFinale);
    etat.occupe = false;
    dessiner();
    if (vueFinale.statut !== 'en_cours') afficherFin();
  }

  // ---------------------------------------------------------------- actions
  async function envoyer(action) {
    if (etat.occupe) return;
    etat.occupe = true;
    dessiner();
    try {
      const res = await api.jouer(etat.partie.id, action, etat.vue.numeroTour);
      etat.annonce = false;
      etat.partie = res.partie;
      await animer(res.evenements, res.vue);
    } catch (err) {
      etat.occupe = false;
      if (err.statut === 409) {
        // Coup périmé (double clic, autre onglet) : on se resynchronise sur le serveur.
        const frais = await api.partie(etat.partie.id);
        etat.vue = frais.vue;
        etat.affichage = structuredClone(frais.vue);
      }
      toast(err.message, 'erreur');
      dessiner();
    }
  }

  function jouerCarte(carte) {
    const base = { type: 'jouer', idCarte: carte.id, derniereCarte: etat.annonce };
    if (carte.couleur) return envoyer(base);
    choisirCouleur().then((couleur) => couleur && envoyer({ ...base, couleurChoisie: couleur }));
  }

  function choisirCouleur() {
    return new Promise((resoudre) => {
      const dialogue = h(
        'dialog',
        { 'aria-labelledby': 'titre-couleur' },
        h('h2', { id: 'titre-couleur' }, 'Choisissez la couleur'),
        h(
          'div',
          { class: 'choix-couleurs' },
          COULEURS.map((c) =>
            h(
              'button',
              {
                type: 'button',
                dataset: { couleur: c },
                style: { '--c': `var(--${c})` },
                onclick: () => {
                  dialogue.close();
                  resoudre(c);
                },
              },
              `${FORMES[c]} ${c[0].toUpperCase()}${c.slice(1)}`,
            ),
          ),
        ),
        h('button', { type: 'button', class: 'bouton bouton--secondaire', onclick: () => dialogue.close() }, 'Annuler'),
      );
      dialogue.addEventListener('close', () => {
        dialogue.remove();
        resoudre(null);
      });
      document.body.append(dialogue);
      dialogue.showModal();
    });
  }

  async function abandonner() {
    if (
      !(await confirmer('Abandonner la partie ? Elle comptera comme une défaite.', {
        action: 'Abandonner',
        danger: true,
      }))
    )
      return;
    try {
      await api.abandonner(etat.partie.id);
      toast('Partie abandonnée.');
      location.hash = '#/';
    } catch (err) {
      toast(err.message, 'erreur');
    }
  }

  function afficherFin() {
    const v = etat.vue;
    const ordre = v.joueurs
      .map((j, i) => ({ nom: j.nom, rang: v.rangs[i], nb: j.nbCartes }))
      .sort((a, b) => a.rang - b.rang);
    const gagne = v.gagnant === v.moi;
    const dialogue = h(
      'dialog',
      { 'aria-labelledby': 'titre-fin' },
      h('h2', { id: 'titre-fin' }, gagne ? 'Victoire !' : `${nom(v.gagnant)} remporte la partie`),
      v.finParBlocage && h('p', {}, 'Plus aucune carte à piocher : la partie s’arrête aux points.'),
      h(
        'ol',
        { class: 'resultats' },
        ordre.map((o) =>
          h(
            'li',
            {},
            h('span', {}, `${o.rang}. ${o.nom}`),
            h('span', {}, o.nb ? `${o.nb} carte${o.nb > 1 ? 's' : ''}` : 'main vide'),
          ),
        ),
      ),
      h(
        'div',
        { class: 'dialogue__actions' },
        h('a', { class: 'bouton', href: '#/' }, 'Nouvelle partie'),
        h('a', { class: 'bouton bouton--secondaire', href: `#/historique/${etat.partie.id}` }, 'Revoir la partie'),
      ),
    );
    dialogue.addEventListener('click', (e) => {
      if (e.target.closest('a')) dialogue.close();
    });
    dialogue.addEventListener('close', () => dialogue.remove());
    document.body.append(dialogue);
    dialogue.showModal();
  }

  dessiner();
  return () => {
    etat.actif = false;
  };
}
