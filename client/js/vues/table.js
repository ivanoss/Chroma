// Écran 3 — table de jeu (l'« arène »).
// Le client n'applique aucune règle : il affiche la vue publique envoyée par le
// serveur, n'active que les cartes listées dans `coupsJouables`, envoie l'action
// et anime les coups des bots renvoyés dans `evenements`.
import { h, vider, toast, attendre, mouvementReduit, confirmer } from '../dom.js';
import { api } from '../api.js';
import { elementCarte, dosDeCarte, libelleCarte, COULEURS, couleurCss, FORMES } from '../cartes.js';

const PLACES = { 1: ['haut'], 2: ['gauche', 'droite'], 3: ['gauche', 'haut', 'droite'] };
// Couleur de l'avatar de chaque place (0 = le joueur).
const TEINTES = ['vert', 'jaune', 'bleu', 'violet'];
const DUREE_VOL = 420;
const PAUSE_BOT = 380;

const majuscule = (s) => s[0].toUpperCase() + s.slice(1);

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

  document.body.classList.add('page-partie');

  const etat = {
    partie: reponse.partie,
    vue: reponse.vue,
    affichage: structuredClone(reponse.vue), // ce qui est dessiné (en retard pendant les animations)
    pile: [{ carte: reponse.vue.sommet, r: 0 }], // dernières cartes de la défausse, légèrement de travers
    occupe: false,
    annonce: false,
    journalOuvert: false,
    actif: true,
    departCarte: null, // position de la carte cliquée, pour l'animation
  };

  const arene = h('section', { class: 'arene', 'aria-label': 'Table de jeu' });
  const listeJournal = h('ol', {});
  const annonceVocale = h('p', { class: 'visuellement-cache', 'aria-live': 'polite' });
  conteneur.append(arene, annonceVocale);

  const nom = (i) => etat.affichage.joueurs[i].nom;

  // ---------------------------------------------------------------- dessin

  function siege(i, place) {
    const v = etat.affichage;
    const j = v.joueurs[i];
    const nb = j.nbCartes;
    const actif = v.statut === 'en_cours' && v.joueurCourant === i;
    const eventail = Math.min(nb, 9);
    return h(
      'div',
      { class: ['siege', `siege--${place}`, actif && 'actif'], dataset: { joueur: i } },
      h(
        'div',
        { class: 'siege__identite' },
        h(
          'span',
          { class: 'avatar', style: { '--c': `var(--${TEINTES[i]})` }, 'aria-hidden': 'true' },
          j.nom[0].toUpperCase(),
        ),
        h('span', { class: 'siege__nom' }, j.nom),
        h(
          'span',
          {
            class: ['siege__compte', nb === 1 && 'alerte'],
            'aria-label': nb === 1 ? 'Dernière carte' : `${nb} cartes`,
          },
          nb,
        ),
      ),
      j.main
        ? h(
            'div',
            { class: 'main-revelee' },
            j.main.map((c) => elementCarte(c, { taille: 'mini' })),
          )
        : h(
            'div',
            { class: 'eventail-dos', 'aria-hidden': 'true' },
            Array.from({ length: eventail }, (_, k) => {
              const dos = dosDeCarte('petite');
              dos.style.setProperty('--a', String((k - (eventail - 1) / 2) * 7));
              return dos;
            }),
          ),
    );
  }

  function dessiner() {
    const v = etat.affichage;
    const monTour = v.statut === 'en_cours' && v.joueurCourant === v.moi && !etat.occupe;
    const nbAdversaires = v.joueurs.length - 1;
    const penalite = v.penaliteEnCours;
    vider(arene);
    arene.style.setProperty('--actif', couleurCss(v.couleurActive));
    arene.classList.toggle('arene--deux', nbAdversaires === 2);

    // Message d'état
    let message;
    let classeMessage = 'statut';
    if (v.statut !== 'en_cours') message = v.gagnant === v.moi ? 'Vous avez gagné !' : `${nom(v.gagnant)} a gagné.`;
    else if (v.joueurCourant !== v.moi) message = `${nom(v.joueurCourant)} réfléchit…`;
    else if (etat.occupe) message = 'Vous jouez…';
    else if (penalite) {
      const type = v.typePenalite === 'plus4' ? '+4' : '+2';
      message = `Contrez avec un ${type} ou piochez ${penalite} cartes.`;
      classeMessage = 'statut statut--penalite';
    } else {
      message = v.coupsJouables.length ? 'À vous de jouer.' : 'Aucune carte jouable : piochez.';
      classeMessage = 'statut statut--mon-tour';
    }

    // Barre du haut
    arene.append(
      h(
        'div',
        { class: 'arene__barre' },
        h(
          'a',
          { class: 'bouton-arene', href: '#/', title: 'La partie reste sauvegardée : vous pourrez la reprendre.' },
          '← Accueil',
        ),
        h('p', { class: classeMessage, id: 'message-jeu' }, message),
        h(
          'div',
          { class: 'arene__outils' },
          h(
            'button',
            {
              type: 'button',
              class: 'bouton-arene',
              'aria-expanded': String(etat.journalOuvert),
              onclick: () => {
                etat.journalOuvert = !etat.journalOuvert;
                dessiner();
              },
            },
            'Journal',
          ),
          v.statut === 'en_cours' &&
            h(
              'button',
              { type: 'button', class: 'bouton-arene', disabled: etat.occupe, onclick: abandonner },
              'Abandonner',
            ),
        ),
      ),
    );

    // Adversaires
    PLACES[nbAdversaires].forEach((place, k) => arene.append(siege(k + 1, place)));

    // Centre : tourbillon (sens du jeu), pioche, défausse
    const suggererPioche = monTour && v.coupsJouables.length === 0;
    arene.append(
      h(
        'div',
        { class: 'centre' },
        h('div', { class: ['tourbillon', v.sens === -1 && 'tourbillon--inverse'], 'aria-hidden': 'true' }),
        h(
          'button',
          {
            type: 'button',
            class: ['pioche', suggererPioche && 'pioche--suggeree'],
            disabled: !monTour,
            onclick: () => envoyer({ type: 'piocher' }),
            'aria-label': penalite ? `Piocher ${penalite} cartes` : 'Piocher une carte',
          },
          dosDeCarte('grande'),
          h('span', { class: 'pioche__texte' }, penalite ? `Piocher ${penalite}` : 'Piocher'),
          h('span', { class: 'discret-table' }, `${v.taillePioche} en pioche`),
        ),
        h(
          'div',
          { class: 'defausse-zone' },
          h(
            'div',
            { class: 'defausse', 'aria-label': `Défausse : ${libelleCarte(v.sommet)}`, role: 'img' },
            etat.pile.map(({ carte, r }) => {
              const el = elementCarte(carte, { taille: 'grande' });
              el.style.setProperty('--r', `${r}deg`);
              el.removeAttribute('role');
              el.setAttribute('aria-hidden', 'true');
              return el;
            }),
          ),
          h(
            'span',
            { class: 'pastille-couleur', style: { '--c': couleurCss(v.couleurActive) } },
            `${FORMES[v.couleurActive]} ${majuscule(v.couleurActive)}`,
          ),
        ),
        h('span', { class: 'sens' }, v.sens === 1 ? '↻ Sens horaire' : '↺ Sens antihoraire'),
      ),
    );

    // Le joueur : son siège et le bouton « Dernière carte »
    const peutAnnoncer = monTour && v.main.length === 2 && v.coupsJouables.length > 0;
    if (!peutAnnoncer) etat.annonce = false;
    const moi = siege(v.moi, 'moi');
    moi.querySelector('.eventail-dos')?.remove();
    if (v.statut === 'en_cours') {
      moi.append(
        h(
          'button',
          {
            type: 'button',
            class: 'bouton-annonce',
            'aria-pressed': String(etat.annonce),
            disabled: !peutAnnoncer,
            onclick: () => {
              etat.annonce = !etat.annonce;
              dessiner();
              arene.querySelector('.bouton-annonce')?.focus();
            },
          },
          etat.annonce ? 'Annoncée !' : 'Dernière carte !',
        ),
      );
    }
    arene.append(moi);

    // Main du joueur, en éventail
    const n = v.main.length;
    const milieu = (n - 1) / 2;
    const etroit = window.innerWidth < 640;
    const pasAngle = etroit ? Math.min(2.5, 18 / Math.max(n, 1)) : Math.min(5, 36 / Math.max(n, 1));
    const courbe = milieu > 0 ? Math.min(1.2, 14 / (milieu * milieu)) : 0;
    const main = h(
      'div',
      { class: ['main-joueur', monTour && 'mon-tour'], 'aria-label': 'Votre main', role: 'group' },
      v.main.map((c, i) => {
        const jouable = monTour && v.coupsJouables.includes(c.id);
        const el = elementCarte(c, {
          bouton: true,
          jouable,
          desactivee: !jouable,
          onclick: jouable
            ? (e) => {
                etat.departCarte = e.currentTarget.getBoundingClientRect();
                jouerCarte(c);
              }
            : undefined,
        });
        el.style.setProperty('--a', String((i - milieu) * pasAngle));
        el.style.setProperty('--y', String((i - milieu) ** 2 * courbe));
        return el;
      }),
    );
    arene.append(main);

    // Journal (tiroir)
    const tiroir = h(
      'aside',
      { class: 'journal-tiroir', 'aria-label': 'Journal des coups', hidden: !etat.journalOuvert },
      h('h2', {}, 'Journal'),
      listeJournal,
    );
    arene.append(tiroir);

    requestAnimationFrame(() => ajusterMain(main));
  }

  // Les cartes se chevauchent juste assez pour tenir dans la largeur disponible.
  function ajusterMain(main) {
    const cartes = main.querySelectorAll('.carte');
    if (cartes.length < 2) return;
    const largeur = cartes[0].offsetWidth;
    const dispo = main.clientWidth - (window.innerWidth < 640 ? 44 : 24);
    const n = cartes.length;
    const necessaire = (n * largeur - dispo) / (n - 1);
    const chevauche = Math.min(largeur * 0.8, Math.max(largeur * 0.28, necessaire));
    main.style.setProperty('--chevauche', `${chevauche}px`);
  }

  // ---------------------------------------------------------------- animations

  function centreDe(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function rectSiege(position) {
    const el = arene.querySelector(`[data-joueur="${position}"] .avatar`);
    return el?.getBoundingClientRect();
  }

  // Fait voler une carte d'un endroit à un autre (positions en pixels à l'écran).
  async function voler(carteEl, de, vers, { rotation = 0, duree = DUREE_VOL } = {}) {
    if (!de || !vers || mouvementReduit()) return;
    carteEl.classList.add('carte-volante');
    carteEl.removeAttribute('role');
    carteEl.setAttribute('aria-hidden', 'true');
    document.body.append(carteEl);
    const largeur = carteEl.offsetWidth || 96;
    const a = centreDe(de);
    const b = centreDe(vers);
    carteEl.style.left = `${a.x - largeur / 2}px`;
    carteEl.style.top = `${a.y - carteEl.offsetHeight / 2}px`;
    const echelleDepart = Math.max(0.35, de.width / largeur);
    const echelleArrivee = Math.max(0.35, vers.width / largeur);
    try {
      await carteEl.animate(
        [
          { transform: `translate(0, 0) rotate(0deg) scale(${echelleDepart})` },
          {
            transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) rotate(${rotation}deg) scale(${echelleArrivee})`,
          },
        ],
        { duration: duree, easing: 'cubic-bezier(.2,.8,.25,1)' },
      ).finished;
    } finally {
      carteEl.remove();
    }
  }

  function eclat(texte, couleur = null) {
    const zone = arene.querySelector('.centre')?.getBoundingClientRect();
    if (!zone) return;
    const el = h('div', { class: 'effet', 'aria-hidden': 'true', style: { '--c': couleurCss(couleur) } }, texte);
    el.style.left = `${zone.left + zone.width / 2}px`;
    el.style.top = `${zone.top + zone.height / 2}px`;
    document.body.append(el);
    setTimeout(() => el.remove(), 1000);
  }

  function ajouterALaPile(carte) {
    if (etat.pile.at(-1)?.carte.id === carte.id) return;
    etat.pile.push({ carte, r: Math.round(Math.random() * 28 - 14) });
    if (etat.pile.length > 3) etat.pile.shift();
  }

  function texteEclat(evt) {
    const c = evt.carte;
    switch (c.type) {
      case 'plus2':
        return '+2';
      case 'plus4':
        return '+4';
      case 'passe':
        return 'Passe !';
      case 'inversion':
        return 'Inversion !';
      case 'couleur':
        return `${majuscule(evt.couleurChoisie)} !`;
      default:
        return null;
    }
  }

  async function animerPioche(position, nombre) {
    const deck = arene.querySelector('.pioche .carte')?.getBoundingClientRect();
    const main = arene.querySelector('.main-joueur')?.getBoundingClientRect();
    const cible = position === etat.affichage.moi ? main && centreRect(main) : rectSiege(position);
    const vols = [];
    for (let k = 0; k < Math.min(nombre, 4); k++) {
      vols.push(attendre(k * 90).then(() => voler(dosDeCarte('grande'), deck, cible, { duree: 380 })));
    }
    await Promise.all(vols);
  }

  // Petit rectangle au centre d'une zone (pour viser le milieu de la main).
  function centreRect(r) {
    const c = centreDe(r);
    return { left: c.x - 30, top: c.y - 44, width: 60, height: 88 };
  }

  // Joue un événement à l'écran : vol de carte, mise à jour de l'affichage, effet.
  async function jouerEvenement(evt) {
    const v = etat.affichage;
    const humain = evt.position === v.moi;
    const j = v.joueurs[evt.position];
    if (evt.type === 'jouer') {
      const de = humain ? etat.departCarte : rectSiege(evt.position);
      const vers = arene.querySelector('.defausse')?.getBoundingClientRect();
      if (humain) {
        v.main = v.main.filter((c) => c.id !== evt.carte.id);
        v.coupsJouables = [];
        dessiner();
      }
      await voler(elementCarte(evt.carte, { taille: 'grande' }), de, vers, {
        rotation: Math.round(Math.random() * 24 - 12),
      });
      ajouterALaPile(evt.carte);
      v.sommet = evt.carte;
      v.couleurActive = evt.couleurChoisie ?? evt.carte.couleur;
      v.penaliteEnCours = 0;
      if (!humain) j.nbCartes -= 1;
      dessiner();
      const texte = texteEclat(evt);
      if (texte) eclat(texte, v.couleurActive);
      if (evt.derniereCarte) setTimeout(() => eclat('Dernière carte !', 'jaune'), texte ? 500 : 0);
      if (evt.cartesPiochees > 0) {
        await animerPioche(evt.position, evt.cartesPiochees);
        if (!humain) j.nbCartes += evt.cartesPiochees;
        dessiner();
      }
    } else {
      await animerPioche(evt.position, evt.cartesPiochees);
      if (!humain) j.nbCartes += evt.cartesPiochees;
      v.penaliteEnCours = 0;
      dessiner();
      if (evt.cartesPiochees > 1) eclat(`+${evt.cartesPiochees}`);
    }
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

  async function animer(evenements, vueFinale) {
    const [premier, ...bots] = evenements;
    if (premier) {
      ajouterJournal(premier);
      await jouerEvenement(premier);
    }
    for (const evt of bots) {
      if (!etat.actif) return;
      etat.affichage.joueurCourant = evt.position;
      dessiner();
      await attendre(mouvementReduit() ? 120 : PAUSE_BOT);
      if (!etat.actif) return;
      ajouterJournal(evt);
      await jouerEvenement(evt);
    }
    if (!etat.actif) return;
    etat.vue = vueFinale;
    etat.affichage = structuredClone(vueFinale);
    ajouterALaPile(vueFinale.sommet);
    etat.occupe = false;
    dessiner();
    if (vueFinale.statut !== 'en_cours') {
      if (vueFinale.gagnant === vueFinale.moi) eclat('Victoire !', 'jaune');
      await attendre(mouvementReduit() ? 0 : 700);
      afficherFin();
    }
  }

  // ---------------------------------------------------------------- actions

  async function envoyer(action) {
    if (etat.occupe) return;
    etat.occupe = true;
    if (action.type === 'piocher') etat.departCarte = null;
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
        ajouterALaPile(frais.vue.sommet);
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
              `${FORMES[c]} ${majuscule(c)}`,
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

    const rejouer = h(
      'button',
      {
        type: 'button',
        class: 'bouton',
        onclick: async () => {
          rejouer.disabled = true;
          try {
            await api.nouvellePartie(etat.partie.difficulte, v.joueurs.length - 1);
            dialogue.close();
            // On redessine l'écran de jeu avec la nouvelle partie.
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } catch (err) {
            rejouer.disabled = false;
            toast(err.message, 'erreur');
          }
        },
      },
      'Rejouer',
    );

    const dialogue = h(
      'dialog',
      { 'aria-labelledby': 'titre-fin', class: 'dialogue-fin' },
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
        rejouer,
        h('a', { class: 'bouton bouton--secondaire', href: `#/historique/${etat.partie.id}` }, 'Revoir la partie'),
        h('a', { class: 'bouton bouton--secondaire', href: '#/' }, 'Retour à l’accueil'),
      ),
    );
    dialogue.addEventListener('click', (e) => {
      if (e.target.closest('a')) dialogue.close();
    });
    dialogue.addEventListener('close', () => dialogue.remove());
    document.body.append(dialogue);
    dialogue.showModal();
  }

  const redimensionner = () => {
    const main = arene.querySelector('.main-joueur');
    if (main) ajusterMain(main);
  };
  window.addEventListener('resize', redimensionner);

  dessiner();
  return () => {
    etat.actif = false;
    window.removeEventListener('resize', redimensionner);
    document.body.classList.remove('page-partie');
    document.querySelectorAll('.carte-volante, .effet').forEach((el) => el.remove());
  };
}
