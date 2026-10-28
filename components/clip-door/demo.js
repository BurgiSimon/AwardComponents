// Clip-path door — an architecture studio's case study you walk into. A 200 svh section holds a sticky stage: the
// project underneath (full-bleed picture, real heading) is covered by a veil in the page's ground, cut by one
// even-odd path — the frame, then a rounded hole. GSAP scrubs a plain { p } proxy and onUpdate writes the path, so
// the hole is a function, never two shapes to interpolate. The project's name parts ±50 vw on the veil as it opens.
// Further down a statement rises through circle(p × 150 % at 50 % 120 %). Reduced motion: no clip anywhere.
import './demo.css';
import { on, html, raw, clamp, photos, imageHTML, content, observeResize } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const CIRCLE_MAX = 150; // % — centre at 50 % 120 %, so 150 % clears the top corners
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
  const { studio, people } = content;
  const project = studio.projects.find((p) => p.slug === 'tern-library');
  const next = studio.projects.find((p) => p.slug === 'stillwater');
  const [room, nextShot] = [photos({ tags: ['architecture'], count: 1, seed: 'cd-tern' })[0], photos({ tags: ['water'], count: 1, seed: 'cd-next' })[0]];
  let cfg = { ...options };

  root.className = 'cd';
  root.innerHTML = html`
    <header class="cd__bar ac-bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n, i) => html`<a href="#top" ${i === 0 ? raw('aria-current="page"') : ''}>${n}</a>`)}</nav>
    </header>

    <section class="cd__door" data-door aria-labelledby="cd-title">
      <div class="cd__stage" data-stage>
        <div class="cd__room">
          <span class="cd__photo">${raw(imageHTML(room, { sizes: '100vw', eager: true, alt: `${project.title}: the reading room and its long window` }))}</span>
          <div class="cd__room-copy">
            <p class="ac-label">${project.discipline} · ${project.place} · ${project.year}</p>
            <h2 class="cd__title" id="cd-title">${project.title}</h2>
            <div class="cd__room-foot">
              <p class="cd__summary">${project.summary} ${project.size}, opened to the public in spring.</p>
              <a class="cd__cta" href="#cd-brief">Read the project <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg></a>
            </div>
          </div>
        </div>
        <div class="cd__veil" data-veil aria-hidden="true">
          <span class="cd__word" data-word="l"></span>
          <span class="cd__word" data-word="r"></span>
        </div>
        <div class="cd__over" data-over>
          <h1 class="ac-label cd__kicker">Selected work <span>02 / 08</span></h1>
          <p class="ac-label cd__cue" aria-hidden="true"><span>${project.place}</span><span>Scroll to enter</span></p>
        </div>
      </div>
    </section>

    <section class="cd__brief ac-wrap" id="cd-brief" aria-label="The brief">
      <p class="ac-label">The brief</p>
      <p class="cd__lead">A city library that most people would visit in the dark. We gave it one window, seventy-four metres long, set at the height of a seated reader’s eyes, and let everything else be quiet.</p>
      <dl class="cd__facts">
        <div><dt class="ac-label">Client</dt><dd>Tromsø kommune</dd></div>
        <div><dt class="ac-label">Area</dt><dd>${project.size}</dd></div>
        <div><dt class="ac-label">Completed</dt><dd>March ${project.year}</dd></div>
        <div><dt class="ac-label">Team</dt><dd>${people[0].name}, ${people[1].name}</dd></div>
      </dl>
    </section>

    <section class="cd__close ac-wrap" aria-label="Statement">
      <div class="cd__slot">
      <figure class="cd__statement" data-circle>
        <blockquote><p>A library needs one good window, not twenty.</p></blockquote>
        <figcaption class="ac-label">${people[0].name} — ${people[0].role}</figcaption>
      </figure>
      </div>
    </section>

    <footer class="cd__next ac-wrap">
      <a href="#top" class="cd__next-link">
        <span class="ac-label">Next project</span>
        <span class="cd__next-title">${next.title}</span>
        <span class="cd__next-shot ac-media">${raw(imageHTML(nextShot, { sizes: '220px', alt: '' }))}</span>
      </a>
    </footer>`;

  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const door = root.querySelector('[data-door]');
  const stage = root.querySelector('[data-stage]');
  const veil = root.querySelector('[data-veil]');
  const over = root.querySelector('[data-over]');
  const words = [...root.querySelectorAll('[data-word]')];
  const circle = root.querySelector('[data-circle]');

  const apply = () => {
    const [l, r] = splitWords(cfg.labels);
    words[0].textContent = l;
    words[1].textContent = r;
    root.style.setProperty('--hole', cfg.hole);
  };
  apply();

  const lenis = useLenis(ctx);
  on(ctx, root.querySelector('.cd__cta'), 'click', (e) => {
    e.preventDefault();
    const target = root.querySelector('#cd-brief');
    const y = target.getBoundingClientRect().top + scrollY - 40;
    if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else scrollTo({ top: y });
  });

  if (ctx.motion !== 'full') {
    root.classList.add('cd--open');
    return { update(next) { cfg = { ...next }; apply(); } };
  }
  root.classList.add('cd--closed');

  // Stage size in px for path(); the hole at p = 0 is hole % of the width × 1.2 hole % of the height (desktop).
  // On a portrait stage the words stack above and below, so the hole is wider: 2.2 × hole % of the width.
  const size = { W: 1, H: 1, portrait: false };
  const d = { p: 0 };
  const c = { p: 0 };
  const paintDoor = () => {
    const { W, H, portrait } = size;
    const w0 = W * clamp((cfg.hole * (portrait ? 2.2 : 1)) / 100, 0.08, 0.92);
    const h0 = H * ((cfg.hole * 1.2) / 100);
    const w = w0 + (W - w0) * d.p;
    const h = h0 + (H - h0) * d.p;
    veil.style.clipPath = doorPath(W, H, w, h, cfg.radius * (1 - d.p));
    veil.style.visibility = d.p > 0.999 ? 'hidden' : '';
    over.style.opacity = String(clamp(1 - (d.p - 0.42) / 0.16, 0, 1)); // gone before the hole reaches it
  };
  const paintCircle = () => {
    circle.style.clipPath = cfg.circle ? `circle(${r2(c.p * CIRCLE_MAX)}% at 50% 120%)` : '';
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
    mm.add({ phone: '(max-width: 767px)', desk: '(min-width: 768px)' }, (m) => {
      const { phone } = m.conditions;
      // The door: one scrubbed timeline — the proxy writes the path, the words part (sideways, or up and down
      // when the stage is portrait and they stack).
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: door, start: 'top top', end: 'bottom bottom', scrub, invalidateOnRefresh: true },
      }).to(d, { p: 1, duration: 1, onUpdate: paintDoor }, 0);
      if (size.portrait) tl.to(words[0], { y: '-50svh', duration: 1 }, 0).to(words[1], { y: '50svh', duration: 1 }, 0);
      else tl.to(words[0], { x: '-50vw', duration: 1 }, 0).to(words[1], { x: '50vw', duration: 1 }, 0);

      // The statement: the phone gets a longer, later window — the box is narrow, so the arc needs more scroll.
      gsap.to(c, {
        p: 1,
        ease: 'none',
        onUpdate: paintCircle,
        scrollTrigger: { trigger: circle, start: phone ? 'top 95%' : 'top 70%', end: phone ? 'bottom 90%' : 'center center', scrub, invalidateOnRefresh: true },
      });
      paintDoor();
      paintCircle();
      return () => { d.p = 0; c.p = 0; gsap.set(words, { clearProps: 'transform' }); };
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
      paintCircle();
      return undefined;
    },
  };
}
