// Scroll theme swap — a festival programme in three chapters (Day, Dusk, Night), each its name and three sets. Each
// section names a palette; crossing its midpoint (top 50 % → bottom 50 %, enter and enter back) tweens --bg, --ink
// and --accent on <html> through one live object: the running tween is killed and the next starts from wherever the
// colour is (retarget, never stack). The same onUpdate repaints a canvas sky (ground, glow, a sun that sets) and, on
// complete, meta theme-color. Palettes are mixed from the library's tokens and materials, so they hold in light and
// dark. Scrub mode blends across each boundary instead. Reduced motion: the swap is instant but still happens,
// because it carries wayfinding.
import './demo.css';
import { on, observeResize, readToken, html, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const TOKENS = ['--bg', '--ink', '--accent'];
// A colour is a token, or [token, share, token]: the first token mixed into the second at that share.
const PALETTES = {
  festival: {
    day: { bg: ['sand', 0.4, 'bg'], ink: 'ink', accent: 'accent', sun: ['accent', 0.55, 'sand'], sunY: 0.24, sunR: 0.1, glow: 0.32 },
    dusk: { bg: 'clay', ink: 'night', accent: ['plum', 0.8, 'night'], sun: ['accent', 0.75, 'sand'], sunY: 0.66, sunR: 0.17, glow: 0.5 },
    night: { bg: 'night', ink: 'sand', accent: 'accent', sun: ['sand', 0.85, 'night'], sunY: 0.2, sunR: 0.045, glow: 0.14 },
  },
  harbour: {
    day: { bg: ['sky', 0.32, 'bg'], ink: 'ink', accent: 'accent', sun: ['sand', 0.8, 'surface'], sunY: 0.24, sunR: 0.1, glow: 0.4 },
    dusk: { bg: ['plum', 0.55, 'night'], ink: 'sand', accent: 'clay', sun: ['clay', 0.85, 'sand'], sunY: 0.66, sunR: 0.17, glow: 0.45 },
    night: { bg: 'night', ink: 'sky', accent: 'sky', sun: ['sky', 0.7, 'night'], sunY: 0.2, sunR: 0.045, glow: 0.16 },
  },
  mono: {
    day: { bg: 'bg', ink: 'ink', accent: 'accent', sun: ['ink', 0.1, 'bg'], sunY: 0.24, sunR: 0.1, glow: 0.2 },
    dusk: { bg: ['ink', 0.1, 'bg'], ink: 'ink', accent: 'accent', sun: ['ink', 0.22, 'bg'], sunY: 0.66, sunR: 0.17, glow: 0.25 },
    night: { bg: 'ink', ink: 'bg', accent: 'accent', sun: ['bg', 0.8, 'ink'], sunY: 0.2, sunR: 0.045, glow: 0.12 },
  },
};
const NAMES = { day: 'Day', dusk: 'Dusk', night: 'Night' };

const parse = (c) => {
  const s = String(c).trim();
  if (s[0] === '#') {
    const h = s.length === 4 ? s.slice(1).split('').map((x) => x + x).join('') : s.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const m = s.match(/[\d.]+/g) || [0, 0, 0];
  return m.slice(0, 3).map(Number);
};
const mixRGB = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, alpha = 1) => `rgb(${c.map((v) => Math.round(v)).join(' ')}${alpha < 1 ? ` / ${alpha.toFixed(3)}` : ''})`;
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  const CHAPTERS = [
    { id: 'day', acts: [['12:00', 'Moss Theory', 'Harbour'], ['13:30', 'Hana Ekström', 'Harbour'], ['16:45', 'Kiri Tanaka', 'Harbour']] },
    { id: 'dusk', acts: [['18:30', 'Odessa Rae', 'Hall 4'], ['19:45', 'The Low Tides', 'The Crane'], ['21:00', 'Nils & the Weather', 'Hall 4']] },
    { id: 'night', acts: [['22:15', 'Marlow Ash', 'Harbour'], ['23:45', 'Black Pine', 'Greenhouse'], ['01:30', 'Vesper Choir', 'Greenhouse']] },
  ];

  root.className = 'st';
  root.innerHTML = html`
    <canvas class="st__sky" aria-hidden="true" data-sky></canvas>
    <main>
      <h1 class="sr-only">${festival.name} programme</h1>
      ${CHAPTERS.map((c) => html`
        <section class="st__chapter ac-wrap" data-swap="${c.id}" aria-labelledby="st-${c.id}-t">
          <h2 class="st__word" id="st-${c.id}-t">${NAMES[c.id]}</h2>
          <ol class="st__acts" role="list">${c.acts.map(([t, who, where]) => html`<li><time>${t}</time><strong>${who}</strong><span>${where}</span></li>`)}</ol>
        </section>`)}
    </main>`;

  const $ = (s) => root.querySelector(s);
  const docEl = document.documentElement;
  const canvas = $('[data-sky]');
  const g = canvas.getContext('2d');
  const sections = [...root.querySelectorAll('[data-swap]')];
  const full = ctx.motion === 'full';
  useLenis(ctx);
  const { gsap, ScrollTrigger } = useGsap(ctx, root);

  // theme-color follows the chapter; put the page's own back on unmount.
  let meta = document.querySelector('meta[name="theme-color"]');
  const created = !meta;
  const before = meta?.getAttribute('content');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
  ctx.onCleanup(() => {
    TOKENS.forEach((t) => docEl.style.removeProperty(t));
    if (created) meta.remove(); else meta.setAttribute('content', before);
  });

  // 1. Resolve the palettes from the theme's tokens. The live tokens sit inline on <html>, so lift them for the read.
  let palettes = {};
  const resolve = () => {
    const saved = TOKENS.map((t) => docEl.style.getPropertyValue(t));
    TOKENS.forEach((t) => docEl.style.removeProperty(t));
    const tok = (name) => parse(readToken(`--${name}`));
    const colourOf = (spec) => (Array.isArray(spec) ? mixRGB(tok(spec[2]), tok(spec[0]), spec[1]) : tok(spec));
    palettes = Object.fromEntries(Object.entries(PALETTES[cfg.palette]).map(([k, p]) => [k, {
      bg: colourOf(p.bg), ink: colourOf(p.ink), accent: colourOf(p.accent), sun: colourOf(p.sun), sunY: p.sunY, sunR: p.sunR, glow: p.glow,
    }]));
    TOKENS.forEach((t, i) => { if (saved[i]) docEl.style.setProperty(t, saved[i]); });
  };

  // 2. One live object; the DOM tokens and the canvas both read it.
  const live = { bg: [0, 0, 0], ink: [0, 0, 0], accent: [0, 0, 0], sun: [0, 0, 0], sunY: 0.24, sunR: 0.1, glow: 0.3 };
  const blendInto = (a, b, t) => {
    for (const k of ['bg', 'ink', 'accent', 'sun']) live[k] = mixRGB(a[k], b[k], t);
    for (const k of ['sunY', 'sunR', 'glow']) live[k] = a[k] + (b[k] - a[k]) * t;
  };
  const size = { w: 1, h: 1, dpr: 1 };
  const paint = () => {
    docEl.style.setProperty('--bg', css(live.bg));
    docEl.style.setProperty('--ink', css(live.ink));
    docEl.style.setProperty('--accent', css(live.accent));
    if (!cfg.sky) return;
    const { w, h } = size;
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.fillStyle = css(live.bg);
    g.fillRect(0, 0, w, h);
    const narrow = w < 760;
    const sx = w * (narrow ? 0.82 : 0.6);
    const sy = h * (narrow ? Math.min(live.sunY, 0.3) * 0.8 + 0.06 : live.sunY);
    const r = Math.min(w, h) * live.sunR * (narrow ? 0.7 : 1);
    const glow = g.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 7);
    glow.addColorStop(0, css(live.sun, live.glow));
    glow.addColorStop(1, css(live.sun, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.fillStyle = css(live.sun);
    g.beginPath();
    g.arc(sx, sy, r, 0, Math.PI * 2);
    g.fill();
  };
  const settleMeta = () => meta.setAttribute('content', hex(live.bg));
  observeResize(ctx, docEl, () => {
    size.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    size.w = innerWidth; size.h = innerHeight;
    canvas.width = Math.round(size.w * size.dpr);
    canvas.height = Math.round(size.h * size.dpr);
    paint();
  });

  // 3. Triggered: one tween at a time, killed and retargeted from the current colour.
  let current = 'day';
  const proxy = { t: 1 };
  let tween = null;
  let triggers = [];
  ctx.onCleanup(() => { tween?.kill(); triggers.forEach((t) => t.kill()); });
  const mark = (name) => {
    current = name;
    root.dataset.chapter = name;
  };
  const setTheme = (name, { force = false } = {}) => {
    if (name === current && !force) return;
    mark(name);
    const from = { ...live, bg: [...live.bg], ink: [...live.ink], accent: [...live.accent], sun: [...live.sun] };
    const to = palettes[name];
    tween?.kill();
    const duration = full ? cfg.duration : 0;
    proxy.t = 0;
    tween = gsap.to(proxy, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => { blendInto(from, to, proxy.t); paint(); },
      onComplete: settleMeta,
    });
  };

  // 4. The chapter triggers: midpoint swaps, or, in scrub mode, blends across each boundary.
  const build = () => {
    triggers.forEach((t) => t.kill());
    triggers = [];
    const scrub = cfg.mode === 'scrub' && full;
    sections.forEach((sec, i) => {
      const name = sec.dataset.swap;
      triggers.push(ScrollTrigger.create({
        trigger: sec,
        start: 'top 50%',
        end: 'bottom 50%',
        onEnter: () => (scrub ? mark(name) : setTheme(name)),
        onEnterBack: () => (scrub ? mark(name) : setTheme(name)),
      }));
      const prev = sections[i - 1]?.dataset.swap;
      if (scrub && prev && prev !== name) {
        triggers.push(ScrollTrigger.create({
          trigger: sec,
          start: 'top 80%',
          end: 'top 20%',
          onUpdate: (self) => { tween?.kill(); blendInto(palettes[prev], palettes[name], self.progress); paint(); },
          onLeave: settleMeta,
          onLeaveBack: settleMeta,
        }));
      }
    });
  };

  // Start on the chapter under the viewport's middle, set at once.
  const chapterAtMiddle = () => {
    const mid = innerHeight / 2;
    const hit = sections.find((s) => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
    return hit?.dataset.swap || 'day';
  };
  const snapTo = (name) => { tween?.kill(); mark(name); blendInto(palettes[name], palettes[name], 1); paint(); settleMeta(); };

  const apply = () => {
    canvas.hidden = !cfg.sky;
    root.classList.toggle('st--sky', cfg.sky);
  };
  resolve();
  apply();
  snapTo('day');
  build();
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  on(ctx, window, 'load', () => ScrollTrigger.refresh(), { once: true });

  ctx.onTheme(() => { resolve(); snapTo(chapterAtMiddle()); });

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('palette')) { resolve(); setTheme(current, { force: true }); }
      if (changed.includes('mode')) { build(); ScrollTrigger.refresh(); snapTo(chapterAtMiddle()); }
      if (changed.includes('sky')) paint();
    },
  };
}
