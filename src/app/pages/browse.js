// All components: search, category and technology filters, sort, grouped or flat grid. State lives in the URL.
import { components, groups, categories } from '../../registry/index.js';
import { TECH_LABELS } from '../../registry/normalize.js';
import { site } from '../../registry/site.js';
import { html, raw, debounce, escapeHTML } from '../dom.js';
import { icon } from '../icons.js';
import { setQuery, strip } from '../router.js';
import { card } from '../ui/card.js';
import { scoreComponent } from '../ui/palette.js';
import { savedIds } from '../saved.js';

const TECH = ['css', 'gsap', 'lenis', 'webgl', 'canvas', 'physics'];
const SORTS = { category: 'By category', az: 'A–Z', new: 'Newest' };

export default function browsePage({ query }) {
  const state = {
    q: query.get('q') || '',
    cat: categories.some((c) => c.id === query.get('cat')) ? query.get('cat') : '',
    tech: TECH.includes(query.get('tech')) ? query.get('tech') : '',
    sort: SORTS[query.get('sort')] ? query.get('sort') : 'category',
    saved: query.get('saved') === '1',
  };
  const saved = savedIds();
  const techMatch = (c, t) => (t === 'css' ? !c.tech.some((x) => x !== 'css') : c.tech.includes(t));
  const techCount = (t) => components.filter((c) => techMatch(c, t)).length;
  const myPath = strip(location.pathname);

  const node = document.createElement('div');
  node.className = 'browse';
  node.innerHTML = html`
    <header class="page-head">
      <p class="eyebrow">Library</p>
      <h1 tabindex="-1">Components</h1>
      <p class="page-head__lede">${components.length} components, each rebuilt from a verified awards recipe, with live controls and a prompt that adapts it to your project.</p>
    </header>
    <div class="filters" role="search">
      <div class="field-icon">
        ${raw(icon('search', { size: 16 }))}
        <input class="field" type="search" placeholder="Search by name, tag or technique" aria-label="Search components" value="${state.q}" data-q autocomplete="off" spellcheck="false">
      </div>
      <div class="filters__row">
        <div class="chips" role="group" aria-label="Category">
          <button type="button" class="fchip" data-cat="" aria-pressed="${!state.cat}">All</button>
          ${groups.map((g) => raw(html`<button type="button" class="fchip" data-cat="${g.id}" aria-pressed="${state.cat === g.id}">${g.title}<span>${g.items.length}</span></button>`))}
        </div>
      </div>
      <div class="filters__row filters__row--split">
        <div class="chips chips--tight" role="group" aria-label="Technology">
          <button type="button" class="fchip fchip--sm" data-tech="" aria-pressed="${!state.tech}">Any tech</button>
          ${TECH.filter((t) => techCount(t)).map((t) => raw(html`<button type="button" class="fchip fchip--sm" data-tech="${t}" aria-pressed="${state.tech === t}">${TECH_LABELS[t]}</button>`))}
        </div>
        <div class="filters__end">
        ${saved.length || state.saved ? raw(html`<button type="button" class="fchip fchip--sm fchip--saved" data-saved aria-pressed="${state.saved}">${raw(icon('bookmark', { size: 13 }))}Saved<span>${saved.length}</span></button>`) : ''}
        <label class="sort">Sort
          <span class="tw-select"><select data-sort aria-label="Sort">${Object.entries(SORTS).map(([k, v]) => raw(html`<option value="${k}" ${state.sort === k ? raw('selected') : ''}>${v}</option>`))}</select>${raw(icon('chevronDown', { size: 14 }))}</span>
        </label>
        </div>
      </div>
    </div>
    <p class="results-count" role="status" aria-live="polite" data-count></p>
    <div data-results></div>`;

  const results = node.querySelector('[data-results]');
  const count = node.querySelector('[data-count]');

  const filtered = () => {
    let list = components.filter((c) =>
      (!state.saved || saved.includes(c.id)) &&
      (!state.cat || c.category === state.cat) &&
      (!state.tech || techMatch(c, state.tech)));
    if (state.q) {
      list = list.map((c) => ({ c, s: scoreComponent(c, state.q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.c);
    } else if (state.sort === 'az') list = list.slice().sort((a, b) => a.title.localeCompare(b.title));
    else if (state.sort === 'new') list = list.slice().sort((a, b) => (b.updated || b.added || '').localeCompare(a.updated || a.added || '') || a.title.localeCompare(b.title));
    return list;
  };

  const render = () => {
    const list = filtered();
    count.textContent = list.length === components.length ? `${list.length} components` : `${list.length} of ${components.length} components`;
    // Technology chips that would leave the current category empty are disabled, not hidden.
    node.querySelectorAll('[data-tech]').forEach((b) => {
      const t = b.dataset.tech;
      b.disabled = !!t && t !== state.tech && !components.some((c) => (!state.cat || c.category === state.cat) && techMatch(c, t));
    });
    if (!list.length) {
      const cat = categories.find((x) => x.id === state.cat);
      const what = [state.saved && 'your saved list', state.q && `“${escapeHTML(state.q)}”`, cat && escapeHTML(cat.title), state.tech && TECH_LABELS[state.tech]].filter(Boolean).join(' + ');
      results.innerHTML = `<div class="empty">${icon('search', { size: 22 })}<p>No component matches ${what}.</p><button class="btn btn--ghost" type="button" data-clear>Clear filters</button></div>`;
      return;
    }
    if (state.sort === 'category' && !state.q && !state.cat && !state.saved) {
      results.innerHTML = groups.map((g) => {
        const items = list.filter((c) => c.category === g.id);
        if (!items.length) return '';
        return html`<section class="cat-section" id="cat-${g.id}"><header class="cat-section__head"><h2>${raw(icon(g.icon, { size: 18 }))}${g.title}</h2><p>${g.blurb}</p><span class="cat-section__n">${items.length}</span></header><div class="grid">${raw(items.map((c) => card(c, { showCategory: false })).join(''))}</div></section>`;
      }).join('');
    } else {
      const cat = categories.find((c) => c.id === state.cat);
      results.innerHTML = `${cat && !state.q ? `<p class="cat-blurb">${cat.blurb}</p>` : ''}<div class="grid">${list.map((c) => card(c, { showCategory: !state.cat })).join('')}</div>`;
    }
  };

  const sync = () => {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat) p.set('cat', state.cat);
    if (state.tech) p.set('tech', state.tech);
    if (state.sort !== 'category') p.set('sort', state.sort);
    if (state.saved) p.set('saved', '1');
    setQuery(p, { path: myPath });
  };
  const syncLater = debounce(sync, 300);

  node.querySelector('[data-q]').addEventListener('input', (e) => { state.q = e.target.value.trim(); render(); syncLater(); });
  node.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      state.cat = cat.dataset.cat;
      node.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
      render(); sync();
    }
    const tech = e.target.closest('[data-tech]');
    if (tech) {
      state.tech = tech.dataset.tech;
      node.querySelectorAll('[data-tech]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tech === state.tech)));
      render(); sync();
    }
    const savedBtn = e.target.closest('[data-saved]');
    if (savedBtn) {
      state.saved = !state.saved;
      savedBtn.setAttribute('aria-pressed', String(state.saved));
      render(); sync();
    }
    if (e.target.closest('[data-clear]')) {
      Object.assign(state, { q: '', cat: '', tech: '', saved: false });
      node.querySelector('[data-q]').value = '';
      node.querySelectorAll('[data-cat],[data-tech]').forEach((b) => b.setAttribute('aria-pressed', String(!b.dataset.cat && !b.dataset.tech)));
      node.querySelector('[data-saved]')?.setAttribute('aria-pressed', 'false');
      render(); sync();
      node.querySelector('[data-q]').focus();
    }
  });
  node.querySelector('[data-sort]').addEventListener('change', (e) => { state.sort = e.target.value; render(); sync(); });

  render();
  return { node, title: `All components — ${site.name}`, layout: 'library', destroy() { syncLater.cancel(); } };
}
