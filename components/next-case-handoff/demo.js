// Next case hand-off — Halden's case-study pages, built from the awards recipe `next-case-handoff`. Each case closes
// on the next case's hero in the hero's own geometry (100svh, one card position), clipped under a Next case label,
// its title card hinged on its top-right corner by a scrub (−10° → −5°). Following the link (full tier) lifts the
// frame out of the clip (position: fixed at its own rect), raises it to the top of the viewport while the card
// unwinds to 0° on one clock (1 s, expo out), then swaps the page and moves the frame's live film node into the new
// hero: the same canvas, its painter and its running timecode, so the picture never restarts. The arrived page skips
// its own entrance, the scroll is at 0, focus is on the new h1 and ?case= records the page; Back swaps without the
// lift. Reduced and static motion swap at once with nothing moving; every link is a real URL.
import './demo.css';
import { on, onFrame, html, raw, photo, imageHTML, loadImage, readToken, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const TAU = Math.PI * 2;
const FPS = 25; // the timecode's frame rate
const pad = (n) => String(n).padStart(2, '0');

// The three cases: Halden's project data plus what a case page says about it. Pictures are media ids.
const CASES = [
  {
    slug: 'fjordhus',
    film: 'land-fog-forest',
    lede: 'A timber house on a granite shelf forty metres above the Hardanger fjord, framed, closed and clad between the thaw and the first snow.',
    facts: [['Client', 'The Aasen family'], ['Site', 'Granite shelf above Ulvik'], ['Area', '310 m²'], ['Completed', 'June 2026']],
    text: [
      'The shelf is the only level ground on the plot, so the house is one long volume laid along it, with the living room reaching six metres out over the drop. The road side is closed; every window faces the water.',
      'The frame is spruce from the valley, felled in the winter of 2024 and left to dry on site for a year. The cladding is untreated and will be silver by the third winter.',
    ],
    team: [['Lead architect', 'Ingrid Vold'], ['Team', 'Sigrid Haug, Jonas Mehl'], ['Structure', 'Nordvik Engineering']],
    figure: { id: 'land-lake-reflection', caption: 'The view the living room is drawn around: mountain, cloud and still water, nothing built.' },
  },
  {
    slug: 'tern-library',
    film: 'arch-concrete-slab',
    lede: 'A public reading room on the sound at Tromsø, with one window to the water at desk height and the stacks kept in the dark behind the readers.',
    facts: [['Client', 'Tromsø library board'], ['Site', 'Storgata quay'], ['Area', '2,400 m²'], ['Completed', 'September 2025']],
    text: [
      'The old library sat on the third floor of the town hall. The city asked for a room at street level, open until ten, that would still feel like a place to read through seven weeks of polar night.',
      'The tower holds the stair and the book lift, cast in sand-coloured concrete with three round lights at the top. Readers sit facing the water; the books stand behind them, out of the sun.',
    ],
    team: [['Lead architect', 'Sigrid Haug'], ['Team', 'Ingrid Vold, Oda Lien, Jonas Mehl'], ['Structure', 'Nordvik Engineering']],
    figure: { id: 'interior-concrete-hall', caption: 'The reading room in October, before the tables went in: bare concrete, one column, the floor still drying.' },
  },
  {
    slug: 'kiln-house',
    film: 'interior-butterfly-chair',
    lede: 'A brick kiln from 1911, kept whole, with a timber house built inside its walls for a ceramicist and her studio.',
    facts: [['Client', 'Mai Okafor, ceramicist'], ['Site', 'Former brickworks, Hundvåg'], ['Area', '140 m²'], ['Completed', 'March 2024']],
    text: [
      'We kept the vault, the chimney and the soot on the bricks. The new house stands inside them on its own timber frame and touches the old walls only at the floor.',
      'The firing chamber is now the studio and the drying loft above it is where she sleeps. Tall factory windows on the yard side light the wheel from the north.',
    ],
    team: [['Lead designer', 'Tomas Reyes'], ['Team', 'Oda Lien, Halden Workshop'], ['Kiln', 'Vestland Kiln Works']],
    figure: { id: 'obj-jian-tea-bowl', caption: 'The glaze she set out to match in the new kiln: a Jian ware tea bowl, iron brown with hare’s-fur streaks.', full: true },
  },
];

// "Title — Author, Source (Licence)": a photograph credits the photographer; a museum object keeps its full line.
const creditOf = (item, full = false) => {
  if (!item.credit) return 'Drawn stand-in';
  const [title, rest] = item.credit.split(' — ');
  return full || !rest ? item.credit : rest || title;
};

export default function mount(root, options, ctx) {
  const { studio } = content;
  const cases = CASES.map((c) => ({ ...studio.projects.find((p) => p.slug === c.slug), ...c, pic: photo(c.film), fig: photo(c.figure.id) }));
  const N = cases.length;
  const full = ctx.motion === 'full';
  let cfg = { ...options };

  const startTitle = document.title;
  const restoration = history.scrollRestoration;
  const urlFor = (slug) => { const u = new URL(location.href); u.searchParams.set('case', slug); u.hash = ''; return u.pathname + u.search; };
  const indexOf = (href) => Math.max(0, cases.findIndex((c) => c.slug === new URL(href, location.href).searchParams.get('case')));
  const titleFor = (i) => `${cases[i].title} — ${studio.name}`;
  const depth = () => history.state?.ncDepth || 0;

  // ---- Markup ------------------------------------------------------------------------------------------------
  const film = (i) => html`
    <div class="nc-film" data-film data-i="${i}" aria-hidden="true">
      <canvas class="nc-film__plate"></canvas>
      <span class="nc-film__tc"><span class="nc-film__dot"></span><span>Reel ${pad(i + 1)}</span><span class="nc-film__time" data-tc>00:00:00:00</span></span>
    </div>`;
  const meta = (c) => [c.year, c.place, c.discipline];
  const card = (i, heading) => (heading
    ? html`<div class="nc-card" data-card>
        <p class="nc-card__meta">${meta(cases[i]).map((m) => html`<span>${m}</span>`)}</p>
        <h1 class="nc-card__title" id="nc-title" tabindex="-1">${cases[i].title}</h1>
      </div>`
    : html`<span class="nc-card" data-card>
        <span class="nc-card__meta">${meta(cases[i]).map((m) => html`<span>${m}</span>`)}</span>
        <span class="nc-card__title">${cases[i].title}</span>
      </span>`);
  const pageHTML = (i) => {
    const c = cases[i];
    const j = (i + 1) % N;
    return html`
      <article class="nc-case" aria-labelledby="nc-title">
        <header class="nc-hero" data-hero>
          ${film(i)}
          ${card(i, true)}
          <p class="nc-hero__credit" data-credit>Site film, reel ${pad(i + 1)} · Photograph: ${creditOf(c.pic)}</p>
        </header>
        <div class="nc-body ac-wrap">
          <p class="nc-lede">${c.lede}</p>
          <dl class="nc-facts">${c.facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
          <figure class="nc-fig">
            <span class="ac-media nc-fig__media" style="--focus-point:${c.fig.focus || '50% 50%'}">${raw(imageHTML(c.fig, { sizes: '(max-width: 760px) 100vw, 40vw' }))}</span>
            <figcaption><span>${c.figure.caption}</span><span class="nc-fig__credit">${c.figure.full ? creditOf(c.fig, true) : `Photograph: ${creditOf(c.fig)}`}</span></figcaption>
          </figure>
          <div class="nc-text">${c.text.map((p) => html`<p class="ac-body">${p}</p>`)}</div>
          <dl class="nc-team">${c.team.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
        </div>
      </article>
      <nav class="nc-next" aria-label="Next case">
        <a class="nc-next__link" href="${urlFor(cases[j].slug)}" data-next aria-label="Next case: ${cases[j].title}">
          <span class="nc-next__label ac-wrap"><span class="nc-next__word">Next case</span><span class="nc-next__count">${pad(j + 1)} / ${pad(N)}</span><span class="nc-next__arrow" aria-hidden="true">↓</span></span>
          <span class="nc-next__frame" data-next-frame>
            ${film(j)}
            ${card(j, false)}
          </span>
        </a>
      </nav>`;
  };
  const buildMain = (i) => {
    const m = document.createElement('main');
    m.id = 'nc-main';
    m.className = 'nc-main';
    m.dataset.case = cases[i].slug;
    m.innerHTML = pageHTML(i);
    return m;
  };

  let current = indexOf(location.href);
  root.className = 'nc';
  root.innerHTML = html`
    <header class="nc-bar" data-bar>
      <a class="ac-brand nc-bar__brand" href="${urlFor(cases[0].slug)}" data-home>${studio.name}</a>
      <p class="nc-bar__crumb"><span class="nc-bar__work">Selected work</span><span data-crumb></span></p>
      <a class="nc-bar__contact" href="mailto:${studio.email}">Contact</a>
    </header>
    <p class="sr-only" role="status" data-status></p>`;
  const bar = root.querySelector('[data-bar]');
  const crumb = root.querySelector('[data-crumb]');
  const status = root.querySelector('[data-status]');
  root.querySelector('[data-bar]').after(buildMain(current));
  on(ctx, root.querySelector('.nc-bar__contact'), 'click', (e) => e.preventDefault());

  const { gsap, ScrollTrigger } = useGsap(ctx, root);

  // ---- Films: a canvas per hero and per close, drifting slowly over the project photograph with a running
  // timecode. The painter lives on the element, so a moved film keeps its pixels, its clock and its frame count.
  const images = new Map();
  const imageFor = (item) => {
    if (!images.has(item.id)) images.set(item.id, loadImage(item).then((img) => (img.naturalWidth ? img : null)).catch(() => null));
    return images.get(item.id);
  };
  const films = new Set();
  let filmSeq = 0;
  let unsubscribe = null;
  const ground = () => readToken('--night') || 'black';
  const focusOf = (item) => (item.focus || '50% 50%').split(' ').map((v) => parseFloat(v) / 100);
  const timecode = (t) => {
    const f = Math.floor(t * FPS);
    return `${pad(Math.floor(f / (FPS * 3600)))}:${pad(Math.floor(f / (FPS * 60)) % 60)}:${pad(Math.floor(f / FPS) % 60)}:${pad(f % FPS)}`;
  };
  const draw = (f) => {
    const { c2d, w, h, img } = f;
    if (!w || !h) return;
    if (!img) { c2d.fillStyle = ground(); c2d.fillRect(0, 0, w, h); }
    else {
      const t = f.time;
      const s = 1.14 + 0.035 * Math.sin((t * TAU) / 23);
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight) * s;
      const dw = img.naturalWidth * k;
      const dh = img.naturalHeight * k;
      const [fx, fy] = focusOf(f.item);
      const mx = dw - w;
      const my = dh - h;
      const x = Math.min(0, Math.max(-mx, w / 2 - dw * fx + Math.sin((t * TAU) / 37) * mx * 0.32));
      const y = Math.min(0, Math.max(-my, h / 2 - dh * fy + Math.cos((t * TAU) / 29) * my * 0.32));
      c2d.drawImage(img, x, y, dw, dh);
    }
    const tc = full || ctx.capture ? timecode(f.time) : 'Still';
    if (tc !== f.shown) { f.tcEl.textContent = tc; f.shown = tc; }
  };
  const size = (f) => {
    const dpr = ctx.capture ? 1 : Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(f.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(f.canvas.clientHeight * dpr));
    if (w !== f.w || h !== f.h) { f.canvas.width = f.w = w; f.canvas.height = f.h = h; draw(f); }
  };
  const dispose = (f) => { f.ro.disconnect(); f.io.disconnect(); films.delete(f); delete f.el.__film; };
  const tick = (dt) => {
    let any = false;
    for (const f of films) {
      if (!f.el.isConnected) { dispose(f); continue; }
      if (!f.visible) continue;
      any = true;
      f.time += dt;
      f.frames++;
      draw(f);
    }
    if (!any && unsubscribe) { unsubscribe(); unsubscribe = null; }
  };
  const wake = () => {
    if (!full || ctx.capture || unsubscribe) return;
    for (const f of films) if (f.visible) { unsubscribe = onFrame(ctx, tick); return; }
  };
  const attachFilm = (el) => {
    if (el.__film) return el.__film;
    const i = Number(el.dataset.i);
    const canvas = el.querySelector('canvas');
    const f = { id: ++filmSeq, el, canvas, c2d: canvas.getContext('2d'), tcEl: el.querySelector('[data-tc]'), item: cases[i].pic, img: null, w: 0, h: 0, frames: 0, visible: false, shown: '' };
    // Reduced and static paint one still; the capture holds each reel at its own moment.
    f.time = ctx.capture ? 6.4 + i * 3.1 : full ? 0 : 8;
    el.__film = f;
    films.add(f);
    f.ro = new ResizeObserver(() => size(f));
    f.ro.observe(canvas);
    f.io = new IntersectionObserver(([e]) => { f.visible = e.isIntersecting; wake(); });
    f.io.observe(el);
    imageFor(f.item).then((img) => { if (!films.has(f)) return; f.img = img; draw(f); });
    size(f);
    return f;
  };
  ctx.onCleanup(() => { for (const f of [...films]) dispose(f); });

  // ---- Pages: set-up and teardown per swapped <main>. ------------------------------------------------------------
  let page = null;
  let pending = null; // the in-flight approach scroll or lift: { kill() } resolves its promise with false
  let busy = false;
  let nav = 0;
  let fromAction = false;
  const prefetched = new Map();

  // Prefetch on intent: build the next page and decode its pictures before the click. Nothing visible changes.
  const prefetch = (i) => {
    if (!prefetched.has(i)) {
      const main = buildMain(i);
      prefetched.set(i, main);
      // A detached lazy <img> waits for the viewport; eager starts the request the browser would make on arrival.
      main.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
      imageFor(cases[(i + 1) % N].pic);
    }
    return prefetched.get(i);
  };
  const takeMain = (i) => { const m = prefetched.get(i); prefetched.delete(i); return m || buildMain(i); };

  const buildHinge = () => {
    if (!page) return;
    page.hinge?.scrollTrigger?.kill();
    page.hinge?.kill();
    page.hinge = null;
    if (!full) { gsap.set(page.card, { clearProps: 'transform' }); return; }
    page.ctx.add(() => {
      page.hinge = gsap.fromTo(page.card,
        { rotation: cfg.hingeFrom, xPercent: cfg.hingeFrom * 1.2, yPercent: 24 },
        { rotation: cfg.hingeTo, xPercent: cfg.hingeTo * 1.2, yPercent: -4, ease: 'none', scrollTrigger: { trigger: page.frame, start: 'top bottom', end: 'max', scrub: ctx.capture ? true : 0.5, invalidateOnRefresh: true } });
    });
  };

  const initPage = ({ seamless = false } = {}) => {
    const main = root.querySelector('main');
    const frame = main.querySelector('[data-next-frame]');
    const link = main.querySelector('[data-next]');
    const signal = new AbortController();
    page = { main, frame, link, card: frame.querySelector('[data-card]'), ctx: gsap.context(() => {}, main), signal, hinge: null };
    main.querySelectorAll('[data-film]').forEach(attachFilm);
    // The hero's own entrance only on a page that did not arrive already in place.
    if (full && !seamless && !ctx.capture) {
      page.ctx.add(() => gsap.from(main.querySelector('[data-hero] [data-card]'), { yPercent: 30, rotation: 4, duration: 1, ease: 'expo.out', delay: 0.25, clearProps: 'transform' }));
    }
    buildHinge();
    const intent = () => { if (cfg.prefetch) prefetch((current + 1) % N); };
    link.addEventListener('pointerenter', intent, { signal: signal.signal });
    link.addEventListener('focus', intent, { signal: signal.signal });
    link.addEventListener('click', onNext, { signal: signal.signal });
    crumb.textContent = `Case ${pad(current + 1)} of ${pad(N)}`;
    ScrollTrigger.refresh();
  };
  const destroyPage = () => {
    if (!page) return;
    pending?.kill();
    page.signal.abort();
    page.ctx.revert();
    page = null;
  };
  ctx.onCleanup(destroyPage);

  // Replace <main> with the case's page, optionally moving a live film into its hero, then reset scroll and focus.
  const swap = (i, { live = null, push = true, focus = 'none', keyNav = false } = {}) => {
    const next = takeMain(i);
    if (live) next.querySelector('[data-hero] [data-film]').replaceWith(live);
    destroyPage();
    window.scrollTo(0, 0);
    root.querySelector('main').replaceWith(next);
    for (const f of [...films]) if (!f.el.isConnected) dispose(f); // the old page's films
    current = i;
    document.title = titleFor(i);
    if (push) history.pushState({ ncDepth: depth() + 1 }, '', urlFor(cases[i].slug));
    initPage({ seamless: !!live });
    // The bar was scrolled away at the close; after a hand-off it fades back in over the arrived hero.
    if (live && full) page.ctx.add(() => gsap.fromTo([bar, next.querySelector('[data-credit]')], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, delay: 0.05, ease: 'power1.out', clearProps: 'opacity,visibility' }));
    const h1 = next.querySelector('h1');
    if (focus === 'h1' || (focus === 'auto' && document.hasFocus())) h1.focus({ preventScroll: true, focusVisible: keyNav });
    else status.textContent = `${cases[i].title}, case ${i + 1} of ${N}`;
  };

  // A tween in the page's context as a promise: true on completion, false when a newer navigation kills it.
  const run = (make) => new Promise((resolve) => {
    let tween = null;
    pending = { kill() { tween?.kill(); pending = null; resolve(false); } };
    page.ctx.add(() => { tween = make(() => { pending = null; resolve(true); }); });
  });

  // Put a lifted frame back in its clip (a hand-off cancelled before the swap).
  const settleFrame = () => {
    if (!page) return;
    gsap.set(page.frame, { clearProps: 'all' });
    page.frame.classList.remove('is-lifting');
    buildHinge();
    ScrollTrigger.refresh();
  };

  async function handOff(to, { focus = 'none', keyNav = false, approach = false } = {}) {
    if (busy || !page) return;
    busy = true;
    const my = ++nav;
    try {
      if (cfg.prefetch) prefetch(to);
      // From the toolbar: travel to the close first, so the hinge and the lift are both seen.
      const max = document.documentElement.scrollHeight - innerHeight;
      if (approach && max - scrollY > 4) {
        const from = { y: scrollY };
        const ok = await run((done) => gsap.to(from, { y: max, duration: Math.min(1.6, Math.max(0.7, (max - scrollY) / 1800)), ease: 'power2.inOut', onUpdate: () => window.scrollTo(0, from.y), onComplete: done }));
        if (!ok || my !== nav) return;
        await new Promise((r) => setTimeout(r, 240));
        if (my !== nav || !page) return;
      }
      const { frame, card } = page;
      const live = frame.querySelector('[data-film]');
      // Lift the frame out of the clip: fixed at its own rect, above everything, then up to the top while the card
      // unwinds on the same clock.
      page.hinge?.scrollTrigger?.kill(false);
      page.hinge = null;
      const r = frame.getBoundingClientRect();
      gsap.set(frame, { position: 'fixed', top: r.top, left: r.left, width: r.width, height: r.height, margin: 0 });
      frame.classList.add('is-lifting');
      const ok = await run((done) => gsap.timeline({ onComplete: done })
        .to(frame, { y: -r.top, duration: cfg.lift, ease: cfg.ease }, 0)
        .to(card, { rotation: 0, xPercent: 0, yPercent: 0, duration: cfg.lift, ease: cfg.ease }, 0));
      if (!ok || my !== nav) return;
      swap(to, { live, focus, keyNav });
    } finally {
      if (my === nav) busy = false;
    }
  }

  function onNext(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const to = indexOf(e.currentTarget.href);
    const keyNav = e.detail === 0;
    if (!full) { if (!busy) swap(to, { focus: 'h1', keyNav }); return; }
    handOff(to, { focus: 'h1', keyNav });
  }

  // The brand goes to the first case with a plain swap.
  on(ctx, root.querySelector('[data-home]'), 'click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (busy) return;
    if (current === 0) { window.scrollTo(0, 0); return; }
    swap(0, { focus: 'h1', keyNav: e.detail === 0 });
  });

  // Back and Forward: the plain swap, no lift. A traversal that keeps the case (a fragment) is left to the browser;
  // one during a lift cancels the hand-off, so the newest navigation wins.
  on(ctx, window, 'popstate', () => {
    const quiet = fromAction;
    fromAction = false;
    const i = indexOf(location.href);
    if (i === current && !busy) return;
    nav++;
    pending?.kill();
    busy = false;
    swap(i, { push: false, focus: quiet ? 'none' : 'auto' });
  });

  // The URL names the case, so a reload or a shared link lands on it; the browser must not restore the old scroll.
  history.scrollRestoration = 'manual';
  history.replaceState({ ...(history.state || {}), ncDepth: depth() }, '', urlFor(cases[current].slug));
  const baseDepth = depth();
  document.title = titleFor(current);
  ctx.onCleanup(() => {
    history.scrollRestoration = restoration;
    const u = new URL(location.href);
    u.searchParams.delete('case');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    document.title = startTitle;
  });

  const apply = () => {
    root.style.setProperty('--nc-close', `${cfg.closeHeight}svh`);
    root.style.setProperty('--nc-close-sm', `${Math.max(48, cfg.closeHeight - 8)}svh`);
    root.classList.toggle('nc--no-tc', !cfg.timecode);
  };
  apply();
  initPage({ seamless: false });

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (!busy && changed.some((k) => k === 'hingeFrom' || k === 'hingeTo')) buildHinge();
      if (changed.includes('closeHeight')) ScrollTrigger.refresh();
    },
    action(id) {
      // From the toolbar: route without pulling focus out of the page that pressed the button.
      if (id === 'next') {
        if (busy) return;
        const to = (current + 1) % N;
        if (!full) swap(to);
        else handOff(to, { approach: true });
      }
      if (id === 'back') {
        // Only an entry this mount pushed: after a re-mount (Replay, a motion change) the demo starts again on the
        // first case, and the entries left from before would step back to a page that is already showing.
        if (depth() > baseDepth) { fromAction = true; history.back(); return; }
        if (busy) { nav++; pending?.kill(); busy = false; settleFrame(); }
      }
    },
  };
}
