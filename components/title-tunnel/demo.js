// Title tunnel — a studio's "Work" capsule and the projects inside it, alone on the stage. A scrubbed timeline grows
// the capsule as cover^k (k linear 0 → 1) until its straight part covers the stage, while the viewport-sized scene
// inside is counter-scaled by 1/s so the projects stay 1:1 behind the growing doorway. The title is not
// counter-scaled, so it grows past you and fades. The projects wait at translate3d(x, y, −i × gap) under a 900 px
// perspective, and only the list moves in z. Reduced motion: the heading and a flat grid, no 3D, no scrub.
import './demo.css';
import { on, html, raw, photo, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const SPOTS = [[-1, -0.35], [1, 0.3], [-0.9, 0.42], [0.95, -0.4], [-1, -0.15], [0.9, 0.38], [-0.85, 0.3]];
const FRONT = -300; // the z at which a project reads as "in front" (0.75× under a 900 px perspective)
const ZOOM = 1; // timeline seconds for the doorway to cover the stage
const TRAVEL_AT = 0.8; // the flight starts just before the doorway has covered the stage
const TRAVEL = 2.4; // timeline seconds for the flight
const CURVES = {
  exp: (cover, k) => cover ** k,
  linear: (cover, k) => 1 + (cover - 1) * k,
  in: (cover, k) => 1 + (cover - 1) * k ** 4,
};

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const count = Math.max(2, Math.min(studio.projects.length, Math.round(cfg.count)));
  const projects = studio.projects.slice(0, count);
  // Picked in order, each excluding the pictures before it, so no two projects share one. The city block is pinned to
  // the snowy Helsinki roofs: the other city pictures show the Eiffel Tower and Manhattan.
  const used = [];
  const shots = projects.map((p, i) => {
    const [s] = p.slug === 'granite-court'
      ? [photo('city-helsinki-rooftops')]
      : photos({ tags: p.tags, not: ['city'], exclude: used, count: 1, seed: `tt-${p.slug}-${i}` });
    used.push(s.id);
    return s;
  });
  // The last project ends the flight at z 0, so it sits in the middle of the frame.
  const spot = (i) => (i === count - 1 ? [0, 0] : SPOTS[i % SPOTS.length]);

  root.className = 'tt';
  root.innerHTML = html`
    <section class="tt__tunnel" data-tunnel data-mode="flat" aria-labelledby="tt-work">
      <div class="tt__stage" data-stage>
        <div class="tt__mask" data-mask>
          <h2 class="tt__title" id="tt-work" data-title>Work</h2>
          <div class="tt__inner" data-inner>
            <ol class="tt__scene" data-scene role="list">
              ${projects.map((p, i) => html`
                <li style="--i:${i + 1}; --x:${spot(i)[0]}; --y:${spot(i)[1]}">
                  <a href="#top" class="tt__link">
                    <span class="ac-media tt__media">${raw(imageHTML(shots[i], { sizes: '(max-width: 640px) 46vw, 22vw', eager: true, alt: '' }))}</span>
                    <span class="tt__name">${p.title}</span>
                  </a>
                </li>`)}
            </ol>
          </div>
        </div>
        <p class="ac-stage__note tt__note"><span>${studio.name} · work section</span></p>
      </div>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const section = root.querySelector('[data-tunnel]');
  const stage = root.querySelector('[data-stage]');
  const mask = root.querySelector('[data-mask]');
  const inner = root.querySelector('[data-inner]');
  const scene = root.querySelector('[data-scene]');
  const title = root.querySelector('[data-title]');
  const items = [...scene.children];

  if (ctx.motion !== 'full') {
    return { update(next, changed) { cfg = { ...next }; return changed.includes('count') ? false : undefined; } };
  }

  // Deep mode first: the section grows to 500 svh, and Lenis should measure the page at its real height.
  section.dataset.mode = 'deep';
  const lenis = useLenis(ctx);
  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  // Smallest scale at which the capsule's straight part covers the stage: (W − H)·s ≥ stage width, H·s ≥ stage
  // height. offsetWidth/Height ignore transforms, so this is safe at any point of the scrub.
  const coverScale = () => 1.02 * Math.max(stage.clientWidth / Math.max(1, mask.offsetWidth - mask.offsetHeight), stage.clientHeight / mask.offsetHeight);

  let tl = null;
  const build = () => {
    if (tl) { tl.scrollTrigger?.kill(); tl.kill(); }
    gsap.set([mask, inner, scene, title], { clearProps: 'transform,opacity' });
    scene.style.setProperty('--gap', `${cfg.gap}px`);
    const depth = count * cfg.gap; // the flight ends with the last project at z 0
    let cover = coverScale();
    const zoom = { k: 0 };
    const applyZoom = () => {
      const s = (CURVES[cfg.curve] || CURVES.exp)(cover, zoom.k);
      gsap.set(mask, { scale: s });
      gsap.set(inner, { scale: 1 / s });
    };
    context.add(() => {
      tl = gsap.timeline({
        defaults: { ease: 'none' }, // scrubbed timelines are linear; the curve lives in the mapping
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: cfg.scrub > 0 ? cfg.scrub : true,
          invalidateOnRefresh: true,
          onRefresh: () => { cover = coverScale(); applyZoom(); },
        },
      });
      tl.to(zoom, { k: 1, duration: ZOOM, onUpdate: applyZoom }, 0)
        .to(title, { opacity: 0, duration: 0.5 }, 0.35)
        .fromTo(scene, { z: 0 }, { z: depth, duration: TRAVEL }, TRAVEL_AT);
      tl.depth = depth;
    });
    applyZoom();
  };
  build();

  // Keyboard: focusing a project scrolls to the point of the flight where it is in front.
  on(ctx, scene, 'focusin', (e) => {
    if (!tl) return;
    const i = items.findIndex((li) => li.contains(e.target));
    const t = TRAVEL_AT + (TRAVEL * ((i + 1) * cfg.gap + FRONT)) / tl.depth;
    const st = tl.scrollTrigger;
    const y = st.start + (st.end - st.start) * Math.min(1, t / tl.duration());
    if (lenis) lenis.scrollTo(y, { duration: 0.8 }); else scrollTo({ top: y });
  });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  ScrollTrigger.refresh();

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('count')) return false;
      if (changed.some((c) => c === 'gap' || c === 'scrub')) { build(); ScrollTrigger.refresh(); }
      return undefined;
    },
  };
}
