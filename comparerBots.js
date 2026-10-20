// Compare les trois niveaux de bots sur un grand nombre de parties.
// Usage : node server/scripts/comparerBots.js [nombreDeParties]
//
// Chaque niveau joue contre trois adversaires d'un niveau donné ; il change de
// place à chaque partie. Au hasard, on gagnerait 25 % du temps.
import { creerPartie, appliquerAction } from '../moteur/moteur.js';
import { creerAleatoire } from '../moteur/aleatoire.js';
import { choisirActionBot, DIFFICULTES } from '../bots/index.js';

export function tauxDeVictoire(niveau, adversaires, parties) {
  let victoires = 0;
  for (let graine = 1; graine <= parties; graine++) {
    const place = graine % 4;
    const niveaux = [adversaires, adversaires, adversaires, adversaires];
    niveaux[place] = niveau;
    const aleatoire = creerAleatoire(graine);
    let etat = creerPartie({ noms: niveaux, aleatoire });
    while (etat.statut === 'en_cours') {
      const i = etat.joueurCourant;
      const action = choisirActionBot(niveaux[i], etat, i, aleatoire);
      etat = appliquerAction(etat, i, action, etat.numeroTour, aleatoire);
    }
    if (etat.gagnant === place) victoires++;
  }
  return victoires / parties;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const parties = Number(process.argv[2]) || 4000;
  for (const adversaires of ['facile', 'moyen']) {
    console.log(`\nContre 3 bots ${adversaires} (${parties} parties) :`);
    for (const niveau of DIFFICULTES) {
      const taux = tauxDeVictoire(niveau, adversaires, parties);
      console.log(`  ${niveau.padEnd(10)} ${(taux * 100).toFixed(1)} %`);
    }
  }
}
