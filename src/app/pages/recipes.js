// The recipes: every entry in the awards plugin's catalogue, grouped as the plugin groups them, each with the
// component here that is built on it (its frame, a link to tune it) and its source in the plugin. Filtered by
// search, group, tier and recorded pass; the filter is kept in the address.
import { components } from '../../registry/index.js';
import { loadPlugin, loadRef, md, plain, longDate } from '../../registry/plugin.js';
import { site } from '../../registry/site.js';
import { setQuery } from '../router.js';
import { html, raw, href, debounce } from '../dom.js';
import { icon } from '../icons.js';
import { frameImg } from '../frames.js';

const TIERS = { P0: 'Core: most builds want it', P1: 'Common', P2: 'Situational' };

export default async function recipesPage({ query }) {
  const [core, ref] = await Promise.all([loadPlugin(), loadRef()]);
  const byRecipe = new Map();
  for (const c of components) for (const r of c.recipes || []) if (!byRecipe.has(r)) byRecipe.set(r, c);
  const groups = ref.recipeGroups.filter((g) => g.count);
  // The New window counts from the newest `added` date in the catalogue, as the plugin's own explorer does.
  const newest = ref.recipes.map((r) => r.added).filter(Boolean).sort().at(-1);
  const isNew = (r) => r.added && newest && (Date.parse(newest) - Date.parse(r.added)) / 864e5 <= 30;
  const covered = ref.recipes.filter((r) => byRecipe.has(r.id)).length;

  const card = (r) => {
    const c = byRecipe.get(r.id);
    const src = `${core.plugin.repository}/tree/main/plugins/awards/recipes/${r.id}`;
    return html`
      <li class="rcard" data-group="${r.group}" data-tier="${r.tier}" data-pass="${r.verified ? '1' : ''}" data-text="${`${r.id} ${r.title} ${plain(r.summary)} ${r.intent} ${r.tags.join(' ')} ${c?.title || ''}`.toLowerCase()}">
        ${c ? raw(html`<a class="rcard__media" href="${href(`/components/${c.id}/`)}" tabindex="-1" aria-hidden="true">${raw(frameImg(c.id, { size: 'sm', sizes: '(max-width: 700px) 92vw, 300px' }))}</a>`) : raw('<span class="rcard__media rcard__media--none" aria-hidden="true"></span>')}
        <div class="rcard__body">
          <p class="rcard__meta"><code>${r.id}</code><span class="rcard__tier" title="${TIERS[r.tier] || ''}">${r.tier}</span>${isNew(r) ? raw('<span class="label label--accent">New</span>') : ''}</p>
          <h3 class="rcard__t">${r.title}</h3>
          <p class="rcard__sum">${raw(md(r.summary))}</p>
          <p class="rcard__facts">${r.deps.length ? r.deps.map((d) => d.replace(/@.*/, '')).join(' · ') : 'no library'}${r.seenIn.length ? ` · seen on ${r.seenIn.length} award site${r.seenIn.length > 1 ? 's' : ''}` : ''}${r.verified ? ` · passed ${longDate(r.verified)}` : ''}</p>
          <p class="rcard__links">
            ${c ? raw(html`<a href="${href(`/components/${c.id}/`)}">${c.title} ${raw(icon('arrowRight', { size: 14 }))}</a>`) : raw('<span class="dmuted">No component yet</span>')}
            <a href="${src}" target="_blank" rel="noopener" data-external aria-label="Source of ${r.id} on GitHub">Source ${raw(icon('arrowUpRight', { size: 14 }))}</a>
          </p>
        </div>
      </li>`;
  };

  const node = document.createElement('div');
  node.className = 'recipes';
  node.innerHTML = html`
    <header class="page-head page-head--doc">
      <p class="crumbs"><a href="${href('/docs/')}">The plugin</a><span aria-hidden="true">/</span><span>Recipes</span></p>
      <h1 tabindex="-1">${ref.recipes.length} recipes, each one running</h1>
      <p class="page-head__lede">The parts a build reaches for, from a preloader that waits for a real load signal to a page-wide shader. Each is a small Vite page in the plugin with a verifier that drives it in headless Chromium, keyboard, touch and reduced motion included. ${covered === ref.recipes.length ? 'Every one has' : `${covered} of them have`} a component here built on it, to tune and copy as a prompt.</p>
    </header>
    <div class="rbar" data-rbar>
      <div class="field-icon rbar__q">${raw(icon('search', { size: 16 }))}<input class="field" type="search" placeholder="Search recipes: marquee, lenis, shader…" aria-label="Search recipes" data-q value="${query.get('q') || ''}"></div>
      <div class="rbar__row" role="group" aria-label="Group">
        <button class="chip-btn" type="button" data-g="" aria-pressed="true">All <span>${ref.recipes.length}</span></button>
        ${groups.map((g) => raw(html`<button class="chip-btn" type="button" data-g="${g.id}" aria-pressed="false">${g.title} <span>${g.count}</span></button>`))}
      </div>
      <div class="rbar__row">
        <div class="seg" role="group" aria-label="Tier">
          ${[['', 'Any tier'], ...Object.keys(TIERS).map((t) => [t, t])].map(([t, l]) => raw(html`<button type="button" data-tier="${t}" aria-pressed="${t === ''}">${l}</button>`))}
        </div>
        <label class="check"><input type="checkbox" data-pass> With a recorded pass (${ref.recipes.filter((r) => r.verified).length})</label>
        <p class="rbar__count" role="status" data-count></p>
      </div>
    </div>
    ${groups.map((g) => raw(html`
    <section class="rgroup" data-gsec="${g.id}" aria-labelledby="rg-${g.id}">
      <header class="rgroup__head"><h2 id="rg-${g.id}">${g.title} <span>${g.count}</span></h2>${g.about ? raw(html`<p>${raw(md(g.about))}</p>`) : ''}</header>
      <ul class="rgrid" role="list">${ref.recipes.filter((r) => r.group === g.id).map((r) => raw(card(r)))}</ul>
    </section>`))}
    <p class="rfilter__none" hidden data-none>No recipe matches. Clear the search or pick another group.</p>
    <p class="recipes__foot">The catalogue is read from each recipe’s <code>recipe.json</code> in the plugin (awards ${core.plugin.version}); ${core.counts.drafts} more wait as drafts for review. <a href="${core.plugin.repository}/tree/main/plugins/awards/recipes" target="_blank" rel="noopener" data-external>The recipes in the plugin</a> run locally in its own explorer with <code>npm run dev</code>.</p>`;

  const state = { q: query.get('q') || '', g: query.get('g') || '', tier: query.get('tier') || '', pass: query.get('pass') === '1' };
  const items = [...node.querySelectorAll('.rcard')];
  const apply = () => {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    for (const li of items) {
      const hit = (!state.g || li.dataset.group === state.g) && (!state.tier || li.dataset.tier === state.tier) && (!state.pass || li.dataset.pass) && terms.every((t) => li.dataset.text.includes(t));
      li.hidden = !hit;
      if (hit) n++;
    }
    node.querySelectorAll('[data-gsec]').forEach((sec) => { sec.hidden = !sec.querySelector('.rcard:not([hidden])'); });
    node.querySelectorAll('button[data-g]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === state.g)));
    node.querySelectorAll('button[data-tier]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tier === state.tier)));
    node.querySelector('[data-pass]').checked = state.pass;
    node.querySelector('[data-count]').textContent = `${n} of ${items.length} recipes`;
    node.querySelector('[data-none]').hidden = n > 0;
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.g) p.set('g', state.g);
    if (state.tier) p.set('tier', state.tier);
    if (state.pass) p.set('pass', '1');
    setQuery(p, { path: '/recipes/' });
  };
  const bar = node.querySelector('[data-rbar]');
  bar.addEventListener('click', (e) => {
    const g = e.target.closest('button[data-g]');
    const t = e.target.closest('button[data-tier]');
    if (g) state.g = g.dataset.g;
    if (t) state.tier = t.dataset.tier;
    if (g || t) apply();
  });
  bar.querySelector('[data-pass]').addEventListener('change', (e) => { state.pass = e.target.checked; apply(); });
  const onInput = debounce((v) => { state.q = v.trim(); apply(); }, 100);
  bar.querySelector('[data-q]').addEventListener('input', (e) => onInput(e.target.value));
  apply();

  return { node, title: `Recipes — ${site.name}`, layout: 'wide', destroy() { onInput.cancel(); } };
}
