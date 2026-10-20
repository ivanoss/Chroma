// Petit utilitaire pour créer des éléments DOM sans innerHTML (pas de risque XSS).
//   h('button', { class: 'bouton', onclick: f }, 'Texte')
export function h(balise, attributs = {}, ...enfants) {
  const el = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(attributs ?? {})) {
    if (valeur === undefined || valeur === null || valeur === false) continue;
    if (cle.startsWith('on') && typeof valeur === 'function') {
      el.addEventListener(cle.slice(2), valeur);
    } else if (cle === 'class') {
      el.className = Array.isArray(valeur) ? valeur.filter(Boolean).join(' ') : valeur;
    } else if (cle === 'style' && typeof valeur === 'object') {
      for (const [prop, v] of Object.entries(valeur)) el.style.setProperty(prop, v);
    } else if (cle === 'dataset') {
      Object.assign(el.dataset, valeur);
    } else if (valeur === true) {
      el.setAttribute(cle, '');
    } else {
      el.setAttribute(cle, String(valeur));
    }
  }
  ajouter(el, enfants);
  return el;
}

function ajouter(parent, enfants) {
  for (const enfant of enfants) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    if (Array.isArray(enfant)) ajouter(parent, enfant);
    else parent.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
}

export function vider(el) {
  el.replaceChildren();
  return el;
}

export function toast(message, type = 'info') {
  const zone = document.getElementById('toasts');
  const el = h('div', { class: ['toast', type === 'erreur' && 'toast--erreur'] }, message);
  zone.append(el);
  setTimeout(() => el.remove(), 4000);
}

export const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

export const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function formaterDuree(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}

export function formaterDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
}

export const pourcentage = (x) => `${Math.round(x * 100)} %`;
