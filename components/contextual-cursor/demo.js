// Contextual cursor — Halden's work page. A dot follows a fine pointer almost at once (lerp .75 per 60 fps frame)
// and a ring trails it (lerp .22), both through damp() so the feel is the same at 60 and 144 Hz. Over links the ring
// grows 1.35× and the dot shrinks 0.7×; over [data-cursor] targets the ring grows into a badge that names the
// gesture (View, Play/Pause, Drag). The loop sleeps once both parts settle. Coarse pointers: never created.
import './demo.css';
import { on, onFrame, damp, finePointer, colour, html, raw, photos, videos, credit, imageHTML, content } from '../../src/demo-kit/index.js';

const DOT_LERP = 0.75;
const k = (lerp) => -Math.log(1 - lerp) * 60; // a per-frame lerp → a damping rate
const ICON = {
  view: '<path d="M7 17 17 7M8 7h9v9"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  drag: '<path d="M9 7 4 12l5 5M15 7l5 5-5 5"/>',
};
const LABEL = { view: 'View', play: 'Play', pause: 'Pause', drag: 'Drag' };
const icon = (name) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`);
const WORKSHOP = ['Massing model, 1:200', 'Larch cladding samples', 'Site visit, Hardanger', 'Glaze tests for Kiln House', 'Window detail, 1:5', 'Arc Chair, steam-bending jig', 'Tern Library reading room'];

export default function mount(root, options, ctx) {
  const { studio } = content;
  const work = studio.projects;
  const pics = photos({ tags: ['architecture'], count: 4, seed: 'cc-work' }).concat(photos({ tags: ['interior'], count: 2, seed: 'cc-int' }));
  const strip = photos({ tags: ['object'], count: 4, seed: 'cc-strip' }).concat(photos({ tags: ['texture'], count: 3, seed: 'cc-tex' }));
  const reelPic = photos({ tags: ['landscape'], count: 1, seed: 'cc-reel' })[0];
  const film = videos[0];
  credit(film);
  let cfg = { ...options };

  const card = (p, pic, cls) => html`
    <li class="cc__item ${cls}">
      <a class="cc__card" href="#${p.slug}" data-cursor="view">
        <span class="ac-media cc__media">${raw(imageHTML(pic, { sizes: '(max-width: 720px) 100vw, 50vw', alt: '' }))}</span>
        <span class="cc__cap"><strong>${p.title}</strong><span>${p.place.replace(/, [A-Z]{2}$/, '')} · ${p.year}</span></span>
      </a>
    </li>`;

  root.className = 'cc';
  root.innerHTML = html`
    <header class="ac-bar cc__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n, i) => html`<a href="#top"${i === 0 ? raw(' aria-current="page"') : ''}>${n}</a>`)}</nav>
    </header>
    <main class="ac-wrap cc__main">
      <div class="cc__intro">
        <h1 class="ac-h1">Selected work</h1>
        <p class="ac-lede">Houses, a library, a bathing pavilion and one chair, from four years on the west coast.</p>
      </div>
      <ul class="cc__grid" role="list">
        ${card(work[0], pics[0], 'cc__item--lead')}
        <li class="cc__item cc__item--reel">
          <button class="cc__reel" type="button" data-cursor="play" aria-pressed="false">
            <span class="ac-media cc__media cc__media--reel">
              ${film ? raw(`<video muted loop playsinline preload="none" poster="${film.poster}" src="${film.src}"></video>`) : raw(imageHTML(reelPic, { sizes: '40vw', alt: '' }))}
              <span class="cc__reel-veil"></span>
              <span class="cc__reel-copy">
                <span class="ac-label">Showreel 2026</span>
                <span class="cc__reel-title">Six buildings in one minute and forty-two seconds</span>
                <span class="cc__reel-bar"><span class="cc__reel-play">${icon('play')}${icon('pause')}<span class="sr-only">Play the showreel</span></span><span class="cc__progress"><span></span></span><span class="ac-label cc__time">1:42</span></span>
              </span>
            </span>
          </button>
          <span class="cc__cap"><strong>Showreel</strong><span>Filmed on site · 2022–26</span></span>
        </li>
        ${card(work[1], pics[1], '')}
        ${card(work[2], pics[2], '')}
        ${card(work[3], pics[4], '')}
        ${card(work[4], pics[3], 'cc__item--wide')}
        ${card(work[5], pics[5], 'cc__item--narrow')}
      </ul>
      <section class="cc__workshop" aria-labelledby="cc-ws">
        <div class="cc__ws-head">
          <h2 class="ac-h3" id="cc-ws">From the workshop</h2>
          <p class="ac-small">Models, samples and site visits<span class="cc__touch-hint"> · swipe sideways</span>.</p>
        </div>
        <div class="cc__strip" data-cursor="drag" tabindex="0" role="group" aria-labelledby="cc-ws">
          ${strip.map((pic, i) => html`<figure class="cc__shot"><span class="ac-media cc__media">${raw(imageHTML(pic, { sizes: '320px', alt: '' }).replace('<img ', '<img draggable="false" '))}</span><figcaption class="ac-small">${WORKSHOP[i]}</figcaption></figure>`)}
        </div>
      </section>
      <footer class="cc__foot"><span class="ac-small">${studio.full} · ${studio.address[0]}, ${studio.city}</span><a class="ac-link ac-small" href="mailto:${studio.email}">${studio.email}</a></footer>
    </main>`;
  root.querySelectorAll('a[href^="#"], a[href^="mailto"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  // The reel: a real toggle button. With a video in the media set it plays it; otherwise the still drifts.
  const reel = root.querySelector('.cc__reel');
  const video = reel.querySelector('video');
  on(ctx, reel, 'click', () => {
    const playing = reel.getAttribute('aria-pressed') !== 'true';
    reel.setAttribute('aria-pressed', String(playing));
    reel.dataset.cursor = playing ? 'pause' : 'play';
    reel.querySelector('.sr-only').textContent = playing ? 'Pause the showreel' : 'Play the showreel';
    if (video) (playing ? video.play().catch(() => {}) : video.pause());
    cursor?.refresh();
  });

  // The strip: native sideways overflow (touch, trackpads, arrow keys once focused) plus mouse drag with a short coast.
  const stripEl = root.querySelector('.cc__strip');
  let drag = null;
  let vel = 0;
  let stopCoast = null;
  const coastOff = () => { stopCoast?.(); stopCoast = null; };
  on(ctx, stripEl, 'pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    coastOff();
    e.preventDefault();
    drag = { x: e.clientX, left: stripEl.scrollLeft, lastX: e.clientX, lastT: e.timeStamp };
    vel = 0;
    stripEl.setPointerCapture(e.pointerId);
    root.classList.add('is-pressing');
  });
  on(ctx, stripEl, 'pointermove', (e) => {
    if (!drag) return;
    stripEl.scrollLeft = drag.left - (e.clientX - drag.x);
    const dt = Math.max(8, e.timeStamp - drag.lastT);
    vel = vel * 0.5 + (((e.clientX - drag.lastX) / dt) * 1000) * 0.5;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
  });
  const release = () => {
    if (!drag) return;
    drag = null;
    root.classList.remove('is-pressing');
    if (ctx.motion !== 'full' || Math.abs(vel) < 80) return;
    stopCoast = onFrame(ctx, (dt) => {
      const before = stripEl.scrollLeft;
      stripEl.scrollLeft -= vel * dt;
      vel *= Math.exp(-5 * dt);
      if (Math.abs(vel) < 20 || stripEl.scrollLeft === before) coastOff();
    });
  };
  on(ctx, stripEl, 'pointerup', release);
  on(ctx, stripEl, 'pointercancel', release);
  on(ctx, stripEl, 'wheel', coastOff, { passive: true });

  // The cursor layer: only for a fine pointer with hover; created and removed with the media query.
  let cursor = null;
  const fine = matchMedia('(pointer: fine) and (hover: hover)');
  const toggle = () => {
    if (finePointer() && !cursor) cursor = createCursor();
    else if (!finePointer() && cursor) { cursor.destroy(); cursor = null; }
  };

  function createCursor() {
    // Two fixed layers on the same two positions: the ring and the dot (which may blend with the page), and the
    // badge (always drawn normally so its label stays legible).
    const layer = document.createElement('div');
    layer.className = 'cc__cursor';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `<div class="cc__layer cc__layer--marks"><div class="cc__follow" data-ring><div class="cc__ring"></div></div><div class="cc__follow" data-dot><div class="cc__dot"></div></div></div><div class="cc__layer"><div class="cc__follow" data-ring><div class="cc__disc"><span class="cc__disc-label"></span></div></div><div class="cc__follow" data-dot><div class="cc__tag"></div></div></div>`;
    root.append(layer);
    root.classList.add('has-cursor');
    const ringEls = layer.querySelectorAll('[data-ring]');
    const dotEls = layer.querySelectorAll('[data-dot]');
    const discLabel = layer.querySelector('.cc__disc-label');
    const tag = layer.querySelector('.cc__tag');
    const target = { x: innerWidth / 2, y: innerHeight / 2 };
    const dot = { ...target };
    const ring = { ...target };
    let current = '';
    let stop = null;

    const frame = (dt) => {
      const d = ctx.motion === 'full' ? dt : 1; // reduced: no lag, both parts sit on the pointer
      dot.x = damp(dot.x, target.x, k(DOT_LERP), d);
      dot.y = damp(dot.y, target.y, k(DOT_LERP), d);
      ring.x = damp(ring.x, target.x, k(cfg.ringLerp), d);
      ring.y = damp(ring.y, target.y, k(cfg.ringLerp), d);
      const dt3 = `translate3d(${dot.x.toFixed(2)}px, ${dot.y.toFixed(2)}px, 0)`;
      const rt3 = `translate3d(${ring.x.toFixed(2)}px, ${ring.y.toFixed(2)}px, 0)`;
      dotEls.forEach((el) => { el.style.transform = dt3; });
      ringEls.forEach((el) => { el.style.transform = rt3; });
      if (Math.abs(ring.x - target.x) + Math.abs(ring.y - target.y) + Math.abs(dot.x - target.x) + Math.abs(dot.y - target.y) < 0.1) { stop?.(); stop = null; }
    };
    const wake = () => { if (!stop) stop = onFrame(ctx, frame); };

    const setHover = (el) => {
      const interactive = el?.closest?.('a, button, [role="button"], [data-cursor], input, select, textarea, summary');
      const badge = interactive?.closest('[data-cursor]')?.dataset.cursor || '';
      layer.classList.toggle('is-hover', !!interactive);
      layer.classList.toggle('has-badge', !!badge);
      if (badge && badge !== current) {
        discLabel.innerHTML = badge === 'drag' ? `${icon('drag')}${LABEL.drag}` : `${LABEL[badge]}${icon(badge)}`;
        tag.textContent = LABEL[badge];
      }
      current = badge;
      layer.dataset.badge = badge;
    };
    const show = () => layer.classList.add('is-visible');
    const hide = () => layer.classList.remove('is-visible');
    const refresh = () => setHover(document.elementFromPoint(target.x, target.y));

    const ac = new AbortController();
    const opts = { signal: ac.signal };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!layer.classList.contains('is-visible')) { dot.x = ring.x = target.x; dot.y = ring.y = target.y; show(); }
      wake();
    }, { ...opts, passive: true });
    root.addEventListener('pointerover', (e) => setHover(e.target), opts);
    window.addEventListener('pointerout', (e) => { if (!e.relatedTarget) hide(); }, opts);
    window.addEventListener('blur', hide, opts);
    window.addEventListener('scroll', () => { if (layer.classList.contains('is-visible')) refresh(); }, { ...opts, passive: true });
    stripEl.addEventListener('scroll', () => { if (layer.classList.contains('is-visible')) refresh(); }, { ...opts, passive: true });

    const destroy = () => { ac.abort(); stop?.(); layer.remove(); root.classList.remove('has-cursor'); };
    ctx.onCleanup(destroy);
    return { destroy, refresh };
  }

  // Badge text on another colour: light or dark ink, whichever contrasts more with the fill's real colour (tokens
  // differ per theme). The accent keeps its own pairing, --on-accent.
  const probe = document.createElement('span');
  probe.hidden = true;
  root.append(probe);
  const inkFor = () => {
    if (cfg.badgeColour === 'accent') return 'var(--on-accent)';
    probe.style.color = colour(cfg.badgeColour);
    const m = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) || [0, 0, 0];
    const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]);
    return 1.05 / (L + 0.05) >= (L + 0.05) / 0.056 ? 'rgb(255 255 255)' : 'rgb(18 18 17)';
  };

  const apply = () => {
    root.style.setProperty('--cc-ring', `${cfg.ringSize}px`);
    root.style.setProperty('--cc-badge', colour(cfg.badgeColour));
    root.style.setProperty('--cc-badge-ink', inkFor());
    root.dataset.badge = cfg.badge;
    root.dataset.blend = cfg.blend;
  };
  apply();
  ctx.onTheme(apply);
  toggle();
  on(ctx, fine, 'change', toggle);

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
  };
}
