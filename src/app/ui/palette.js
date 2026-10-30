// Command palette (⌘K / Ctrl+K, or "/" on wide pages): search every component by name, category, tag or recipe,
// jump to pages, switch the theme. Results are a listbox driven from the input (aria-activedescendant), with the
// active component's frame shown beside the list on wide screens.
import { components, categories, byId, featured } from '../../registry/index.js';
import { prefs } from '../prefs.js';
import { savedIds } from '../saved.js';
import { html, raw, href, escapeHTML } from '../dom.js';
import { icon } from '../icons.js';
import { frameSrc } from '../frames.js';
import { navigate } from '../router.js';
import { toggleTheme } from '../theme.js';

let dialog = null;
let state = { items: [], active: 0 };

export function scoreComponent(c, q) {
  if (!q) return 1;
  const title = c.title.toLowerCase();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let total = 0;
  for (const t of terms) {
    let s = 0;
    if (title === t) s = 120;
    else if (title.startsWith(t)) s = 90;
    else if (title.split(/[\s-]+/).some((w) => w.startsWith(t))) s = 70;
    else if (title.includes(t)) s = 55;
    else if (c.categoryTitle.toLowerCase().includes(t)) s = 35;
    else if (c.tags.some((x) => x.startsWith(t))) s = 30;
    else if (c.search.includes(t)) s = 15;
    else if (subsequence(title, t)) s = 6;
    if (!s) return 0;
    total += s;
  }
  return total;
}

function subsequence(hay, needle) {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length;
}

const PAGES = [
  { kind: 'page', id: 'home', title: 'Home', hint: 'Welcome page', to: '/', icon: 'sparkle' },
  { kind: 'page', id: 'all', title: 'All components', hint: 'Browse and filter', to: '/components/', icon: 'grid' },
  { kind: 'page', id: 'docs', title: 'Getting started', hint: 'Install the plugin, use a prompt', to: '/docs/', icon: 'book' },
  { kind: 'page', id: 'changelog', title: 'Changelog', hint: 'What changed, newest first', to: '/changelog/', icon: 'clock' },
];
const ACTIONS = [
  { kind: 'action', id: 'theme', title: 'Switch theme', hint: 'Light or dark', icon: 'moon', run: toggleTheme },
];

function results(q) {
  if (!q) {
    // With no query: the visitor's saved list, what they looked at last, then the featured set.
    const saved = savedIds().slice(0, 6);
    const seen = prefs.get('seen', []).filter((id) => byId.has(id) && !saved.includes(id));
    const pick = [...new Set([...saved, ...seen, ...featured.map((c) => c.id)])].slice(0, 12);
    const item = (id) => { const c = byId.get(id); return { kind: 'component', id, title: c.title, hint: c.categoryTitle, to: `/components/${id}/`, c }; };
    const kept = pick.filter((id) => saved.includes(id)).map(item);
    const recent = pick.filter((id) => seen.includes(id)).map(item);
    const feat = pick.filter((id) => !saved.includes(id) && !seen.includes(id)).map(item);
    return [
      ...kept.length ? [{ group: 'Saved' }, ...kept] : [],
      ...recent.length ? [{ group: 'Recently viewed' }, ...recent] : [],
      ...feat.length ? [{ group: 'Featured' }, ...feat] : [],
      { group: 'Pages' }, ...PAGES,
      { group: 'Actions' }, ...ACTIONS,
    ];
  }
  const comps = components
    .map((c) => ({ c, s: scoreComponent(c, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.title.localeCompare(b.c.title))
    .slice(0, q ? 40 : 12)
    .map(({ c }) => ({ kind: 'component', id: c.id, title: c.title, hint: c.categoryTitle, to: `/components/${c.id}/`, c }));
  const match = (x) => !q || `${x.title} ${x.hint}`.toLowerCase().includes(q.toLowerCase());
  const cats = q ? categories.filter((cat) => cat.title.toLowerCase().includes(q.toLowerCase())).map((cat) => ({ kind: 'page', id: `cat-${cat.id}`, title: cat.title, hint: 'Category', to: `/components/?cat=${cat.id}`, icon: cat.icon })) : [];
  return [
    ...comps.length ? [{ group: q ? 'Components' : 'Suggested' }, ...comps] : [],
    ...cats.length ? [{ group: 'Categories' }, ...cats] : [],
    ...PAGES.filter(match).length ? [{ group: 'Pages' }, ...PAGES.filter(match)] : [],
    ...ACTIONS.filter(match).length ? [{ group: 'Actions' }, ...ACTIONS.filter(match)] : [],
  ];
}

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'palette';
  dialog.setAttribute('aria-label', 'Search components');
  dialog.innerHTML = html`
    <div class="palette__box">
      <div class="palette__search">
        ${raw(icon('search', { size: 18 }))}
        <input type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" placeholder="Search components, categories, tags…" autocomplete="off" spellcheck="false">
        <kbd class="kbd">Esc</kbd>
      </div>
      <div class="palette__body">
        <ul class="palette__list" id="palette-list" role="listbox" aria-label="Results"></ul>
        <aside class="palette__peek" aria-hidden="true"><div class="palette__frame"><img alt="" decoding="async"></div><p class="palette__peek-title"></p><p class="palette__peek-sum"></p></aside>
      </div>
      <div class="palette__foot"><span><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> move</span><span><kbd class="kbd">↵</kbd> open</span><span><kbd class="kbd">Esc</kbd> close</span></div>
    </div>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input');
  input.addEventListener('input', () => render(input.value.trim()));
  input.addEventListener('keydown', onKey);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) { dialog.close(); return; }
    const opt = e.target.closest('[role="option"]');
    if (opt) choose(Number(opt.dataset.index));
  });
  dialog.addEventListener('pointermove', (e) => {
    const opt = e.target.closest('[role="option"]');
    if (opt && Number(opt.dataset.index) !== state.active) setActive(Number(opt.dataset.index), false);
  });
  dialog.addEventListener('close', () => { document.documentElement.classList.remove('palette-open'); });
}

function render(q) {
  const list = dialog.querySelector('.palette__list');
  state.items = results(q);
  let i = 0;
  list.innerHTML = state.items.map((item) => {
    if (item.group) return `<li class="palette__group" role="presentation">${escapeHTML(item.group)}</li>`;
    const index = i++;
    item.index = index;
    const lead = item.kind === 'component'
      ? `<img class="palette__thumb" src="${frameSrc(item.id, { size: 'sm' })}" alt="" loading="lazy" decoding="async" data-frame="${item.id}">`
      : `<span class="palette__icon">${icon(item.icon, { size: 16 })}</span>`;
    return `<li role="option" id="pal-${index}" data-index="${index}" aria-selected="false">${lead}<span class="palette__t">${escapeHTML(item.title)}</span><span class="palette__h">${escapeHTML(item.hint)}</span>${icon('arrowRight', { size: 14, className: 'palette__go' })}</li>`;
  }).join('') || '<li class="palette__none" role="presentation">Nothing matches. Try a tag like “scroll”, “cursor” or “webgl”.</li>';
  state.options = state.items.filter((x) => !x.group);
  setActive(0, false);
}

function setActive(index, scroll = true) {
  const n = state.options.length;
  if (!n) return;
  state.active = (index + n) % n;
  const input = dialog.querySelector('input');
  dialog.querySelectorAll('[role="option"]').forEach((o) => o.setAttribute('aria-selected', String(Number(o.dataset.index) === state.active)));
  const el = dialog.querySelector(`#pal-${state.active}`);
  input.setAttribute('aria-activedescendant', `pal-${state.active}`);
  if (scroll) el?.scrollIntoView({ block: 'nearest' });
  const item = state.options[state.active];
  const peek = dialog.querySelector('.palette__peek');
  if (item.kind === 'component') {
    peek.hidden = false;
    peek.querySelector('img').src = frameSrc(item.id, { size: devicePixelRatio > 1.5 ? 'md' : 'sm' });
    peek.querySelector('img').dataset.frame = item.id;
    peek.querySelector('.palette__peek-title').textContent = item.title;
    peek.querySelector('.palette__peek-sum').textContent = item.c.summary;
  } else peek.hidden = true;
}

function choose(index) {
  const item = state.options[index];
  if (!item) return;
  dialog.close();
  if (item.run) item.run();
  else navigate(href(item.to));
}

function onKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(state.active + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(state.active - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); choose(state.active); }
  else if (e.key === 'Home' && e.ctrlKey) { setActive(0); }
}

export function openPalette(query = '') {
  if (!dialog) build();
  if (dialog.open) { dialog.querySelector('input').select(); return; }
  const input = dialog.querySelector('input');
  input.value = query;
  render(query);
  dialog.showModal();
  document.documentElement.classList.add('palette-open');
  input.focus();
}
