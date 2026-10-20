// Affichage des cartes. Aucune règle de jeu ici : le serveur dit ce qui est jouable.
import { h } from './dom.js';

export const COULEURS = ['rouge', 'jaune', 'vert', 'bleu'];
export const NOMS_COULEURS = { rouge: 'rouge', jaune: 'jaune', vert: 'vert', bleu: 'bleu' };
// Une forme par couleur pour ne pas dépendre de la couleur seule.
export const FORMES = { rouge: '▲', jaune: '●', vert: '■', bleu: '◆' };

const SYMBOLES = { inversion: '⇄', passe: '⊘', plus2: '+2', couleur: '', plus4: '+4' };
const NOMS_TYPES = {
  inversion: 'Inversion',
  passe: 'Passe',
  plus2: '+2',
  couleur: 'Changement de couleur',
  plus4: '+4',
};

export function libelleCarte(carte) {
  if (!carte) return '';
  if (carte.type === 'nombre') return `${carte.valeur} ${carte.couleur}`;
  if (!carte.couleur) return NOMS_TYPES[carte.type];
  return `${NOMS_TYPES[carte.type]} ${carte.couleur}`;
}

export function symbole(carte) {
  return carte.type === 'nombre' ? String(carte.valeur) : SYMBOLES[carte.type];
}

// options : { taille: 'mini' | 'petite' | 'grande', jouable, onclick, desactivee }
export function elementCarte(carte, options = {}) {
  const classes = [
    'carte',
    carte.couleur ? `carte--${carte.couleur}` : 'carte--joker',
    options.taille && `carte--${options.taille}`,
    options.jouable && 'carte--jouable',
  ];
  const contenu = [
    options.taille !== 'mini' && h('span', { class: 'carte__coin', 'aria-hidden': 'true' }, symbole(carte)),
    h('span', { class: 'carte__centre', 'aria-hidden': 'true' }, symbole(carte)),
    carte.couleur &&
      options.taille !== 'mini' &&
      h('span', { class: 'carte__forme', 'aria-hidden': 'true' }, FORMES[carte.couleur]),
  ];
  if (options.onclick || options.bouton) {
    return h(
      'button',
      {
        type: 'button',
        class: classes,
        'aria-label': libelleCarte(carte) + (options.jouable ? ', jouable' : ''),
        disabled: options.desactivee,
        onclick: options.onclick,
        dataset: { id: carte.id },
      },
      contenu,
    );
  }
  return h(
    'div',
    { class: classes, role: 'img', 'aria-label': libelleCarte(carte), dataset: { id: carte.id } },
    contenu,
  );
}

export function dosDeCarte(taille = 'mini') {
  return h('div', { class: ['carte', 'carte--dos', `carte--${taille}`], 'aria-hidden': 'true' });
}

export function couleurCss(couleur) {
  return couleur ? `var(--${couleur})` : 'var(--encre-douce)';
}
