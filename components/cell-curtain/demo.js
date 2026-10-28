// Cell curtain — Kova One's launch site as three hash routes (Overview, Sound, Buy) behind one woven curtain. A fixed
// grid of cells rebuilt to the viewport (about 72 × 75 CSS px each) scales on X from a hairline to a solid bar, swept
// from a corner by grid distance. It is shut from first paint; the arrival gate races the fonts and every picture's
// decode against a 4 s ceiling after a minimum hold (0.9 s, 0.25 s on a repeat visit in this session). Routes queue
// behind the arrival on one promise chain and swap only behind a fully shut curtain; the page behind it is inert.
// Leaving saves the scroll, back and forward restore it (manual scroll restoration), a link opens at the top; focus
// moves to the new h1, the title names the page and a polite live region announces it. Reduced: a 0.2 s fade of the
// shut grid. Static: an instant cut. The routes live in the hash, so play.html's own query stays as it was.
import './demo.css';
import { on, html, raw, photo, image, imageHTML, content, formatPrice, colour } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const ROUTES = ['overview', 'sound', 'buy'];
const TITLES = { overview: 'Overview', sound: 'Sound', buy: 'Buy' };
const GATE = { minFirst: 900, minRepeat: 250, ceiling: 4000 };
const FADE = 0.2;                 // reduced motion: the shut grid fades instead of weaving
const RATIO = 75 / 72;            // cell height to width
const EASE = 'power3.inOut';
const KEY = 'kova:visited';
const scrollKey = (route) => `kova:scroll:${route}`;
const read = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* storage blocked: every visit is a first visit */ } };
// The route the previous mount in this document was on, so a re-mount opens where it was, as a reload would.
let resume = null;

// Text on the curtain during the arrival. The accent keeps its own ink; any other colour is measured as rendered
// (materials change between themes: moss and plum turn light in dark) and gets whichever of --night or --on-media
// contrasts more. Their relative luminances are about 0.01 and 0.92, so the two contrasts cross near 0.19.
function inkFor(value, rendered) {
  if (value === 'accent') return 'var(--on-accent)';
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(rendered || '');
  if (!m) return 'var(--on-media)';
  const [r, g, b] = m.slice(1, 4).map((v) => { const c = Number(v) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.19 ? 'var(--night)' : 'var(--on-media)';
}

const FINISHES = {
  chalk: 'A warm white for plaster walls, pale oak and linen.',
  graphite: 'Anodised near-black with a charcoal grille, for dark shelves.',
  clay: 'Fired-earth orange, the colour of the first prototype’s foam.',
};
const ARROW = raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
const MARK = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5" opacity="0.45"/><rect x="3" y="13" width="8" height="8" rx="1.5" opacity="0.45"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>');

export default function mount(root, options, ctx) {
  const { product } = content;
  let cfg = { ...options };
  const full = ctx.motion === 'full';
  const uid = Math.random().toString(36).slice(2, 7);
  const startTitle = document.title;
  const finishName = (id) => product.colours.find((c) => c.id === id)?.name || id;
  const spec = (name) => product.specs.find(([k]) => k === name)?.[1] || '';
  const price = formatPrice(product.price);
  const pics = {
    chair: photo('obj-gragg-side-chair'),
    vase: photo('obj-celadon-vase'),
    decanter: photo('obj-dresser-decanter'),
    violin: photo('obj-violin'),
  };
  const SIZES = { kept: '(max-width: 760px) 33vw, 22vw', violin: '(max-width: 760px) 100vw, 42vw' };

  let finish = 'chalk';
  let bagged = false;
  let knit = 0;
  // The product, drawn: one speaker whose grille is a weave of the same short bars as the curtain.
  const speaker = () => {
    const id = `cc-knit-${uid}-${knit++}`;
    return raw(`<svg class="cc__speaker" data-finish="${finish}" viewBox="0 0 320 400" aria-hidden="true">
      <defs><pattern id="${id}" width="10" height="7" patternUnits="userSpaceOnUse"><rect class="cc__knit" width="7" height="2.6" rx="1.3"/><rect class="cc__knit" x="5" y="3.5" width="7" height="2.6" rx="1.3"/><rect class="cc__knit" x="-5" y="3.5" width="7" height="2.6" rx="1.3"/></pattern>
      <radialGradient id="${id}-floor"><stop offset="0" stop-color="black" stop-opacity="0.3"/><stop offset="0.6" stop-color="black" stop-opacity="0.12"/><stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="160" cy="338" rx="124" ry="16" fill="url(#${id}-floor)"/>
      <rect class="cc__top" x="76" y="92" width="168" height="48" rx="26"/>
      <rect class="cc__body" x="76" y="106" width="168" height="232" rx="30"/>
      <rect class="cc__grille" x="88" y="150" width="144" height="174" rx="20"/>
      <rect x="88" y="150" width="144" height="174" rx="20" fill="url(#${id})"/>
      <rect class="cc__strip" x="122" y="120" width="76" height="6" rx="3"/>
      <circle class="cc__led" cx="212" cy="123" r="3"/>
      <rect class="cc__sheen" x="76" y="106" width="168" height="232" rx="30"/>
    </svg>`);
  };
  const routeLink = (route, label, cls = '') => html`<a href="#/${route}" data-route="${route}" class="${cls}">${label}</a>`;
  // The last word and the arrow never part, so a wrapped label never leaves the arrow alone on a line.
  const next = (route, note) => {
    const words = (route === 'overview' ? 'Back to the overview' : TITLES[route]).split(' ');
    const last = words.pop();
    return html`<a href="#/${route}" data-route="${route}" class="cc__next ac-wrap"><span class="ac-label">${note}</span><span class="cc__next-t">${words.length ? `${words.join(' ')} ` : ''}<span class="cc__nowrap">${last} ${ARROW}</span></span></a>`;
  };
  const productFrame = (cls) => html`
    <figure class="cc__frame ${cls}">
      <div class="ac-media cc__stage">${speaker()}</div>
      <figcaption class="cc__frame-cap"><span class="ac-label" data-finish-name>${product.name} in ${finishName(finish)}</span><span class="ac-label">${spec('Dimensions')}</span></figcaption>
    </figure>`;

  // The three pages. Only the current one is in the document; the next replaces it behind the shut curtain.
  const VIEWS = {
    overview: () => html`
      <article class="cc__view" data-view="overview">
        <section class="cc__hero ac-wrap" aria-labelledby="cc-h1-${uid}">
          <div class="cc__hero-copy">
            <p class="ac-label">${product.name} · ${product.kind}</p>
            <h1 class="ac-display cc__h1" id="cc-h1-${uid}" tabindex="-1">${product.tagline}</h1>
            <p class="ac-lede">A ${spec('Weight')} room speaker that measures the room in eight seconds, shapes its bass to it and then stays out of the way.</p>
            <div class="cc__cta">
              ${routeLink('buy', `Buy — ${price}`, 'ac-btn ac-btn--lg ac-btn--accent')}
              ${routeLink('sound', 'How it sounds', 'ac-btn ac-btn--lg ac-btn--ghost')}
            </div>
          </div>
          ${productFrame('cc__frame--hero')}
        </section>
        <section class="cc__features ac-wrap" aria-labelledby="cc-feat-${uid}">
          <h2 class="ac-label" id="cc-feat-${uid}">What it does</h2>
          <ul class="cc__feature-list" role="list">
            ${product.features.map((f, i) => html`<li class="cc__feature"><span class="ac-label">${String(i + 1).padStart(2, '0')}</span><h3 class="ac-h3">${f.title}</h3><p class="ac-small">${f.body}</p></li>`)}
          </ul>
        </section>
        <section class="cc__kept ac-wrap" aria-labelledby="cc-kept-${uid}">
          <div class="cc__kept-copy">
            <p class="ac-label">The brief, pinned above the drawing table</p>
            <h2 class="ac-h2" id="cc-kept-${uid}">Built like the things people keep.</h2>
            <p class="ac-body">We drew it next to a bentwood chair, a celadon vase and a caged decanter, objects that outlived the people who made them, and held it to the same test: would it still be worth repairing in twenty years?</p>
          </div>
          <ul class="cc__kept-pics" role="list">
            ${[['chair', 'Bentwood side chair'], ['vase', 'Celadon bottle vase'], ['decanter', 'Caged glass decanter']].map(([k, cap]) => html`<li><figure><span class="ac-media">${raw(imageHTML(pics[k], { eager: true, sizes: SIZES.kept }))}</span><figcaption class="ac-label">${cap}</figcaption></figure></li>`)}
          </ul>
        </section>
        ${next('sound', 'Next page · 2 of 3')}
      </article>`,
    sound: () => html`
      <article class="cc__view" data-view="sound">
        <section class="cc__head ac-wrap" aria-labelledby="cc-h1-${uid}">
          <p class="ac-label">Sound · 2 of 3</p>
          <h1 class="ac-display cc__h1" id="cc-h1-${uid}" tabindex="-1">Voiced on a violin, then on your room.</h1>
          <p class="ac-lede">Every ${product.name} is voiced against acoustic instruments before it meets a test signal, so strings sound like wood and voices sound like people.</p>
        </section>
        <section class="cc__listen ac-wrap" aria-label="How it is tuned">
          <figure class="cc__violin">
            <span class="ac-media">${raw(imageHTML(pics.violin, { eager: true, sizes: SIZES.violin }))}</span>
            <figcaption class="ac-label">The reference in the listening room</figcaption>
          </figure>
          <div class="cc__listen-copy">
            <dl class="cc__specs">
              ${['Drivers', 'Frequency response', 'Amplification'].map((k) => html`<div><dt class="ac-label">${k}</dt><dd>${spec(k)}</dd></div>`)}
            </dl>
            ${product.features.slice(0, 3).map((f) => html`<div class="cc__note"><h2 class="ac-h3">${f.title}</h2><p class="ac-body">${f.body}</p></div>`)}
          </div>
        </section>
        ${next('buy', 'Next page · 3 of 3')}
      </article>`,
    buy: () => html`
      <article class="cc__view" data-view="buy">
        <section class="cc__buy ac-wrap" aria-labelledby="cc-h1-${uid}">
          ${productFrame('cc__frame--buy')}
          <div class="cc__buy-panel">
            <p class="ac-label">Buy · 3 of 3</p>
            <h1 class="ac-display cc__h1 cc__h1--buy" id="cc-h1-${uid}" tabindex="-1">${product.name}</h1>
            <p class="cc__price"><span class="ac-num">${price}</span><span class="ac-small">VAT included. Free delivery in the EU in three to five days.</span></p>
            <fieldset class="cc__finishes">
              <legend class="ac-label">Finish</legend>
              ${product.colours.map((c) => html`<label class="cc__finish"><input type="radio" name="cc-finish-${uid}" value="${c.id}" ${raw(c.id === finish ? 'checked' : '')}><span class="cc__swatch" data-finish="${c.id}" aria-hidden="true"></span><span class="cc__finish-t"><strong>${c.name}</strong><span class="ac-small">${FINISHES[c.id]}</span></span></label>`)}
            </fieldset>
            <button class="ac-btn ac-btn--lg ac-btn--accent cc__bag" type="button" data-bag>${bagged ? 'In your bag' : `Add to bag — ${price}`}</button>
            <p class="ac-small cc__bag-note" role="status" data-bag-note>${bagged ? `${product.name} in ${finishName(finish)} is in your bag.` : 'Thirty nights to listen at home; it goes back in the box it came in.'}</p>
            <dl class="cc__specs cc__specs--buy">
              ${['Connectivity', 'Dimensions', 'Weight', 'Enclosure'].map((k) => html`<div><dt class="ac-label">${k}</dt><dd>${spec(k)}</dd></div>`)}
            </dl>
            <div class="cc__box">
              <h2 class="ac-label">In the box</h2>
              <ul role="list"><li>${product.name}</li><li>1.5 m braided power cable</li><li>USB-C to USB-C cable, 1 m</li><li>A printed card with the eight screw positions</li></ul>
            </div>
          </div>
        </section>
        ${next('overview', 'Start again · 1 of 3')}
      </article>`,
  };

  root.className = 'cc';
  root.innerHTML = html`
    <div class="cc__page" data-page>
      <a class="cc__skip" href="#cc-main-${uid}">Skip to content</a>
      <header class="ac-bar cc__bar">
        <a class="ac-brand cc__brand" href="#/overview" data-route="overview">${MARK}${product.maker}</a>
        <nav class="cc__nav" aria-label="${product.name}">
          ${routeLink('overview', 'Overview')}
          ${routeLink('sound', 'Sound')}
          <a href="#/buy" data-route="buy" class="cc__buy-link">Buy<span class="ac-num"> ${price}</span></a>
        </nav>
      </header>
      <main class="cc__main" id="cc-main-${uid}" tabindex="-1" data-main></main>
      <footer class="cc__foot ac-wrap">
        <p class="ac-small">${product.name} ships in ${product.colours.map((c) => c.name).join(', ').replace(/, ([^,]+)$/, ' and $1')}. Parts are sold separately for ten years.</p>
        <p class="ac-label">${product.maker} · ${product.kind}</p>
      </footer>
    </div>
    <p class="sr-only" aria-live="polite" data-status></p>
    <div class="cc__curtain" aria-hidden="true" data-curtain>
      <div class="cc__cells" data-cells></div>
      <div class="cc__gate" data-gate>
        <p class="cc__gate-brand">${MARK}${product.maker}</p>
        <p class="cc__gate-top"><span>${product.name} · ${product.kind}</span><span data-gate-what>Type</span></p>
        <p class="cc__gate-name">${product.name}</p>
        <p class="cc__gate-pct ac-num" data-gate-pct>00%</p>
      </div>
    </div>`;

  const page = root.querySelector('[data-page]');
  const main = root.querySelector('[data-main]');
  const status = root.querySelector('[data-status]');
  const curtain = root.querySelector('[data-curtain]');
  const grid = root.querySelector('[data-cells]');
  const gateBox = root.querySelector('[data-gate]');
  const gateWhat = root.querySelector('[data-gate-what]');
  const gatePct = root.querySelector('[data-gate-pct]');
  const navLinks = [...root.querySelectorAll('.cc__bar [data-route]')].filter((a) => !a.classList.contains('cc__brand'));
  const { gsap, context: g } = useGsap(ctx, root);

  // Everything the mount waits on stops with it: timers are cleared, tweens die with the gsap context, and every
  // step of the queue checks `dead` before it touches the document.
  let dead = false;
  const timers = new Set();
  const wait = (ms) => new Promise((resolve) => { const t = setTimeout(() => { timers.delete(t); resolve(); }, ms); timers.add(t); });

  // The router restores the scroll itself, behind the shut curtain; the browser's own restore would jump the page
  // being left, in view, on back and forward.
  let restoration = null;
  try { restoration = history.scrollRestoration; history.scrollRestoration = 'manual'; } catch { /* not supported */ }

  const state = { route: null, phase: 'arrival', cols: 0, rows: 0 };
  let target = null;          // the last route asked for, so Next page twice in a row moves two pages
  let pendingBuild = false;
  let cells = [];
  const setPhase = (p) => {
    state.phase = p;
    root.dataset.phase = p;
    if (p === 'idle' && pendingBuild) { pendingBuild = false; build(); }
  };
  const setInert = (on) => { page.inert = on; };

  const apply = () => {
    root.style.setProperty('--cc-curtain', colour(cfg.colour));
    const probe = grid.firstElementChild;
    root.style.setProperty('--cc-curtain-ink', inkFor(cfg.colour, probe && getComputedStyle(probe).backgroundColor));
  };
  ctx.onTheme(apply);

  // The grid: round(width / cell) × round(height / (cell × 75/72)), at least 4 × 4, rebuilt only while idle.
  function build() {
    const w = document.documentElement.clientWidth || innerWidth;
    const h = document.documentElement.clientHeight || innerHeight;
    const cols = Math.max(4, Math.round(w / cfg.cell));
    const rows = Math.max(4, Math.round(h / (cfg.cell * RATIO)));
    if (cols === state.cols && rows === state.rows && cells.length) return;
    state.cols = cols;
    state.rows = rows;
    grid.style.setProperty('--cols', cols);
    grid.style.setProperty('--rows', rows);
    grid.replaceChildren(...Array.from({ length: cols * rows }, () => document.createElement('i')));
    cells = [...grid.children];
  }
  const rebuild = () => { if (state.phase === 'idle') build(); else pendingBuild = true; };

  // Where a sweep starts: a corner or the centre, or the cell under the link that asked for the page.
  const originFor = (point) => {
    if (cfg.origin !== 'link') return cfg.origin;
    if (!point) return 'end';
    const col = Math.min(state.cols - 1, Math.max(0, Math.floor(point.x / ((document.documentElement.clientWidth || innerWidth) / state.cols))));
    const row = Math.min(state.rows - 1, Math.max(0, Math.floor(point.y / ((document.documentElement.clientHeight || innerHeight) / state.rows))));
    return row * state.cols + col;
  };
  const centreOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  // Covering: every cell grows from a hairline to its full width, staggered by grid distance from the origin (DOM
  // order is row by row, so GSAP's grid is [rows, cols]). Uncovering runs the same sweep back to hairlines.
  const sweep = (from, to) => g.add(() => gsap.fromTo(cells, { scaleX: 1 - to }, { scaleX: to, duration: cfg.duration, ease: EASE, stagger: { each: cfg.stagger, from, grid: [state.rows, state.cols] } }));
  const fade = (from, to) => (ctx.motion === 'static'
    ? (gsap.set(curtain, { opacity: to }), Promise.resolve())
    : g.add(() => gsap.fromTo(curtain, { opacity: from }, { opacity: to, duration: FADE, ease: 'none' })));
  function cover(from) {
    curtain.hidden = false;
    setInert(true);
    if (!full) return fade(0, 1);
    gsap.set(curtain, { opacity: 1 });
    return sweep(from, 1);
  }
  async function uncover(from) {
    await (full ? sweep(from, 0) : fade(1, 0));
    if (dead) return;
    curtain.hidden = true;
    setInert(false);
  }

  // Only the current page is in the document: the next one replaces it while the curtain is shut.
  function show(route, { restore = false } = {}) {
    const key = ROUTES.includes(route) ? route : 'overview';
    if (key !== state.route || !main.firstElementChild) main.innerHTML = VIEWS[key]();
    state.route = key;
    document.title = `${TITLES[key]} — ${product.name}`;
    for (const a of navLinks) {
      if (a.dataset.route === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    const saved = restore ? Number(read(scrollKey(key))) || 0 : 0;
    window.scrollTo(0, saved);
  }

  // The arrival gate: real promises (the fonts, the decode of every picture on the page), a minimum hold so the
  // curtain reads, and a ceiling so a stalled request can never keep the page shut.
  async function gate() {
    const repeat = read(KEY) === '1';
    write(KEY, '1');
    const imgs = [...main.querySelectorAll('img')];
    const loads = [document.fonts?.ready ?? Promise.resolve(), ...imgs.map((img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}))];
    if (cfg.stall) loads.push(new Promise(() => {}));   // a request that never answers: the ceiling opens the page
    const pictures = imgs.length ? `, ${imgs.length} picture${imgs.length === 1 ? '' : 's'}` : '';
    gateWhat.textContent = `Type${pictures}${cfg.stall ? ' and one stalled request' : ''}`;
    let done = 0;
    const count = () => { gatePct.textContent = `${String(Math.round((done / loads.length) * 100)).padStart(2, '0')}%`; };
    count();
    loads.forEach((p) => p.then(() => { done++; if (!dead) count(); }));
    const t0 = performance.now();
    const min = wait(repeat ? GATE.minRepeat : GATE.minFirst);
    const outcome = await Promise.race([Promise.all(loads).then(() => 'loaded'), wait(GATE.ceiling).then(() => 'ceiling')]);
    await min;
    root.dataset.gate = `${outcome} ${Math.round(performance.now() - t0)}ms${repeat ? ' repeat' : ''}`;
  }

  // The arrival, after the curtain was shut synchronously: gate, then the same sweep open.
  async function arrival() {
    gateBox.hidden = false;
    await gate();
    if (dead) return;
    gateBox.hidden = true;            // the readout belongs to the arrival only
    setPhase('entering');
    await uncover(originFor(null));
    if (dead) return;
    setPhase('idle');
  }
  const shut = () => {
    setPhase('arrival');
    if (full) gsap.set(cells, { scaleX: 1 });
    gsap.set(curtain, { opacity: 1 });
    curtain.hidden = false;
    setInert(true);
  };

  // One queue for the arrival and every route: a route asked for while the curtain is still shut waits for it.
  let busy = Promise.resolve();
  const enqueue = (fn) => { busy = busy.then(fn).catch((e) => { if (!dead) console.error(e); }); return busy; };
  function go(route, { restore = false, point = null, focus = true, keyNav = false } = {}) {
    target = route;
    return enqueue(async () => {
      if (dead || route === state.route) return;
      setPhase('leaving');
      write(scrollKey(state.route), String(Math.round(window.scrollY)));
      const from = originFor(point);
      await cover(from);
      if (dead) return;
      show(route, { restore });       // the swap: every cell is shut (or the fade is opaque) by now
      setPhase('entering');
      await uncover(from);
      if (dead) return;
      setPhase('idle');
      // A route change is a page change: focus on the new heading (a ring only for the keyboard), the title names
      // the page and the live region says so. The toolbar's Next page leaves focus in the toolbar, and so does the
      // browser's back button pressed while focus is outside this frame (document.hasFocus() is false then).
      if (focus && document.hasFocus()) main.querySelector('h1')?.focus({ preventScroll: true, focusVisible: keyNav });
      status.textContent = `${TITLES[state.route]}, page ${ROUTES.indexOf(state.route) + 1} of ${ROUTES.length}`;
    });
  }

  // Only #/… hashes are routes. Any other hash is an in-page target (the skip link): its entry is rewritten to the
  // current route, so back, forward or a reload to it stays on this page instead of routing.
  const routeOf = () => location.hash.match(/^#\/([\w-]+)/)?.[1] ?? null;
  const urlFor = (route) => `${location.pathname}${location.search}#/${route}`;
  on(ctx, root, 'click', (e) => {
    const a = e.target.closest('a[data-route]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    const route = a.dataset.route;
    if (route === target) return;
    history.pushState(null, '', urlFor(route));
    const keyNav = e.detail === 0;
    go(route, { point: keyNav ? centreOf(a) : { x: e.clientX, y: e.clientY }, keyNav });
  });
  on(ctx, window, 'popstate', () => {
    if (location.hash && !location.hash.startsWith('#/')) { history.replaceState(history.state, '', urlFor(target || state.route)); return; }
    go(ROUTES.includes(routeOf()) ? routeOf() : 'overview', { restore: true });
  });
  on(ctx, window, 'resize', rebuild);

  // The Buy page's own controls, delegated so they survive the swap.
  on(ctx, root, 'change', (e) => {
    if (!e.target.matches?.(`input[name="cc-finish-${uid}"]`)) return;
    finish = e.target.value;
    root.querySelectorAll('.cc__speaker').forEach((s) => { s.dataset.finish = finish; });
    root.querySelectorAll('[data-finish-name]').forEach((s) => { s.textContent = `${product.name} in ${finishName(finish)}`; });
    if (bagged) root.querySelector('[data-bag-note]').textContent = `${product.name} in ${finishName(finish)} is in your bag.`;
  });
  on(ctx, root, 'click', (e) => {
    const btn = e.target.closest('[data-bag]');
    if (!btn) return;
    bagged = true;
    btn.textContent = 'In your bag';
    root.querySelector('[data-bag-note]').textContent = `${product.name} in ${finishName(finish)} is in your bag.`;
  });

  // Warm the other pages' pictures once the arrival is done, so a route never opens on an empty frame.
  const warm = () => {
    for (const [k, sizes] of [['chair', SIZES.kept], ['vase', SIZES.kept], ['decanter', SIZES.kept], ['violin', SIZES.violin]]) {
      image(pics[k], { eager: true, sizes }).decode?.().catch(() => {});
    }
  };

  ctx.onCleanup(() => {
    dead = true;
    // The route in the address, as a reload would read it: mid-transition that is the page asked for.
    resume = ROUTES.includes(routeOf()) ? routeOf() : state.route;
    timers.forEach(clearTimeout);
    timers.clear();
    document.title = startTitle;
    try { if (restoration) history.scrollRestoration = restoration; } catch { /* not supported */ }
    if (location.hash) history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  });

  build();
  apply();
  const first = ctx.capture ? 'overview' : (ROUTES.includes(routeOf()) ? routeOf() : resume || 'overview');
  target = first;
  history.replaceState(history.state, '', urlFor(first));
  show(first);

  // A module that runs after the CSS failsafe has already released the page must not shut it again: mark the curtain
  // ready (which ends the failsafe), keep it hidden and treat the arrival as done.
  const late = getComputedStyle(curtain).visibility === 'hidden';
  curtain.dataset.ready = '';

  if (ctx.capture) {
    // The thumbnail: the weave halfway shut over the overview, from the bottom-right, held still.
    gateBox.hidden = true;
    curtain.hidden = false;
    setPhase('leaving');
    if (full) g.add(() => gsap.fromTo(cells, { scaleX: 0 }, { scaleX: 1, duration: cfg.duration, ease: EASE, stagger: { each: cfg.stagger, from: cfg.origin === 'link' ? 'end' : cfg.origin, grid: [state.rows, state.cols] }, paused: true }).progress(0.46));
    else curtain.hidden = true;
  } else if (late) {
    curtain.hidden = true;
    setPhase('idle');
  } else {
    shut();
    enqueue(() => arrival().then(() => { if (!dead) warm(); }));
  }

  return {
    update(nextOptions, changed) {
      cfg = { ...nextOptions };
      apply();
      if (changed.includes('cell')) rebuild();
    },
    action(id) {
      if (ctx.capture) return;
      if (id === 'replay') {
        // As a fresh load: forget the visit, shut at once, scroll to the top, and run the gate again.
        target = target || state.route;
        enqueue(async () => {
          if (dead) return;
          write(KEY, null);
          shut();
          window.scrollTo(0, 0);
          await arrival();
        });
      } else if (id === 'next') {
        const route = ROUTES[(ROUTES.indexOf(target || state.route) + 1) % ROUTES.length];
        history.pushState(null, '', urlFor(route));
        const link = navLinks.find((a) => a.dataset.route === route);
        go(route, { focus: false, point: link ? centreOf(link) : null });
      }
    },
  };
}
