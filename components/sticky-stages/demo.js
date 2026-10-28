// Sticky stages — a ceramics shop launches a vase. Two tall rails each hold a CSS-sticky stage; ScrollTrigger only
// reads their progress (never pin: true). Across the hero rail the card hinges on its bottom-left corner
// (x −10 %, −15°) while the seal on it turns harder and starts a beat later; across the second rail each step card
// rises, holds and settles in turn. Reduced motion: the rails collapse to their content and nothing moves.
import './demo.css';
import { on, html, raw, clamp, photo, photos, imageHTML, content, formatPrice } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const STEPS = [
  { k: 'Thrown', t: 'On the wheel', b: 'Each vase starts as 2.2 kg of stoneware, thrown in one pull and left to stiffen overnight.', id: 'obj-jian-tea-bowl', tags: ['ceramic'] },
  { k: 'Glazed', t: 'Dipped twice', b: 'An oat glaze mixed in the workshop; the foot is wiped back so the bare clay shows.', id: 'obj-grueby-vase', tags: ['ceramic', 'cool'] },
  { k: 'Fired', t: '1,280 °C', b: 'Fourteen hours in a reduction kiln. The flame decides the last tenth of the colour.', id: 'obj-roman-oil-lamp', tags: ['ceramic', 'warm'] },
  { k: 'Packed', t: 'Paper, not foam', b: 'Wrapped in moulded pulp and sent within three days, with the potter’s initials on the base.', id: 'tex-paper-sheets', tags: ['texture'] },
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
    <header class="ss__bar ac-bar">
      <a class="ac-brand" href="#top">${shop.name}</a>
      <nav aria-label="Shop"><a href="#top">Vases</a><a href="#top">Tableware</a><a href="#top">Journal</a></nav>
      <a class="ss__bag" href="#top">Bag <span class="ac-num">0</span></a>
    </header>

    <section class="ss__rail ss__rail--hero" data-rail="hero" aria-labelledby="ss-title">
      <div class="ss__stage ss__stage--hero">
        <p class="ss__behind" aria-hidden="true"><span class="ac-label">Next</span><span>How a Tide Vase is made, in ${count} steps</span></p>
        <article class="ss__panel" data-hinge>
          <div class="ss__copy">
            <p class="ac-label ss__kicker">${shop.name} · Spring firing 2027</p>
            <h1 class="ac-display" id="ss-title">${vase.name}</h1>
            <p class="ss__lede">Thrown, glazed and fired by hand in a run of 120. ${vase.dims.h} cm tall, in oat, iron or celadon.</p>
            <div class="ss__buy">
              <a class="ac-btn ac-btn--lg ss__btn" href="#bag">Add to bag — ${formatPrice(vase.price)}</a>
              <a class="ss__more" href="#ss-making" data-jump>See how it is made</a>
            </div>
          </div>
          <figure class="ss__photo">
            <span class="ac-media">${raw(imageHTML(hero, { sizes: '(max-width: 700px) 90vw, 40vw', eager: true, alt: `${vase.name} in ${vase.colour.toLowerCase()}` }))}</span>
            <span class="ss__seal" data-hinge-child aria-hidden="true"><b>120</b><small>pieces<br>this run</small></span>
          </figure>
        </article>
      </div>
    </section>

    <section class="ss__rail ss__rail--steps" data-rail="steps" id="ss-making" aria-labelledby="ss-making-title">
      <div class="ss__stage ss__stage--steps">
        <div class="ss__head">
          <div>
            <p class="ac-label">How it is made</p>
            <h2 class="ac-h2" id="ss-making-title">From wet clay to your shelf in a week.</h2>
          </div>
          <p class="ss__count ac-label"><span><b data-count>Step 1</b> of ${count}</span><span class="ss__meter" aria-hidden="true"><span data-meter></span></span></p>
        </div>
        <ol class="ss__cards" role="list" style="--n:${count}">
          ${steps.map((s, i) => html`
            <li class="ss__card" data-stage="${i}">
              <figure>
                <span class="ac-media ss__shot">${raw(imageHTML(shots[i], { sizes: '(max-width: 700px) 40vw, 30vw', alt: '' }))}</span>
                <figcaption>
                  <span class="ac-label ss__k">${String(i + 1).padStart(2, '0')} · ${s.k}</span>
                  <strong class="ss__t">${s.t}</strong>
                  <span class="ss__b">${s.b}</span>
                </figcaption>
              </figure>
            </li>`)}
        </ol>
      </div>
    </section>

    <section class="ss__close ac-wrap" aria-label="Buy">
      <p class="ac-label">${vase.material}</p>
      <p class="ac-h1">${vase.name}, ${formatPrice(vase.price)}.</p>
      <p class="ac-small">${vase.dims.h} × ${vase.dims.d} cm · ${vase.weight} · Ships in three days</p>
      <a class="ac-btn ac-btn--lg" href="#bag">Add to bag</a>
    </section>`;

  root.querySelectorAll('a[href^="#"]:not([data-jump])').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

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

  const lenis = useLenis(ctx);
  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  on(ctx, root.querySelector('[data-jump]'), 'click', (e) => {
    e.preventDefault();
    const y = stepRail.getBoundingClientRect().top + scrollY;
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else scrollTo({ top: y });
    stepRail.querySelector('h2').setAttribute('tabindex', '-1');
    stepRail.querySelector('h2').focus({ preventScroll: true });
  });

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
