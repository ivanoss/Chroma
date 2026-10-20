// Construit la version autonome de Chroma : un seul fichier HTML, sans serveur.
// Usage : npm run build:autonome  →  dist/chroma.html
//
// On réutilise le vrai client (client/js) en remplaçant deux modules :
//   client/js/api.js            → statique/api-local.js       (moteur + bots dans le navigateur)
//   client/js/vues/connexion.js → statique/connexion-locale.js (un simple nom de joueur)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = join(RACINE, 'client');
const DIST = join(RACINE, 'dist');

const REMPLACEMENTS = {
  [join(CLIENT, 'js', 'api.js')]: join(RACINE, 'statique', 'api-local.js'),
  [join(CLIENT, 'js', 'vues', 'connexion.js')]: join(RACINE, 'statique', 'connexion-locale.js'),
};

const remplacer = {
  name: 'remplacer-modules',
  setup(b) {
    b.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.importer) return undefined;
      const chemin = resolve(args.resolveDir, args.path);
      return REMPLACEMENTS[chemin] ? { path: REMPLACEMENTS[chemin] } : undefined;
    });
  },
};

const resultat = await build({
  entryPoints: [join(CLIENT, 'js', 'main.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  write: false,
  plugins: [remplacer],
  legalComments: 'none',
});
const js = resultat.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(CLIENT, 'css', 'styles.css'), 'utf8');
const favicon = `data:image/svg+xml;base64,${readFileSync(join(CLIENT, 'favicon.svg')).toString('base64')}`;

// Le corps de la page est repris de client/index.html.
const index = readFileSync(join(CLIENT, 'index.html'), 'utf8');
const corps = index.slice(index.indexOf('<body>') + 6, index.indexOf('</body>')).trim();
const polices = index.match(/<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];

const titre = '<title>Chroma</title>';
const metas =
  '<meta name="description" content="Jeu de cartes contre des adversaires contrôlés par ordinateur, version autonome." />';

// 1. Document complet : à déposer sur n'importe quel hébergement, ou à ouvrir directement.
const complet = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
${titre}
${metas}
<link rel="icon" href="${favicon}" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${polices}
<style>
${css}
</style>
</head>
<body>
${corps}
<script type="module">
${js}
</script>
</body>
</html>
`;

// 2. Fragment pour une page publiée (l'hébergeur ajoute lui-même <html>, <head> et <body>).
const fragment = `${titre}
<meta name="claude:viewport-fit-sides" content="cover">
${polices}
<style>
${css}
</style>
${corps.replace(/\s*<script[^>]*src="[^"]*"[^>]*><\/script>/g, '')}
<script type="module">
${js}
</script>
`;

mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, 'chroma.html'), complet);
writeFileSync(join(DIST, 'chroma-fragment.html'), fragment);
console.log(`dist/chroma.html (${Math.round(complet.length / 1024)} Ko)`);
