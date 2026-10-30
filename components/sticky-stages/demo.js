// Sticky stages — a vase's hero card and its making-of steps (title and picture each). Two tall rails each hold a
// CSS-sticky stage; ScrollTrigger only reads their progress (never pin: true). Across the hero rail the card hinges
// on its bottom-left corner (x −10 %, −15°) while the seal on it turns harder and starts a beat later; across the
// second rail each step card rises, holds and settles in turn. Reduced motion: the rails collapse to their content
// and nothing moves.
import './demo.css';
import { on, html, raw, clamp, photo, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const STEPS = [
  { t: 'Thrown on the wheel', id: 'obj-jian-tea-bowl', tags: ['ceramic'] },
  { t: 'Glazed twice', id: 'obj-grueby-vase', tags: ['ceramic', 'cool'] },
  { t: 'Fired at 1,280 °C', id: 'obj-roman-oil-lamp', tags: ['ceramic', 'warm'] },
  { t: 'Packed in paper', id: 'tex-paper-sheets', tags: ['texture'] },
];

// A named picture when the shared set has it, else a pick by tag (the set may change; a demo never depends on one file).
const pick = (id, tags, seed) => { const p = photo(id); return p.drawn ? photos({ tags, count: 1, seed })[0] : p; };

export default function mount(root, options, ctx) {
  const { shop } = content;
  const vase = shop.products.find((p) => p.id === 'tide-vase');
  let cfg = { ...options };
  const count = clamp(Math.round(cfg.stages), 2, STEPS.length);
  const steps = STEPS.slice(0, count);
  const hero = pick('obj-celadon-vase', ['ceramic'], 'ss-hero');
  const shots = steps.map((s, i) => pick(s.id, s.tags, `ss-step-${i}`));

  root.className = 'ss';
  root.innerHTML = html`
    <section class="ss__rail ss__rail--hero" data-rail="hero" aria-labelledby="ss-title">
      <div class="ss__stage ss__stage--hero">
        <article class="ss__panel" data-hinge>
          <h1 class="ac-display ss__title" id="ss-title">${vase.name}</h1>
          <figure class="ss__photo">
            <span class="ac-media">${raw(imageHTML(hero, { sizes: '(max-width: 700px) 90vw, 40vw', eager: true, alt: `${vase.name} in ${vase.colour.toLowerCase()}` }))}</span>
            <span class="ss__seal" data-hinge-child aria-hidden="true"><b>120</b><small>pieces<br>this run</small></span>
          </figure>
        </article>
      </div>
    </section>

    <section class="ss__rail ss__rail--steps" data-rail="steps" aria-labelledby="ss-making-title">
      <div class="ss__stage ss__stage--steps">
        <div class="ss__head">
          <h2 class="sr-only" id="ss-making-title">How a ${vase.name} is made</h2>
          <p class="ss__count ac-label"><span><b data-count>Step 1</b> of ${count}</span><span class="ss__meter" aria-hidden="true"><span data-meter></span></span></p>
        </div>
        <ol class="ss__cards" role="list" style="--n:${count}">
          ${steps.map((s, i) => html`
            <li class="ss__card" data-stage="${i}">
              <figure>
                <span class="ac-media ss__shot">${raw(imageHTML(shots[i], { sizes: '(max-width: 700px) 40vw, 30vw', alt: '' }))}</span>
                <figcaption>
                  <span class="ac-label ss__k">${String(i + 1).padStart(2, '0')}</span>
                  <strong class="ss__t">${s.t}</strong>
                </figcaption>
              </figure>
            </li>`)}
        </ol>
      </div>
    </section>`;

  const heroRail = root.querySelector('[data-rail="hero"]');
  const stepRail = root.querySelector('[data-rail="steps"]');
  const panel = root.querySelector('[data-hinge]');
  const seal = root.querySelector('[data-hinge-child]');
  const cards = [...root.querySelectorAll('[data-stage]')];
  const countEl = root.querySelector('[data-count]');
  const meter = root.querySelector('[data-meter]');

  const apply = () => root.style.setProperty('--hold', `${cfg.hold * count}svh`);
  apply();

  // Wayfinding works on every tier: the counter follows the second rail's progress.
  let shown = -1;
  const wayfind = (p) => {
    const up = clamp(Math.floor(p * (count + 1)) + 1, 1, count);
    if (up !== shown) { shown = up; countEl.textContent = `Step ${up}`; }
    meter.style.transform = `scaleX(${p.toFixed(4)})`;
    cards.forEach((c, i) => c.classList.toggle('is-up', i < up && p > 0));
  };

  useLenis(ctx);
  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);

  if (ctx.motion !== 'full') {
    root.classList.add('ss--still');
    context.add(() => ScrollTrigger.create({ trigger: stepRail, start: 'top center', end: 'bottom center', onUpdate: (s) => wayfind(s.progress) }));
    wayfind(1);
    return { update(next) { cfg = { ...next }; apply(); return next.stages === count ? undefined : false; } };
  }

  let timelines = [];
  const build = () => {
    timelines.forEach((tl) => { tl.scrollTrigger?.kill(); tl.kill(); });
    gsap.set([panel, seal, ...cards], { clearProps: 'transform,opacity' });
    const scrub = cfg.scrub > 0 ? cfg.scrub : true;
    const k = cfg.angle / 15;
    context.add(() => {
      // Hero hinge: the card swings on its bottom-left corner; the seal turns harder and starts later, which is
      // what makes the card read as an object with mass rather than a tween.
      const hinge = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: heroRail, start: 'top top', end: 'bottom bottom', scrub, invalidateOnRefresh: true },
      })
        .to(panel, { xPercent: -10 * k, rotation: -15 * k, duration: 1 }, 0)
        .to(seal, { rotation: -22 * k, xPercent: 12 * k, duration: 1 - cfg.lag }, cfg.lag);

      // Stages: each card rises, holds and settles; card i owns the slice [i, i + 1] of the timeline.
      gsap.set(cards, { yPercent: 40, opacity: 0.2 });
      const stages = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: stepRail, start: 'top top', end: 'bottom bottom', scrub, invalidateOnRefresh: true, onUpdate: (s) => wayfind(s.progress) },
      });
      cards.forEach((card, i) => {
        stages.to(card, { yPercent: 0, opacity: 1, duration: 1 }, i).to(card, { yPercent: -8, duration: 1 }, i + 1);
      });
      timelines = [hinge, stages];
    });
  };
  build();
  wayfind(0);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  on(ctx, window, 'load', () => ScrollTrigger.refresh());

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('stages')) return false;
      apply();
      if (changed.some((c) => c === 'angle' || c === 'lag' || c === 'scrub')) build();
      ScrollTrigger.refresh();
      return undefined;
    },
  };
}
