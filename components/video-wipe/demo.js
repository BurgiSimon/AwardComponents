// Media panel wipe — Signal's four stages as a deck of full-bleed media panels (one name each) over a compact stage
// list. Two media buffers are double-buffered: the hidden one already holds the next stage's footage (a clip from
// media.videos whose tags match the stage, else a photo with a slow push-in standing in for footage). On a change the
// hidden buffer opens over the visible one from a directional clip-path inset while a 1 px glowing seam rides the
// edge on the same plain-object tween. Copy leaves first (.34 s power2.in), the gate opens at .12 s (1 s expo.inOut), copy rises over the last
// third. The document never scrolls: stepped wheel (|deltaY| ≥ 18, locked 1 s + a 300 ms tail), swipe > 55 px,
// arrow / Page / Home / End keys, prev / next and the stage list. Reduced: .2 s cross-fade, no seam, footage rests.
import './demo.css';
import { Observer } from 'gsap/Observer';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { on, html, clamp, colour, photo, allPhotos, videos, credit, whileVisible, content } from '../../src/demo-kit/index.js';

gsap.registerPlugin(Observer);

const STAGES = [
  { name: 'Harbour', tags: ['water'] },
  { name: 'Hall 4', tags: ['architecture'] },
  { name: 'The Crane', tags: ['city'] },
  { name: 'Greenhouse', tags: ['nature'] },
];
const N = STAGES.length;

const SEAM_AT = 0.12;   // s into the change: copy leaves first, then the gate opens
const FADE = 0.2;       // s cross-fade under reduced motion
const WHEEL_MIN = 18;   // |deltaY| px for one step (stepped wheel)
const LOCK = 1000;      // ms the wheel stays swallowed after a step
const TAIL = 300;       // ms more after the change settles, for trackpad inertia
const SWIPE = 55;       // px of finger travel for one step
const CEILING = 1200;   // ms a missed preload may hold a change before it wipes to whatever has painted
const pad = (n) => String(n).padStart(2, '0');

// One picture per stage, never the same one twice; a clip from the shared set only when its tags match the stage.
function mediaFor() {
  const pool = allPhotos();
  const taken = new Set();
  return STAGES.map((s, i) => {
    const clip = videos.find((v) => s.tags.some((t) => v.tags?.includes(t)) && !taken.has(v.src)) || null;
    if (clip) { taken.add(clip.src); credit(clip); return { type: 'video', src: clip.src, poster: clip.poster }; }
    for (const tags of [[...s.tags, 'landscape-orientation'], s.tags]) {
      const hit = pool.find((p) => tags.every((t) => p.tags?.includes(t)) && !taken.has(p.id));
      if (hit) { taken.add(hit.id); return { type: 'image', item: photo(hit.id) }; }
    }
    return { type: 'image', item: photo(`signal-stage-${i}`) };   // unknown id → a drawn colour field
  });
}

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  const media = mediaFor();
  const tier = ctx.motion;

  root.className = 'vw';
  root.innerHTML = html`
    <h1 class="sr-only">The four stages of ${festival.edition}</h1>
    <div class="vw__frame" data-frame>
      <div class="vw__media" aria-hidden="true">
        ${['a', 'b'].map((id) => html`<div class="vw__layer" data-layer="${id}"><img alt="" decoding="async"><video muted playsinline loop preload="none" hidden></video></div>`)}
        <div class="vw__seam" data-seam></div>
        <div class="vw__shade"></div>
      </div>
      <div class="vw__deck" data-deck>
        ${STAGES.map((s, i) => html`
          <section class="vw__panel" aria-labelledby="vw-t${i}" data-panel="${i}">
            <h2 class="ac-display vw__title" id="vw-t${i}" data-rise>${s.name}</h2>
          </section>`)}
      </div>
      <p class="ac-stage__note ac-stage__note--media vw__note"><span>${festival.name} · stages page</span></p>
    </div>
    <nav class="vw__nav" aria-label="Stages" data-controls>
      <ol class="vw__tabs" role="list">
        ${STAGES.map((s, i) => html`<li><button type="button" class="vw__tab" data-go="${i}"><span class="vw__tab-n ac-label">${pad(i + 1)}</span><span class="vw__tab-name">${s.name}</span><span class="vw__tab-bar" aria-hidden="true"></span></button></li>`)}
      </ol>
      <p class="vw__count ac-label ac-num" aria-hidden="true" data-counter>01 / ${pad(N)}</p>
      <div class="vw__keys">
        <button type="button" class="vw__key" data-prev aria-label="Previous stage"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>
        <button type="button" class="vw__key" data-next aria-label="Next stage"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
      </div>
    </nav>
    <p class="sr-only" aria-live="polite" data-live></p>`;

  const frame = root.querySelector('[data-frame]');
  const seam = root.querySelector('[data-seam]');
  const panels = [...root.querySelectorAll('[data-panel]')];
  const tabs = [...root.querySelectorAll('[data-go]')];
  const prevBtn = root.querySelector('[data-prev]');
  const nextBtn = root.querySelector('[data-next]');
  const counter = root.querySelector('[data-counter]');
  const live = root.querySelector('[data-live]');

  // One object per buffer: which stage it holds and a promise that settles once a frame can paint.
  const layers = [...root.querySelectorAll('[data-layer]')].map((el) => ({ el, img: el.querySelector('img'), video: el.querySelector('video'), holds: -1 }));
  let index = 0, from = 0, front = 0, tl = null, dir = 1, lockUntil = 0, waiting = false, visible = true;
  const { context } = useGsap(ctx, root);

  // Point a buffer at a stage's media. Returns null when it already holds it (a preload hit), else a promise.
  function load(layer, i) {
    if (layer.holds === i) return null;
    layer.holds = i;
    const m = media[i];
    const isVideo = m.type === 'video';
    layer.video.hidden = !isVideo;
    layer.img.hidden = isVideo;
    let ready;
    if (isVideo) {
      layer.video.pause();
      layer.video.poster = m.poster || '';
      layer.video.preload = 'auto';
      layer.video.src = m.src;
      layer.video.load();
      ready = new Promise((r) => layer.video.addEventListener('loadeddata', r, { once: true, signal: ctx.signal }));
    } else {
      const { item } = m;
      if (!item.drawn && item.srcSm) { layer.img.srcset = `${item.srcSm} ${item.smWidth || 640}w, ${item.src} ${item.width || 1800}w`; layer.img.sizes = '100vw'; } else layer.img.removeAttribute('srcset');
      layer.img.src = item.src;
      layer.img.style.objectPosition = item.focus || '50% 50%';
      ready = layer.img.decode().catch(() => {});
    }
    return Promise.race([ready, new Promise((r) => setTimeout(r, CEILING))]);
  }

  // Footage plays only on the full tier, only on the buffers that paint, and only while the deck is on screen.
  const playback = () => {
    for (const l of layers) {
      const shows = l.el.classList.contains('is-front') || l.el.classList.contains('is-incoming');
      if (l.video.hidden) continue;
      if (shows && visible && tier === 'full') l.video.play().catch(() => {});
      else l.video.pause();
    }
  };
  whileVisible(ctx, frame, () => { visible = true; playback(); root.classList.remove('is-away'); }, () => { visible = false; playback(); root.classList.add('is-away'); });
  ctx.onCleanup(() => layers.forEach((l) => { l.video.pause(); l.video.removeAttribute('src'); }));

  const apply = () => {
    root.dataset.dir = cfg.direction;
    root.style.setProperty('--vw-glow', String(cfg.glow));
    root.style.setProperty('--vw-seam', colour(cfg.seamColour));
  };

  function sync() {
    counter.textContent = `${pad(index + 1)} / ${pad(N)}`;
    tabs.forEach((t, i) => { if (i === index) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
    prevBtn.setAttribute('aria-disabled', String(index === 0));   // aria-disabled, not disabled: focus stays on the key
    nextBtn.setAttribute('aria-disabled', String(index === N - 1));
  }

  // Clip and seam from one number. Across: forward opens left → right, back right → left. Rise: bottom → top, back down.
  function setWipe(inc, p) {
    const rest = `${((1 - p) * 100).toFixed(3)}%`;
    const fwd = dir > 0;
    if (cfg.direction === 'rise') {
      inc.el.style.clipPath = fwd ? `inset(${rest} 0 0 0)` : `inset(0 0 ${rest} 0)`;
      seam.style.transform = `translate3d(0, ${((fwd ? 1 - p : p) * 100).toFixed(3)}%, 0)`;
    } else {
      inc.el.style.clipPath = fwd ? `inset(0 ${rest} 0 0)` : `inset(0 0 0 ${rest})`;
      seam.style.transform = `translate3d(${((fwd ? p : 1 - p) * 100).toFixed(3)}%, 0, 0)`;
    }
    // The stage list fills on the same number: forward the new segment grows, back the old one empties.
    (dir > 0 ? tabs[index] : tabs[from]).style.setProperty('--p', (dir > 0 ? p : 1 - p).toFixed(4));
  }
  const fillTabs = () => tabs.forEach((t, i) => t.style.setProperty('--p', i <= index ? '1' : '0'));

  function settle(from, inc, out) {
    tl = null;
    lockUntil = Math.max(lockUntil, performance.now() + TAIL);
    inc.el.classList.replace('is-incoming', 'is-front');
    out.el.classList.remove('is-front');
    front = layers.indexOf(inc);
    inc.el.style.clipPath = '';
    gsap.set(inc.el, { clearProps: 'opacity' });
    gsap.set(seam, { opacity: 0 });
    panels[from].classList.remove('is-leaving');
    gsap.set([...panels[from].querySelectorAll('[data-rise]'), ...panels[index].querySelectorAll('[data-rise]')], { clearProps: 'transform,opacity' });
    fillTabs();
    playback();
    // The outgoing buffer is hidden now: park it and preload the likely next stage into it.
    load(out, index + (index < N - 1 ? 1 : -1));
  }

  function run(from, inc, out, instant) {
    const mode = instant ? 'static' : tier;
    inc.el.classList.add('is-incoming');
    playback();
    if (mode === 'static') { settle(from, inc, out); return; }
    if (mode === 'reduced') {
      context.add(() => {
        tl = gsap.timeline({ onComplete: () => settle(from, inc, out) }).fromTo(inc.el, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' });
      });
      return;
    }
    const D = cfg.duration;
    const copyOut = panels[from].querySelectorAll('[data-rise]');
    const copyIn = panels[index].querySelectorAll('[data-rise]');
    const proxy = { p: 0 };
    setWipe(inc, 0);
    context.add(() => {
      gsap.set(copyIn, { y: 42, opacity: 0 });
      tl = gsap.timeline({ onComplete: () => settle(from, inc, out) })
        .to(copyOut, { y: -24, opacity: 0, duration: 0.34, ease: 'power2.in', stagger: 0.025 }, 0)
        .set(seam, { opacity: 0.76 }, SEAM_AT)
        // A plain-object tween is not rounded, so clip and seam move by sub-pixels on the same clock.
        .to(proxy, { p: 1, duration: D, ease: 'expo.inOut', onUpdate: () => setWipe(inc, proxy.p) }, SEAM_AT)
        .to(seam, { opacity: 0, duration: 0.2, ease: 'none' }, SEAM_AT + D - 0.12)
        .to(copyIn, { y: 0, opacity: 1, duration: 0.72, ease: 'power3.out', stagger: 0.065 }, SEAM_AT + D * 0.54);
    });
    // The thumbnail: hold the gate a little past half open, with the incoming copy already set.
    if (ctx.capture) {
      tl.pause(SEAM_AT + D * 0.515, false);   // false: run onUpdate, which writes the clip and the seam
      gsap.set(copyIn, { y: 0, opacity: 1 });
    }
  }

  function goTo(to, { instant = false } = {}) {
    to = clamp(to, 0, N - 1);
    if (to === index || waiting) return false;
    tl?.progress(1);                       // a new request settles any running change first
    const out = layers[front], inc = layers[1 - front];
    from = index;
    dir = Math.sign(to - from);
    index = to;
    panels.forEach((p, i) => { p.inert = i !== to; });
    fillTabs();
    (dir > 0 ? tabs[to] : tabs[from]).style.setProperty('--p', dir > 0 ? '0' : '1');
    panels[from].classList.replace('is-active', 'is-leaving');
    panels[to].classList.add('is-active');
    sync();
    live.textContent = `Stage ${to + 1} of ${N}: ${STAGES[to].name}`;
    const ready = load(inc, to);
    if (!ready || instant) { run(from, inc, out, instant); return true; }
    // A missed preload (a jump from the list): wait for a paintable frame, up to the ceiling, then wipe.
    waiting = true;
    ready.then(() => { waiting = false; if (!ctx.signal.aborted) run(from, inc, out, false); });
    return true;
  }

  // Deck: only the active panel is visible and reachable; both buffers start loaded (stage 1 front, 2 behind).
  apply();
  panels.forEach((p, i) => { p.classList.toggle('is-active', i === 0); p.inert = i !== 0; });
  load(layers[0], 0);
  layers[0].el.classList.add('is-front');
  load(layers[1], 1);
  fillTabs();
  media.forEach((m) => { if (m.type === 'image') { const warm = new Image(); warm.src = m.item.src; } });   // warm the cache for jumps
  sync();
  playback();

  // Navigation: the stepped-wheel variant of the section switcher. Locked while a change runs and for the tail.
  const step = (d) => { if (goTo(index + d)) lockUntil = performance.now() + LOCK; };
  const wheel = Observer.create({
    target: window,
    type: 'wheel',
    preventDefault: true,
    onChangeY(self) {
      if (tl || waiting || performance.now() < lockUntil || Math.abs(self.deltaY) < WHEEL_MIN) return;
      step(Math.sign(self.deltaY));
    },
  });
  const swipe = Observer.create({
    target: frame,
    type: 'touch',
    onRelease(self) {
      const dx = self.x - self.startX;
      const dy = self.y - self.startY;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(d) > SWIPE) goTo(index + (d < 0 ? 1 : -1));
    },
  });
  ctx.onCleanup(() => { wheel.kill(); swipe.kill(); });

  on(ctx, window, 'keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const onPage = e.target === document.body || e.target === document.documentElement;   // Space belongs to a focused button
    const map = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 };
    let to = null;
    if (e.key in map) to = index + map[e.key];
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = N - 1;
    else if (e.key === ' ' && onPage) to = index + (e.shiftKey ? -1 : 1);
    if (to === null) return;
    e.preventDefault();
    goTo(to);
  });
  on(ctx, prevBtn, 'click', () => goTo(index - 1));
  on(ctx, nextBtn, 'click', () => goTo(index + 1));
  tabs.forEach((t, i) => on(ctx, t, 'click', () => goTo(i)));

  return {
    update(next, changed) {
      cfg = { ...next };
      tl?.progress(1);
      apply();
      if (changed.includes('direction')) layers.forEach((l) => { l.el.style.clipPath = ''; });
    },
    action(id) {
      if (id === 'next') goTo(index === N - 1 ? 0 : index + 1);
    },
  };
}
