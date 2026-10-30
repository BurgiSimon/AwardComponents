// Display mode switch — a studio portfolio's docked switch the visitor holds, over three project tiles: Light / Dark
// (native radios under a sliding indicator, .4 s power3.out) and Grid (a button that overlays the page's real
// columns, the ones the tiles sit on), with L, D and G hotkeys that stand down while typing. Each choice is a root
// attribute, stored, printed in its control as a bracket readout, and restored at mount (on a real site: an inline
// <head> script, before first paint). Reduced motion: every state changes, nothing tweens.
import './demo.css';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';

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
  { slug: 'fjordhus', wide: [1, 5], phone: [1, 4], ratio: '4 / 3' },
  { slug: 'tern-library', wide: [6, 3], phone: [2, 3], ratio: '4 / 5', drop: true },
  { slug: 'kiln-house', wide: [9, 4], phone: [1, 4], ratio: '1' },
];


export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const pics = photos({ tags: ['architecture'], not: ['city', 'interior'], count: 3, seed: 'dm-arch' });
  const docEl = document.documentElement;
  root.className = 'dm';
  root.innerHTML = html`
    <section class="ac-stage dm__stage" aria-label="${studio.name} portfolio">
      <div class="dm__grid dm__work">
        ${TILES.map((t, i) => {
          const p = studio.projects.find((x) => x.slug === t.slug);
          return html`<a class="dm__tile${t.drop ? ' dm__tile--drop' : ''}" href="#top" data-tile="${i}" style="--ratio:${t.ratio}"><span class="ac-media">${raw(imageHTML(pics[i], { sizes: '(max-width: 760px) 100vw, 40vw', alt: '' }))}</span><span class="dm__cap"><strong>${p.title}</strong><span>${p.place} · ${p.year}</span></span></a>`;
        })}
      </div>
      <p class="ac-stage__note"><span>${studio.name} · portfolio</span></p>
    </section>
    <div class="dm__dock">
      <fieldset class="dm__switch" data-switch>
        <legend class="sr-only">Light or dark</legend>
        <span class="dm__ind" aria-hidden="true"></span>
        <label class="dm__opt"><input type="radio" name="dm-theme" value="light" aria-keyshortcuts="L"><span>Light</span><kbd class="dm__key" aria-hidden="true">L</kbd></label>
        <label class="dm__opt"><input type="radio" name="dm-theme" value="dark" aria-keyshortcuts="D"><span>Dark</span><kbd class="dm__key" aria-hidden="true">D</kbd></label>
      </fieldset>
      <button class="dm__grid-btn" type="button" aria-pressed="false" aria-keyshortcuts="G" data-grid-btn>Grid <span class="dm__bracket" data-grid-state>[off]</span><kbd class="dm__key" aria-hidden="true">G</kbd></button>
    </div>
    <div class="dm__overlay ac-wrap" aria-hidden="true" data-overlay></div>
    <p class="sr-only" aria-live="polite" data-live></p>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const $ = (s) => root.querySelector(s);
  const sw = $('[data-switch]');
  const gridBtn = $('[data-grid-btn]');
  const gridState = $('[data-grid-state]');
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
    overlay.replaceChildren(...Array.from({ length: cols }, () => document.createElement('span')));
  };

  // 3. Render the state into every surface that shows it.
  const placeIndicator = (slide) => {
    const opt = sw.querySelector('input:checked')?.closest('.dm__opt');
    const ind = sw.querySelector('.dm__ind');
    if (!opt) return;
    const to = { x: opt.offsetLeft, width: opt.offsetWidth };
    if (slide) gsap.to(ind, { ...to, duration: DUR, ease: EASE, overwrite: true });
    else { gsap.killTweensOf(ind); gsap.set(ind, to); }
  };
  const renderTheme = (slide) => {
    docEl.dataset.theme = state.theme;
    sw.querySelector(`input[value="${state.theme}"]`).checked = true;
    placeIndicator(slide);
    meta.setAttribute('content', getComputedStyle(docEl).getPropertyValue('--bg').trim());
  };
  const renderGrid = () => {
    root.dataset.grid = state.grid ? 'on' : 'off';
    gridBtn.setAttribute('aria-pressed', String(state.grid));
    gridState.textContent = state.grid ? '[on]' : '[off]';
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
  on(ctx, sw, 'change', (e) => setTheme(e.target.value));
  on(ctx, gridBtn, 'click', () => setGrid(!state.grid));
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

  const apply = () => {
    root.dataset.dock = cfg.dock;
    root.classList.toggle('dm--hints', cfg.hints);
    placeAll();
    placeIndicator(false);
  };
  apply();
  renderTheme(false);
  renderGrid();
  on(ctx, phone, 'change', apply);
  on(ctx, window, 'resize', () => placeIndicator(false));
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) placeIndicator(false); });

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
