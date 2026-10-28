// Pinned scrub chapter — "How room tuning works" for a speaker. A tall section holds a CSS-sticky stage; one
// ScrollTrigger scrubs a proxy { p } from 0 to 1 (linear, with optional catch-up), and render(p) draws everything:
// the active step (quantised), the microphones, the sound field and the frequency curve flattening.
import './demo.css';
import { on, html, raw, clamp, smoothstep, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const STEPS = [
  { k: 'Listen', t: 'It plays a short chirp', b: 'A two-second sweep from 30 Hz to 18 kHz fills the room, quietly enough to talk over.' },
  { k: 'Measure', t: 'Four microphones hear the room', b: 'Each one times the reflections from the walls, the sofa and the window, and builds a map of where the bass piles up.' },
  { k: 'Shape', t: 'The bass is shaped to the room', b: 'Peaks are pulled down and dips filled in, so a corner placement sounds as even as the middle of the floor.' },
  { k: 'Forget', t: 'Then it stays out of the way', b: 'Eight seconds, once. It re-tunes on its own only when you move it.' },
];
const BEATS = STEPS.length - 1;
const MICS = [[0.5, 0.18], [0.82, 0.5], [0.5, 0.82], [0.18, 0.5]];

function curvePath(flat, t) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const x = i / 48;
    const bumps = Math.sin(x * 9.2 + 0.6) * 0.5 + Math.sin(x * 23 + t) * 0.18 + Math.exp(-((x - 0.18) ** 2) / 0.004) * 0.9;
    pts.push(`${(x * 300).toFixed(1)},${(60 - bumps * (1 - flat) * 34 - (1 - flat) * 4).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

export default function mount(root, options, ctx) {
  const { product } = content;
  let cfg = { ...options };
  root.className = 'ps';
  root.innerHTML = html`
    <header class="ps__intro ac-wrap">
      <p class="ac-label">${product.name} · Room tuning</p>
      <h1 class="ac-display">Sounds right<br>in any corner.</h1>
      <p class="ac-lede">${product.features[0].body}</p>
      <p class="ps__cue ac-label">Scroll to see how</p>
    </header>
    <section class="ps__chapter" aria-labelledby="ps-title">
      <h2 class="sr-only" id="ps-title">How room tuning works</h2>
      <div class="ps__stage ac-wrap">
        <ol class="ps__steps" role="list">
          ${STEPS.map((s, i) => html`<li class="ps__step" data-step="${i}"><span class="ps__k ac-label">${String(i + 1).padStart(2, '0')} · ${s.k}</span><h3 class="ac-h2">${s.t}</h3><p class="ac-body">${s.b}</p></li>`)}
        </ol>
        <figure class="ps__fig" aria-hidden="true">
          <svg class="ps__room" viewBox="0 0 400 400">
            <defs><clipPath id="ps-clip"><rect x="20" y="20" width="360" height="360" rx="18"/></clipPath></defs>
            <rect class="ps__walls" x="20" y="20" width="360" height="360" rx="18"/>
            <rect class="ps__sofa" x="210" y="300" width="130" height="46" rx="12"/>
            <rect class="ps__window" x="120" y="16" width="160" height="8" rx="4"/>
            <g class="ps__waves" clip-path="url(#ps-clip)">${[0, 1, 2, 3, 4].map((i) => raw(`<circle cx="74" cy="74" r="${40 + i * 52}" data-wave="${i}"/>`))}</g>
            <g class="ps__links">${MICS.map(([x, y], i) => raw(`<line x1="74" y1="74" x2="${x * 400}" y2="${y * 400}" data-link="${i}"/>`))}</g>
            <g class="ps__mics">${MICS.map(([x, y], i) => raw(`<g data-mic="${i}" transform="translate(${x * 400} ${y * 400})"><circle r="16" class="ps__mic-halo"/><circle r="6" class="ps__mic"/></g>`))}</g>
            <g class="ps__speaker" transform="translate(74 74)"><rect x="-22" y="-22" width="44" height="44" rx="10"/><circle r="9"/></g>
          </svg>
          <div class="ps__eq">
            <svg viewBox="0 0 300 70" preserveAspectRatio="none"><path class="ps__eq-target" d="M0,60 L300,60"/><path class="ps__eq-line" data-curve/></svg>
            <div class="ps__eq-meta ac-label"><span>30 Hz</span><span data-readout>Response ±9 dB</span><span>18 kHz</span></div>
          </div>
        </figure>
        <div class="ps__rail" aria-hidden="true"><span class="ps__rail-fill" data-rail></span>${STEPS.map((_, i) => raw(`<span class="ps__tick" style="--at:${i / BEATS}" data-tick="${i}"></span>`))}</div>
      </div>
    </section>
    <section class="ps__outro ac-wrap"><p class="ac-h2">Tuned in eight seconds. Then you forget it is there.</p></section>`;

  const steps = [...root.querySelectorAll('[data-step]')];
  const waves = [...root.querySelectorAll('[data-wave]')];
  const mics = [...root.querySelectorAll('[data-mic]')];
  const links = [...root.querySelectorAll('[data-link]')];
  const ticks = [...root.querySelectorAll('[data-tick]')];
  const curve = root.querySelector('[data-curve]');
  const rail = root.querySelector('[data-rail]');
  const readout = root.querySelector('[data-readout]');
  const chapter = root.querySelector('.ps__chapter');
  let active = -1;
  const t0 = performance.now();

  const render = (p) => {
    const beat = clamp(Math.round(p * BEATS), 0, BEATS);
    if (beat !== active) {
      active = beat;
      steps.forEach((s, i) => s.classList.toggle('is-active', i === beat));
      ticks.forEach((s, i) => s.classList.toggle('is-done', i <= beat));
    }
    const seg = (a, b) => smoothstep(clamp((p - a) / (b - a), 0, 1));
    const chirp = seg(0, 0.28);
    const measure = seg(0.22, 0.6);
    const shape = seg(0.55, 0.88);
    const calm = seg(0.85, 1);
    waves.forEach((w, i) => {
      const reach = clamp(chirp * 5 - i, 0, 1);
      w.style.opacity = (reach * (1 - calm * 0.75) * (0.55 - i * 0.07)).toFixed(3);
      w.style.transform = `scale(${(0.7 + reach * 0.3).toFixed(3)})`;
    });
    mics.forEach((m, i) => m.classList.toggle('is-on', measure > (i + 0.5) / 4.5));
    links.forEach((l, i) => { l.style.strokeDashoffset = String((1 - clamp(measure * 4.5 - i, 0, 1)) * 400); l.style.opacity = String(1 - calm * 0.7); });
    curve.setAttribute('d', curvePath(shape, (performance.now() - t0) / 1600));
    readout.textContent = `Response ±${(9 - shape * 7.5).toFixed(1)} dB`;
    rail.style.transform = `scaleY(${p.toFixed(4)})`;
  };

  const apply = () => {
    root.style.setProperty('--length', `${cfg.length}vh`);
    root.dataset.side = cfg.side;
    root.classList.toggle('ps--no-rail', !cfg.rail);
  };
  apply();

  if (ctx.motion !== 'full') {
    root.classList.add('ps--still');
    render(1);
    steps.forEach((s) => s.classList.add('is-active'));
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  useLenis(ctx);
  const state = { p: 0 };
  let trigger = null;
  const { gsap, ScrollTrigger } = useGsap(ctx, root);
  const build = () => {
    trigger?.kill();
    gsap.killTweensOf(state);
    const tween = gsap.to(state, {
      p: 1,
      ease: 'none',
      onUpdate: () => render(state.p),
      scrollTrigger: {
        trigger: chapter,
        start: 'top top',
        end: 'bottom bottom',
        scrub: cfg.smooth > 0 ? cfg.smooth : true,
        snap: cfg.snap ? { snapTo: 1 / BEATS, duration: { min: 0.2, max: 0.6 }, ease: 'power2.inOut', delay: 0.08 } : false,
        invalidateOnRefresh: true,
      },
    });
    trigger = tween.scrollTrigger;
    ctx.onCleanup(() => { tween.scrollTrigger?.kill(); tween.kill(); });
  };
  build();
  render(0);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  on(ctx, window, 'load', () => ScrollTrigger.refresh());

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('length')) ScrollTrigger.refresh();
      if (changed.includes('smooth') || changed.includes('snap')) build();
    },
  };
}
