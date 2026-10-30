// Rotating word — Halden's studio headline alone on the stage: "We design [houses] for long winters." Every word sits
// in one inline-grid cell, so the slot is as wide as its widest word and the line never reflows. Three drivers: a
// reel (the next word in from below, the current out the top on one tween), typed and erased per character, or
// stepped by the first wheel inputs at the top of the page. Paused off-screen. Reduced: the first word, still, with
// the list shown beneath.
import './demo.css';
import { on, whileVisible, html, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const ROLLS = {
  overshoot: { off: 130, duration: 0.56, ease: 'back.out(1.7)' },
  stiff: { off: 118, duration: 0.75, ease: 'power4.inOut' },
};
const WHEEL_MIN = 18;
const WHEEL_LOCK = 760;
const parse = (s) => {
  const list = String(s).split(',').map((w) => w.trim()).filter(Boolean).slice(0, 6);
  return list.length ? list : ['houses'];
};

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  root.className = 'rw';
  root.innerHTML = html`
    <section class="ac-stage rw__hero" aria-labelledby="rw-title">
      <h1 class="rw__title" id="rw-title">We design <span class="rw__slot" aria-hidden="true" data-slot></span><span class="sr-only" aria-live="off" data-label></span> <span class="rw__tail">for long winters.</span></h1>
      <ol class="rw__steps ac-label" role="list" aria-hidden="true" data-steps></ol>
      <p class="ac-stage__note"><span>${studio.name} · studio hero</span></p>
    </section>`;

  const slot = root.querySelector('[data-slot]');
  const label = root.querySelector('[data-label]');
  const steps = root.querySelector('[data-steps]');
  const { gsap } = useGsap(ctx, root);
  const full = ctx.motion === 'full';
  let words = [];
  let typeLayer = null;
  let texts = [];
  let idx = 0;
  let loop = null;
  let onScreen = true;
  let lockUntil = 0;
  // The loop runs for as long as the hero is up, so its tweens live outside the context and are killed here.
  ctx.onCleanup(() => { loop?.kill(); gsap.killTweensOf(words); });

  // The slot: every word in the same grid cell (its width is the widest word's), plus a layer for typing.
  const build = () => {
    texts = parse(cfg.words);
    slot.innerHTML = html`${texts.map((t) => html`<span class="rw__word">${t}</span>`)}<span class="rw__type" data-type></span>`;
    words = [...slot.querySelectorAll('.rw__word')];
    typeLayer = slot.querySelector('[data-type]');
    steps.innerHTML = html`${texts.map((t) => html`<li>${t}</li>`)}`;
  };

  // The label is the accessible word: updated once per change, never announced.
  const show = (i) => {
    idx = i;
    label.textContent = texts[i];
    [...steps.children].forEach((li, n) => li.classList.toggle('is-on', n === i));
  };
  const own = (t) => { loop = t; if (!onScreen) t.pause(); return t; };

  // One reel: the next word up from below and the current one out the top on the same ease, as neighbours.
  const roll = (to, dir = 1) => {
    if (to === idx) return;
    const r = ROLLS[cfg.ease];
    gsap.fromTo(words[to], { yPercent: r.off * dir }, { yPercent: 0, duration: r.duration, ease: r.ease, overwrite: true });
    gsap.fromTo(words[idx], { yPercent: 0 }, { yPercent: -r.off * dir, duration: r.duration, ease: r.ease, overwrite: true });
    show(to);
  };
  const reel = () => {
    const r = ROLLS[cfg.ease];
    own(gsap.delayedCall(r.duration + cfg.rest, () => { roll((idx + 1) % texts.length); reel(); }));
  };

  // The first paint is already a whole word: hold it, erase it, pause, type the next.
  const typed = () => {
    const next = (idx + 1) % texts.length;
    const out = texts[idx];
    const into = texts[next];
    const put = (s) => { typeLayer.textContent = s; };
    const type = cfg.speed / 1000;
    const tl = gsap.timeline({ onComplete: () => { show(next); typed(); } });
    let t = cfg.hold;
    for (let i = out.length - 1; i >= 0; i--) tl.call(put, [out.slice(0, i)], (t += type / 2));
    t += 0.4;
    for (let i = 1; i <= into.length; i++) tl.call(put, [into.slice(0, i)], (t += type));
    own(tl);
  };

  const start = () => {
    loop?.kill();
    loop = null;
    gsap.killTweensOf(words);
    gsap.set([...words, typeLayer], { clearProps: 'all' });
    typeLayer.textContent = '';
    show(0);
    slot.dataset.mode = full ? cfg.mode : 'still';
    root.classList.toggle('rw--list', !full);
    if (!full) return;
    if (cfg.mode === 'typed') {
      gsap.set(words, { visibility: 'hidden' });
      gsap.set(typeLayer, { visibility: 'visible' });
      typeLayer.textContent = texts[0];
      typed();
      return;
    }
    gsap.set(words, { yPercent: (i) => (i ? ROLLS[cfg.ease].off : 0), visibility: 'visible' });
    if (cfg.mode === 'reel') reel();
  };

  // Wheel-stepped: at the top of the page the first wheel inputs step the word instead of scrolling. Past the last
  // word (or back before the first) the wheel is left alone and the page scrolls.
  on(ctx, window, 'wheel', (e) => {
    if (slot.dataset.mode !== 'wheel' || window.scrollY > 0) return;
    if (performance.now() < lockUntil) { e.preventDefault(); return; } // swallow trackpad inertia after a step
    const dir = Math.sign(e.deltaY);
    const to = idx + dir;
    if (!dir || to < 0 || to >= texts.length) return;
    e.preventDefault();
    if (Math.abs(e.deltaY) < WHEEL_MIN) return;
    lockUntil = performance.now() + WHEEL_LOCK;
    roll(to, dir);
  }, { passive: false });

  whileVisible(ctx, slot, () => { onScreen = true; loop?.resume(); }, () => { onScreen = false; loop?.pause(); }, { rootMargin: '0px' });

  build();
  show(0);
  document.fonts.ready.then(() => {
    if (ctx.signal.aborted) return;
    start();
    // The thumbnail: the reel caught as the next word rises into the slot.
    if (ctx.capture && cfg.mode === 'reel') {
      loop?.kill();
      gsap.set(words[0], { yPercent: -108 });
      gsap.set(words[1], { yPercent: 22 });
      show(1);
    }
  });

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('words')) build();
      if (changed.some((k) => ['words', 'mode', 'ease'].includes(k))) start();
    },
  };
}
