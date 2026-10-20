// Règles du jeu (public).
import { h } from '../dom.js';
import { elementCarte } from '../cartes.js';

const c = (couleur, type, valeur = null) => ({ id: `${couleur}${type}${valeur}`, couleur, type, valeur });

export function vueRegles(conteneur) {
  conteneur.append(
    h(
      'article',
      { class: 'panneau regles' },
      h('h1', {}, 'Règles de Chroma'),
      h(
        'section',
        {},
        h('h2', {}, 'Le but'),
        h(
          'p',
          {},
          'Être le premier à poser toutes ses cartes. Chaque joueur reçoit 7 cartes ; une carte chiffre est retournée pour commencer la défausse.',
        ),
      ),
      h(
        'section',
        {},
        h('h2', {}, 'Jouer une carte'),
        h(
          'p',
          {},
          'À votre tour, posez une carte de la même couleur, du même chiffre ou du même symbole que la carte du dessus. Sur un 7 bleu, on peut poser n’importe quel bleu ou n’importe quel 7.',
        ),
        h(
          'div',
          { class: 'exemple', 'aria-hidden': 'true' },
          elementCarte(c('bleu', 'nombre', 7), { taille: 'petite' }),
          elementCarte(c('bleu', 'nombre', 2), { taille: 'petite' }),
          elementCarte(c('rouge', 'nombre', 7), { taille: 'petite' }),
        ),
        h('p', {}, 'Si vous ne pouvez ou ne voulez rien poser, piochez une carte : votre tour est terminé.'),
      ),
      h(
        'section',
        {},
        h('h2', {}, 'Les cartes spéciales'),
        h(
          'dl',
          {},
          elementCarte(c('vert', 'inversion'), { taille: 'petite' }),
          h(
            'dd',
            {},
            h('strong', {}, 'Inversion. '),
            'Le sens du jeu change. À deux joueurs, elle agit comme une passe : vous rejouez.',
          ),
          elementCarte(c('jaune', 'passe'), { taille: 'petite' }),
          h('dd', {}, h('strong', {}, 'Passe. '), 'Le joueur suivant passe son tour.'),
          elementCarte(c('rouge', 'plus2'), { taille: 'petite' }),
          h(
            'dd',
            {},
            h('strong', {}, '+2. '),
            'Le joueur suivant pioche 2 cartes et perd son tour, sauf s’il pose lui aussi un +2 : la pénalité se cumule et passe au suivant.',
          ),
          elementCarte(c(null, 'couleur'), { taille: 'petite' }),
          h(
            'dd',
            {},
            h('strong', {}, 'Changement de couleur. '),
            'Se pose sur n’importe quelle carte ; vous choisissez la nouvelle couleur.',
          ),
          elementCarte(c(null, 'plus4'), { taille: 'petite' }),
          h(
            'dd',
            {},
            h('strong', {}, '+4. '),
            'Changement de couleur, et le suivant pioche 4 cartes. Seul un autre +4 peut le contrer.',
          ),
        ),
      ),
      h(
        'section',
        {},
        h('h2', {}, 'Dernière carte'),
        h(
          'p',
          {},
          'Quand vous posez votre avant-dernière carte, appuyez sur « Annoncer Dernière carte » avant de jouer. Si vous oubliez, vous piochez 2 cartes.',
        ),
      ),
      h(
        'section',
        {},
        h('h2', {}, 'Pioche vide'),
        h(
          'p',
          {},
          'Quand la pioche est vide, la défausse est mélangée pour en refaire une (sauf la carte du dessus). Si plus aucune carte ne peut être piochée et que personne ne peut jouer, la partie s’arrête : le joueur qui a le moins de points en main gagne (chiffres à leur valeur, actions 20, jokers 50).',
        ),
      ),
      h(
        'section',
        {},
        h('h2', {}, 'Les formes'),
        h('p', {}, 'Chaque couleur a aussi sa forme, dans le coin des cartes : ▲ rouge, ● jaune, ■ vert, ◆ bleu.'),
      ),
    ),
  );
}
