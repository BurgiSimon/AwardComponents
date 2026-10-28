// Peek carousel — Fieldnote's "In this issue": six stories in a centred carousel. Every card is the same size; the
// centred one is sharp and its neighbours dim and blur. The gap is computed so a fixed slice of each neighbour
// always shows (peek 10 % of the width, 14 % at 920 px and below). A drag snaps to the next card and the release
// speed sets the snap's duration and curve; past either end the drag resists like a rubber band and a critically
// damped spring (stiffness 170) brings it back, stepped with its exact solution on the shared ticker's dt.
// Reduced motion: the focus state stays, every snap and return is instant; a drag still follows the finger.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, html, raw, clamp, ticker, photo, allPhotos, observeResize, content } from '../../src/demo-kit/index.js';

// Snap bands by release speed (px/ms). Fast flicks get the crisp curve, slow drags and snap-backs the soft one.
const SNAP = { fast: 1.2, mid: 0.6, commit: 0.3, commitDrag: 0.15, key: 450 };
const STIFFNESS = 170;
const OMEGA = Math.sqrt(STIFFNESS);      // damping 2√170 ≈ 26.1 is critical: the return never oscillates
const DRAG_THRESHOLD = 8;                // px before a press becomes a drag (a shorter press stays a click)
const VELOCITY_WINDOW = 100;             // ms of pointer samples that set the release speed
const MIN_GAP = 20;

// cubic-bezier(x1, y1, x2, y2) as a function of progress: Newton on x(t), then y(t).
function bezier(x1, y1, x2, y2) {
  const poly = (a1, a2) => [1 - 3 * a2 + 3 * a1, 3 * a2 - 6 * a1, 3 * a1];
  const [ax, bx, cx] = poly(x1, x2);
  const [ay, by, cy] = poly(y1, y2);
  return (p) => {
    if (p <= 0 || p >= 1) return clamp(p, 0, 1);
    let t = p;
    for (let i = 0; i < 8; i++) {
      const err = ((ax * t + bx) * t + cx) * t - p;
      const slope = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(err) < 1e-5 || Math.abs(slope) < 1e-6) break;
      t = clamp(t - err / slope, 0, 1);
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
const CURVES = { flick: bezier(0.25, 0.46, 0.45, 0.94), placed: bezier(0.32, 0.72, 0.37, 1) };

// Which pictures suit which story; the first unused match wins, a drawn field stands in when nothing fits.
const ART = { 'salt-and-time': ['landscape'], 'the-quiet-room': ['interior'], 'glaze-chemistry': ['ceramic'], 'night-swimming': ['water'], 'slow-tools': ['furniture'], 'map-of-light': ['city'] };
function pictures(articles) {
  const pool = allPhotos();
  const taken = new Set();
  return articles.map((a) => {
    const tags = ART[a.slug] || [];
    const hit = pool.find((p) => tags.every((t) => p.tags?.includes(t)) && !taken.has(p.id)) || pool.find((p) => p.tags?.includes('editorial') && !taken.has(p.id));
    if (hit) { taken.add(hit.id); return photo(hit.id); }
    return photo(`fieldnote-${a.slug}`);
  });
}

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const stories = magazine.articles;
  const art = pictures(stories);
  let cfg = { ...options };
  const instant = () => ctx.motion !== 'full';
  const N = stories.length;

  root.className = 'pc';
  root.innerHTML = html`
    <header class="ac-bar pc__bar">
      <a class="ac-brand pc__brand" href="#top">${magazine.name}</a>
      <nav aria-label="Magazine"><a href="#issues">Issues</a><a href="#places">Places</a><a href="#craft">Craft</a></nav>
      <a class="ac-btn ac-btn--sm ac-btn--ghost" href="#subscribe">Subscribe</a>
    </header>
    <section class="pc__carousel" aria-roledescription="carousel" aria-labelledby="pc-title" data-carousel>
      <div class="ac-wrap pc__head">
        <div class="pc__heading">
          <p class="ac-label">${magazine.issue}</p>
          <h1 class="pc__title" id="pc-title">In this issue</h1>
        </div>
        <div class="pc__controls">
          <p class="pc__count ac-label ac-num" aria-live="polite" data-count>2 of ${N}</p>
          <button type="button" class="pc__btn" data-prev aria-label="Previous story"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>
          <button type="button" class="pc__btn" data-next aria-label="Next story"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
        </div>
      </div>
      <div class="pc__viewport" data-viewport>
        <ul class="pc__track" role="list" data-track>
          ${stories.map((s, i) => html`
            <li class="pc__item" aria-roledescription="slide" aria-label="${i + 1} of ${N}">
              <a class="pc__card" href="#${s.slug}" draggable="false">
                <span class="pc__art ac-media">${raw(imgTag(art[i]))}</span>
                <span class="pc__meta ac-label">${s.section} · ${s.read}</span>
                <span class="pc__name">${s.title}</span>
                <span class="pc__dek">${s.dek}</span>
                <span class="pc__by">${s.author}</span>
              </a>
            </li>`)}
        </ul>
      </div>
    </section>`;
  root.querySelectorAll('.pc__bar a').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const viewport = root.querySelector('[data-viewport]');
  const track = root.querySelector('[data-track]');
  const items = [...track.children];
  const links = items.map((li) => li.querySelector('a'));
  const count = root.querySelector('[data-count]');
  const narrow = matchMedia('(max-width: 920px)');

  const S = { index: 0, x: 0, mode: 'rest', v: 0, gap: 0, peek: 0, step: 0, x0: 0, width: 0 };
  let snap = null;       // { from, to, ms, elapsed, ease }
  let drag = null;       // { id, startX, base, moved, samples, startIndex }
  let suppressClick = false;
  let ticking = false;

  const xFor = (i) => S.x0 - i * S.step;
  const band = (o) => S.width * (1 - 1 / ((o * cfg.band) / S.width + 1));
  const unband = (b) => (S.width / cfg.band) * (b / (S.width - b));   // inverse of band(): grabbing mid-return does not jump
  const render = () => { track.style.transform = `translate3d(${S.x.toFixed(2)}px, 0, 0)`; };

  const apply = () => {
    root.style.setProperty('--pc-blur', `${cfg.blur}px`);
    root.style.setProperty('--pc-dim', String(cfg.dim));
  };

  function layout() {
    S.width = viewport.clientWidth;
    const w = items[0].offsetWidth;
    S.peek = S.width * (cfg.peek / 100) * (narrow.matches ? 1.4 : 1);
    // Size the peek, not the gap: whatever the card width, exactly `peek` px of each neighbour shows.
    S.gap = Math.max(MIN_GAP, S.width / 2 - w / 2 - S.peek);
    track.style.gap = `${S.gap}px`;
    S.step = w + S.gap;
    S.x0 = S.width / 2 - w / 2;
    if (!drag?.moved) { snap = null; S.mode = 'rest'; S.x = xFor(S.index); render(); }
  }

  function setActive(i) {
    S.index = i;
    items.forEach((li, k) => li.classList.toggle('is-active', k === i));
    links.forEach((a, k) => { a.tabIndex = k === i ? 0 : -1; });   // roving tabindex: one Tab stop for the carousel
    count.textContent = `${i + 1} of ${N}`;
  }

  // One ticker drives the snap tween and the spring; both read dt, so they run the same at 60 and 144 Hz.
  function tick(dt) {
    if (S.mode === 'snap') {
      snap.elapsed += dt * 1000;
      const p = Math.min(1, snap.elapsed / snap.ms);
      S.x = snap.from + (snap.to - snap.from) * snap.ease(p);
      if (p >= 1) settle();
    } else if (S.mode === 'spring') {
      // Exact step of a critically damped spring: x(t) = (x0 + (v0 + ωx0)t)·e^(−ωt). Stable for any dt.
      const edge = xFor(S.index);
      const d = S.x - edge;
      const c = S.v + OMEGA * d;
      const e = Math.exp(-OMEGA * dt);
      const nd = (d + c * dt) * e;
      S.v = (S.v - OMEGA * c * dt) * e;
      S.x = edge + nd;
      if (Math.abs(nd) < 0.5 && Math.abs(S.v) < 5) settle();
    }
    render();
    if (S.mode === 'rest' || S.mode === 'drag') stop();
  }
  const start = () => { if (!ticking) { ticking = true; ticker.add(tick); } };
  const stop = () => { if (ticking) { ticking = false; ticker.remove(tick); } };
  ctx.onCleanup(stop);

  function settle() { S.mode = 'rest'; S.v = 0; S.x = xFor(S.index); snap = null; }

  function snapTo(i, ms, curve) {
    setActive(i);
    if (instant()) { settle(); render(); return; }
    snap = { from: S.x, to: xFor(i), ms, elapsed: 0, ease: CURVES[curve] };
    S.mode = 'snap';
    start();
  }

  function go(i, focus = false) {
    i = clamp(i, 0, N - 1);
    if (i !== S.index || S.x !== xFor(i)) snapTo(i, SNAP.key, 'placed');
    if (focus) links[i].focus({ preventScroll: true });
  }

  // Release: past an end the spring takes over; otherwise the release speed picks target, duration and curve.
  function release(v, dx, startIndex) {
    if (S.x > xFor(0) || S.x < xFor(N - 1)) {
      const i = S.x > xFor(0) ? 0 : N - 1;
      setActive(i);
      if (instant()) { settle(); render(); return; }
      const over = Math.abs(S.x - xFor(i));
      // Hand the pointer's speed to the spring through the band's slope at the release point.
      const slope = cfg.band / ((unband(over) * cfg.band) / S.width + 1) ** 2;
      S.v = v * 1000 * slope;
      S.mode = 'spring';
      start();
      return;
    }
    const speed = Math.abs(v);
    let target = Math.round((S.x0 - S.x) / S.step);
    const dir = speed > SNAP.commit ? Math.sign(v) : Math.abs(dx) > SNAP.commitDrag * S.step ? Math.sign(dx) : 0;
    if (target === startIndex && dir) target = startIndex - dir;   // dragging right (+x) moves toward the previous card
    target = clamp(target, 0, N - 1);
    const dist = clamp(Math.abs(xFor(target) - S.x) / S.step, 0, 1);
    if (target === startIndex) return snapTo(target, 350 + 200 * dist, 'placed');               // snap-back 350–550 ms
    if (cfg.feel === 'crisp') return snapTo(target, 320, 'flick');
    if (cfg.feel === 'soft') return snapTo(target, 450 + 150 * dist, 'placed');
    if (speed > SNAP.fast) return snapTo(target, 320, 'flick');                                     // flick 320 ms
    if (speed > SNAP.mid) return snapTo(target, 400 - 80 * ((speed - SNAP.mid) / (SNAP.fast - SNAP.mid)), 'flick');   // 400 → 320 ms
    return snapTo(target, 450 + 150 * dist, 'placed');                                              // placed 450–600 ms
  }

  on(ctx, viewport, 'pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    suppressClick = false;
    drag = { id: e.pointerId, startX: e.clientX, base: 0, moved: false, startIndex: S.index, samples: [[performance.now(), e.clientX]] };
  });
  on(ctx, viewport, 'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.startX;
    const now = performance.now();
    drag.samples.push([now, e.clientX]);
    while (drag.samples.length > 2 && drag.samples[0][0] < now - 150) drag.samples.shift();
    const lo = xFor(N - 1);
    const hi = xFor(0);
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      // Capture only once it is a drag, so a plain click still lands on the link under the pointer.
      drag.moved = true;
      viewport.setPointerCapture(e.pointerId);
      root.classList.add('is-dragging');
      S.mode = 'drag'; snap = null; S.v = 0;
      stop();
      const raw0 = S.x > hi ? hi + unband(S.x - hi) : S.x < lo ? lo - unband(lo - S.x) : S.x;
      drag.base = raw0 - dx;
    }
    const rawX = drag.base + dx;
    S.x = rawX > hi ? hi + band(rawX - hi) : rawX < lo ? lo - band(lo - rawX) : rawX;
    render();
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    root.classList.remove('is-dragging');
    if (!d.moved) return;
    suppressClick = true;
    const now = performance.now();
    const recent = d.samples.filter(([t]) => t >= now - VELOCITY_WINDOW);
    const [t0, x0] = recent[0] || [now, 0];
    const [t1, x1] = recent.at(-1) || [now, 0];
    const v = t1 - t0 > 0 ? (x1 - x0) / (t1 - t0) : 0;   // px/ms; a pointer that rested before release has no speed
    release(v, e.clientX - d.startX, d.startIndex);
  };
  on(ctx, viewport, 'pointerup', endDrag);
  on(ctx, viewport, 'pointercancel', endDrag);
  on(ctx, track, 'dragstart', (e) => e.preventDefault());

  on(ctx, track, 'click', (e) => {
    const a = e.target.closest('a');
    e.preventDefault();   // the stories are not routed in the demo; a real site follows the centred link
    if (suppressClick) { suppressClick = false; return; }
    const i = links.indexOf(a);
    if (i >= 0 && i !== S.index) go(i, true);   // a peeking neighbour is chosen, not followed
  }, { capture: true });
  on(ctx, track, 'focusin', (e) => {
    const i = links.indexOf(e.target);
    if (!drag && i >= 0 && i !== S.index) go(i);
  });
  on(ctx, root.querySelector('[data-carousel]'), 'keydown', (e) => {
    const to = { ArrowRight: S.index + 1, ArrowLeft: S.index - 1, Home: 0, End: N - 1 }[e.key];
    if (to === undefined || !track.contains(e.target)) return;
    e.preventDefault();
    go(to, true);
  });
  on(ctx, root.querySelector('[data-prev]'), 'click', () => go(S.index - 1));
  on(ctx, root.querySelector('[data-next]'), 'click', () => go(S.index + 1));

  // Open on the second story, so both neighbours peek from the first frame.
  apply();
  setActive(1);
  layout();
  observeResize(ctx, viewport, layout);
  on(ctx, narrow, 'change', layout);
  if (instant()) root.classList.add('pc--instant');

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('peek')) layout();
    },
    action(id) {
      if (id === 'next') go(S.index === N - 1 ? 0 : S.index + 1);
    },
  };
}

// Not lazy: the neighbours sit outside the viewport's clip until a drag brings them in, and must not pop in late.
function imgTag(item) {
  const srcset = !item.drawn && item.srcSm ? ` srcset="${item.srcSm} ${item.smWidth || 640}w, ${item.src} ${item.width || 1800}w" sizes="(max-width: 920px) 60vw, 880px"` : '';
  return `<img src="${item.srcSm || item.src}"${srcset} alt="" width="${item.width || 1200}" height="${item.height || 1500}" decoding="async" draggable="false" style="object-position:${item.focus || '50% 50%'}">`;
}
