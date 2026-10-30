// Clip-path door — a case study you walk into, cut to the door and the project's name. A 200 svh section holds a
// sticky stage: the project underneath (full-bleed picture, real heading) is covered by a veil in the page's ground,
// cut by one even-odd path — the frame, then a rounded hole. GSAP scrubs a plain { p } proxy and onUpdate writes the
// path, so the hole is a function, never two shapes to interpolate. The project's name parts ±50 vw on the veil as
// it opens. Reduced motion: no clip anywhere.
import './demo.css';
import { on, html, raw, clamp, photos, imageHTML, content, observeResize } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const r2 = (v) => Math.round(v * 100) / 100;

// The frame, then the hole: with evenodd the inner ring is subtracted. The hole is a rounded rect whose radius eases
// to zero as it reaches the edges, so the veil paints nothing at p = 1.
function doorPath(W, H, w, h, radius) {
  const L = r2((W - w) / 2), T = r2((H - h) / 2), R = r2(L + w), B = r2(T + h);
  const r = r2(Math.min(radius, w / 2, h / 2));
  const hole = r > 0
    ? `M${L + r} ${T}H${R - r}A${r} ${r} 0 0 1 ${R} ${T + r}V${B - r}A${r} ${r} 0 0 1 ${R - r} ${B}H${L + r}A${r} ${r} 0 0 1 ${L} ${B - r}V${T + r}A${r} ${r} 0 0 1 ${L + r} ${T}Z`
    : `M${L} ${T}H${R}V${B}H${L}Z`;
  return `path(evenodd, 'M0 0H${W}V${H}H0Z${hole}')`;
}

function splitWords(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] || '', ''];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
}

export default function mount(root, options, ctx) {
  const { studio } = content;
  const project = studio.projects.find((p) => p.slug === 'tern-library');
  const [room] = photos({ tags: ['architecture'], count: 1, seed: 'cd-tern' });
  let cfg = { ...options };

  root.className = 'cd';
  root.innerHTML = html`
    <section class="cd__door" data-door aria-labelledby="cd-title">
      <div class="cd__stage" data-stage>
        <div class="cd__room">
          <span class="cd__photo">${raw(imageHTML(room, { sizes: '100vw', eager: true, alt: `${project.title}: the reading room and its long window` }))}</span>
          <h1 class="cd__title" id="cd-title">${project.title}</h1>
        </div>
        <div class="cd__veil" data-veil aria-hidden="true">
          <span class="cd__word" data-word="l"></span>
          <span class="cd__word" data-word="r"></span>
        </div>
      </div>
    </section>`;

  const door = root.querySelector('[data-door]');
  const stage = root.querySelector('[data-stage]');
  const veil = root.querySelector('[data-veil]');
  const words = [...root.querySelectorAll('[data-word]')];

  const apply = () => {
    const [l, r] = splitWords(cfg.labels);
    words[0].textContent = l;
    words[1].textContent = r;
    root.style.setProperty('--hole', cfg.hole);
  };
  apply();

  useLenis(ctx);

  if (ctx.motion !== 'full') {
    root.classList.add('cd--open');
    return { update(next) { cfg = { ...next }; apply(); } };
  }
  root.classList.add('cd--closed');

  // Stage size in px for path(); the hole at p = 0 is hole % of the width × 1.2 hole % of the height (desktop).
  // On a portrait stage the words stack above and below, so the hole is wider: 2.2 × hole % of the width.
  const size = { W: 1, H: 1, portrait: false };
  const d = { p: 0 };
  const paintDoor = () => {
    const { W, H, portrait } = size;
    const w0 = W * clamp((cfg.hole * (portrait ? 2.2 : 1)) / 100, 0.08, 0.92);
    const h0 = H * ((cfg.hole * 1.2) / 100);
    const w = w0 + (W - w0) * d.p;
    const h = h0 + (H - h0) * d.p;
    veil.style.clipPath = doorPath(W, H, w, h, cfg.radius * (1 - d.p));
    veil.style.visibility = d.p > 0.999 ? 'hidden' : '';
  };
  const measure = () => {
    size.W = stage.clientWidth || 1;
    size.H = stage.clientHeight || 1;
    size.portrait = size.W < size.H;
    root.classList.toggle('cd--portrait', size.portrait);
    paintDoor();
  };
  measure();
  observeResize(ctx, stage, measure);

  const { gsap, ScrollTrigger } = useGsap(ctx, root);
  let mm = null;
  const build = () => {
    mm?.revert();
    mm = gsap.matchMedia();
    const scrub = cfg.scrub > 0 ? cfg.scrub : true;
    mm.add({ phone: '(max-width: 767px)', desk: '(min-width: 768px)' }, () => {
      // The door: one scrubbed timeline — the proxy writes the path, the words part (sideways, or up and down
      // when the stage is portrait and they stack).
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: door, start: 'top top', end: 'bottom bottom', scrub, invalidateOnRefresh: true },
      }).to(d, { p: 1, duration: 1, onUpdate: paintDoor }, 0);
      if (size.portrait) tl.to(words[0], { y: '-50svh', duration: 1 }, 0).to(words[1], { y: '50svh', duration: 1 }, 0);
      else tl.to(words[0], { x: '-50vw', duration: 1 }, 0).to(words[1], { x: '50vw', duration: 1 }, 0);
      paintDoor();
      return () => { d.p = 0; gsap.set(words, { clearProps: 'transform' }); };
    });
  };
  build();
  ctx.onCleanup(() => mm?.revert());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  on(ctx, window, 'load', () => ScrollTrigger.refresh());

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('scrub')) build();
      paintDoor();
      return undefined;
    },
  };
}
