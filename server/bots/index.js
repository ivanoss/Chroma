import { choisirActionFacile } from './botFacile.js';
import { choisirActionMoyen } from './botMoyen.js';
import { choisirActionDifficile } from './botDifficile.js';

export const DIFFICULTES = ['facile', 'moyen', 'difficile'];

const BOTS = {
  facile: choisirActionFacile,
  moyen: choisirActionMoyen,
  difficile: choisirActionDifficile,
};

export function choisirActionBot(difficulte, etat, indexJoueur, aleatoire = Math.random) {
  const bot = BOTS[difficulte];
  if (!bot) throw new Error(`Difficulté inconnue : ${difficulte}`);
  return bot(etat, indexJoueur, aleatoire);
}
