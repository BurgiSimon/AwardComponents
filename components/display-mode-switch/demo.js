// Display mode switch — a studio portfolio with a docked switch the visitor holds: Light / Dark (native radios under
// a sliding indicator, .4 s power3.out) and Grid (a button that overlays the page's real columns), with L, D and G
// hotkeys that stand down while typing. Each choice is a root attribute, stored, printed in its control as a
// bracket readout, and restored at mount (on a real site: an inline <head> script, before first paint). When 60 % of
// the close is in view the dock scales out (to 1.75, fading) as a large centred copy arrives from .5; the leaving
// copy is inert, and keyboard focus is handed across. Reduced motion: every state changes, nothing tweens.
import './demo.css';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { on, observeIntersection, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';

const KEYS = { theme: 'halden:theme', grid: 'halden:grid' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* not remembered, still switches */ } },
};
const DUR = 0.4;
const EASE = 'power3.out';
const TYPING = 'textarea, select, [contenteditable]:not([contenteditable="false"]), input:not([type="radio"], [type="checkbox"], [type="button"], [type="submit"], [type="reset"], [type="range"], [type="color"])';
// Placements in twelfths of the row: [start, span] on desktop, and on the 4-column phone grid.
const TILES = [
  { slug: 'fjordhus', wide: [1, 7], phone: [1, 4], ratio: '4 / 3' },
  { slug: 'tern-library', wide: [9, 4], phone: [2, 3], ratio: '4 / 5', drop: true },
  { slug: 'kiln-house', wide: [2, 4], phone: [1, 3], ratio: '4 / 5' },
  { slug: 'stillwater', wide: [7, 6], phone: [1, 4], ratio: '3 / 2', drop: true },
  { slug: 'granite-court', wide: [1, 5], phone: [2, 3], ratio: '1' },
  { slug: 'low-light', wide: [7, 5], phone: [1, 4], ratio: '16 / 10' },
];

const switchHTML = (where) => html`
  <fieldset class="dm__switch" data-switch="${where}">
    <legend class="sr-only">Light or dark</legend>
    <span class="dm__ind" aria-hidden="true"></span>
    <label class="dm__opt"><input type="radio" name="dm-theme-${where}" value="light" aria-keyshortcuts="L"><span>Light</span><kbd class="dm__key" aria-hidden="true">L</kbd></label>
    <label class="dm__opt"><input type="radio" name="dm-theme-${where}" value="dark" aria-keyshortcuts="D"><span>Dark</span><kbd class="dm__key" aria-hidden="true">D</kbd></label>
  </fieldset>
  <button class="dm__grid-btn" type="button" aria-pressed="false" aria-keyshortcuts="G" data-grid-btn>Grid <span class="dm__bracket" data-grid-state>[off]</span><kbd class="dm__key" aria-hidden="true">G</kbd></button>`;

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const pics = photos({ tags: ['architecture'], not: ['city', 'interior'], count: 4, seed: 'dm-arch' }).concat(photos({ tags: ['interior'], count: 2, seed: 'dm-int' }));
  const docEl = document.documentElement;
  root.className = 'dm';
  root.innerHTML = html`
    <header class="ac-bar dm__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n, i) => html`<a href="#top"${i === 0 ? raw(' aria-current="page"') : ''}>${n}</a>`)}</nav>
      <form class="dm__search" role="search" data-search><label class="sr-only" for="dm-q">Search the work</label><input class="ac-input" id="dm-q" type="search" placeholder="Search the work" autocomplete="off"></form>
    </header>
    <main>
      <section class="ac-wrap dm__grid dm__intro" aria-labelledby="dm-title">
        <p class="ac-label dm__kicker" data-place="1,6">Selected work · 2019–2026</p>
        <h1 class="ac-display dm__title" id="dm-title" data-place="1,10">Eight buildings, one grid.</h1>
        <p class="ac-lede dm__lede" data-place="7,6">Every picture and line on this page sits on the same columns. Press G to see them; L and D change the light, and the page remembers.</p>
      </section>
      <section class="ac-wrap dm__grid dm__work" aria-label="Projects">
        ${TILES.map((t, i) => {
          const p = studio.projects.find((x) => x.slug === t.slug);
          return html`<a class="dm__tile${t.drop ? ' dm__tile--drop' : ''}" href="#top" data-tile="${i}" style="--ratio:${t.ratio}"><span class="ac-media">${raw(imageHTML(pics[i], { sizes: '(max-width: 760px) 100vw, 50vw', alt: '' }))}</span><span class="dm__cap"><strong>${p.title}</strong><span>${p.place} · ${p.year}</span></span></a>`;
        })}
      </section>
      <section class="dm__close ac-wrap" aria-labelledby="dm-close" data-close>
        <p class="ac-label">End of the work</p>
        <h2 class="ac-h1" id="dm-close">Light or dark for the rest of your visit?</h2>
        <div class="dm__large" data-copy="close" inert>${switchHTML('close')}</div>
        <p class="ac-small dm__contact">${studio.email} · ${studio.phone}</p>
      </section>
    </main>
    <div class="dm__dock" data-copy="dock">${switchHTML('dock')}</div>
    <div class="dm__overlay ac-wrap" aria-hidden="true" data-overlay></div>
    <p class="sr-only" aria-live="polite" data-live></p>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));
  on(ctx, root.querySelector('[data-search]'), 'submit', (e) => e.preventDefault());

  const $ = (s) => root.querySelector(s);
  const dock = $('[data-copy="dock"]');
  const large = $('[data-copy="close"]');
  const switches = [...root.querySelectorAll('[data-switch]')];
  const overlay = $('[data-overlay]');
  const live = $('[data-live]');
  const animate = () => ctx.motion === 'full';
  useGsap(ctx, root);

  // theme-color follows the ground; put the page's own back on unmount.
  let meta = document.querySelector('meta[name="theme-color"]');
  const created = !meta;
  const before = meta?.getAttribute('content');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
  ctx.onCleanup(() => { if (created) meta.remove(); else meta.setAttribute('content', before); });

  // 1. Restore: the stored choice wins, else the page's current theme. (A real site does this in <head>.)
  const stored = store.get(KEYS.theme);
  const state = {
    theme: stored === 'dark' || stored === 'light' ? stored : ctx.theme,
    grid: store.get(KEYS.grid) === 'on',
    at: 'dock',
  };

  // 2. The grid: the page's real columns (4 on phones) and an overlay that draws the same ones.
  const phone = matchMedia('(max-width: 760px)');
  const placeAll = () => {
    const cols = phone.matches ? 4 : Number(cfg.cols);
    root.style.setProperty('--cols', String(cols));
    const fit = ([start, span]) => {
      if (phone.matches) return `${start} / span ${span}`;
      const s = Math.round(((start - 1) * cols) / 12) + 1;
      const n = Math.max(1, Math.min(cols - s + 1, Math.round((span * cols) / 12)));
      return `${s} / span ${n}`;
    };
    root.querySelectorAll('[data-tile]').forEach((el) => { el.style.gridColumn = fit(TILES[Number(el.dataset.tile)][phone.matches ? 'phone' : 'wide']); });
    root.querySelectorAll('[data-place]').forEach((el) => {
      const [s, n] = el.dataset.place.split(',').map(Number);
      el.style.gridColumn = phone.matches ? '1 / -1' : fit([s, n]);
    });
    overlay.replaceChildren(...Array.from({ length: cols }, () => document.createElement('span')));
  };

  // 3. Render the state into every surface that shows it. Only the visible copy's indicator slides.
  const placeIndicator = (sw, slide) => {
    const opt = sw.querySelector('input:checked')?.closest('.dm__opt');
    const ind = sw.querySelector('.dm__ind');
    if (!opt) return;
    const to = { x: opt.offsetLeft, width: opt.offsetWidth };
    if (slide) gsap.to(ind, { ...to, duration: DUR, ease: EASE, overwrite: true });
    else { gsap.killTweensOf(ind); gsap.set(ind, to); }
  };
  const renderTheme = (slide) => {
    docEl.dataset.theme = state.theme;
    for (const sw of switches) {
      sw.querySelector(`input[value="${state.theme}"]`).checked = true;
      placeIndicator(sw, slide && sw.dataset.switch === state.at);
    }
    meta.setAttribute('content', getComputedStyle(docEl).getPropertyValue('--bg').trim());
  };
  const renderGrid = () => {
    root.dataset.grid = state.grid ? 'on' : 'off';
    root.querySelectorAll('[data-grid-btn]').forEach((b) => b.setAttribute('aria-pressed', String(state.grid)));
    root.querySelectorAll('[data-grid-state]').forEach((s) => { s.textContent = state.grid ? '[on]' : '[off]'; });
  };
  const setTheme = (theme, { save = true } = {}) => {
    if (theme === state.theme) return;
    state.theme = theme;
    if (save) store.set(KEYS.theme, theme);
    renderTheme(animate());
    live.textContent = `Theme: ${theme}`;
  };
  const setGrid = (onOff) => {
    state.grid = onOff;
    store.set(KEYS.grid, onOff ? 'on' : 'off');
    renderGrid();
    live.textContent = `Grid overlay ${onOff ? 'on' : 'off'}`;
  };
  switches.forEach((sw) => on(ctx, sw, 'change', (e) => setTheme(e.target.value)));
  root.querySelectorAll('[data-grid-btn]').forEach((b) => on(ctx, b, 'click', () => setGrid(!state.grid)));
  // The library's own theme toggle still reaches the page; it is not the visitor's stored choice.
  ctx.onTheme((theme) => { if (theme !== state.theme) { state.theme = theme; renderTheme(false); } });

  // 4. Single-key hotkeys that stand down while the visitor types or uses a chord.
  on(ctx, window, 'keydown', (e) => {
    const k = e.key?.toLowerCase();
    if (k !== 'l' && k !== 'd' && k !== 'g') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.isComposing || e.target.closest?.(TYPING)) return;
    if (k === 'g') setGrid(!state.grid);
    else setTheme(k === 'd' ? 'dark' : 'light');
  });

  // 5. The close: the dock scales out while the large copy arrives. One copy reachable; focus follows.
  const handoff = (toClose) => {
    const at = toClose ? 'close' : 'dock';
    if (at === state.at) return;
    state.at = at;
    const [out, into] = toClose ? [dock, large] : [large, dock];
    const hadFocus = out.contains(document.activeElement);
    out.inert = true;
    into.inert = false;
    const duration = animate() ? DUR : 0;
    gsap.to(out, { autoAlpha: 0, scale: toClose ? 1.75 : 0.5, duration, ease: EASE, overwrite: true });
    gsap.fromTo(into, { autoAlpha: 0, scale: toClose ? 0.5 : 1.75 }, { autoAlpha: 1, scale: 1, duration, ease: EASE, overwrite: true });
    into.querySelectorAll('[data-switch]').forEach((sw) => placeIndicator(sw, false));
    if (hadFocus) into.querySelector('input:checked')?.focus({ preventScroll: true });
  };
  gsap.set(large, { autoAlpha: 0, scale: 0.5 });
  observeIntersection(ctx, $('[data-close]'), ([entry]) => handoff(entry.isIntersecting), { threshold: 0.6 });

  const apply = () => {
    root.dataset.dock = cfg.dock;
    root.classList.toggle('dm--hints', cfg.hints);
    placeAll();
    switches.forEach((sw) => placeIndicator(sw, false));
  };
  apply();
  renderTheme(false);
  renderGrid();
  on(ctx, phone, 'change', apply);
  on(ctx, window, 'resize', () => switches.forEach((sw) => placeIndicator(sw, false)));
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) switches.forEach((sw) => placeIndicator(sw, false)); });

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
    action(id) {
      if (id === 'grid') setGrid(!state.grid);
      if (id === 'dark') setTheme(state.theme === 'dark' ? 'light' : 'dark');
    },
  };
}
