// Sticky stack cards — an architecture studio's four disciplines. Every card is a sticky article (top 12 svh, each a
// few px lower than the last so the pile's edges show). As the next card travels from the bottom of the viewport to
// its sticky top, a scrubbed tween settles the card beneath: scale 0.92 − 0.02 × index from its top centre, and a
// dim overlay of the page ground. Reduced motion: still sticky (that is layout), no scale, no dim.
import './demo.css';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const DISCIPLINES = [
  { name: 'Architecture', lead: 'New buildings from the first site walk to the keys: houses, schools, bathing places and libraries.', items: ['Site studies and feasibility', 'Planning and building permits', 'Construction drawings and site visits'], stat: '31 buildings since 1976', tags: ['architecture'] },
  { name: 'Interiors', lead: 'Rooms inside our buildings and other people’s: kitchens, reading rooms, a bar lit only from the floor.', items: ['Layouts and joinery', 'Lighting plans', 'Furniture and fabric schedules'], stat: '58 interiors, 12 of them for restaurants', tags: ['interior'] },
  { name: 'Landscape', lead: 'Ground, water and planting around the buildings, drawn for wind, salt air and long winter shadows.', items: ['Courtyards and roof gardens', 'Bathing places and shorelines', 'Planting that survives the coast'], stat: '19 gardens, 4 sea baths', tags: ['landscape'] },
  { name: 'Furniture', lead: 'Small editions in ash and oak, made with two workshops in Os and sold through Ostra.', items: ['The Arc Chair, edition of 200', 'Library tables and shelving', 'One-off pieces for our projects'], stat: '6 pieces in production', tags: ['furniture'] },
];

export default function mount(root, options, ctx) {
  const { studio } = content;
  const shots = DISCIPLINES.map((d, i) => photos({ tags: d.tags, count: 1, seed: `sk-${i}` })[0]);
  let cfg = { ...options };

  root.className = 'sk';
  root.innerHTML = html`
    <header class="ac-bar sk__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n, i) => html`<a href="#top" ${i === 1 ? raw('aria-current="page"') : ''}>${n}</a>`)}</nav>
    </header>
    <section class="sk__intro ac-wrap" aria-labelledby="sk-title">
      <p class="ac-label">What we do</p>
      <h1 class="ac-display" id="sk-title">Four disciplines, one studio.</h1>
      <p class="ac-lede">Most projects use two of them. The same eleven people draw the building, the rooms, the garden and, now and then, the chairs.</p>
    </section>

    <section class="sk__stack ac-wrap" aria-label="Disciplines">
      ${DISCIPLINES.map((d, i) => html`
        <article class="sk__card" data-card style="--i:${i}" aria-labelledby="sk-d${i}">
          <div class="sk__copy">
            <p class="ac-label sk__no">${String(i + 1).padStart(2, '0')} / ${String(DISCIPLINES.length).padStart(2, '0')}</p>
            <h2 class="sk__name" id="sk-d${i}">${d.name}</h2>
            <p class="sk__lead">${d.lead}</p>
            <ul class="sk__items" role="list">${d.items.map((t) => html`<li>${t}</li>`)}</ul>
            <p class="sk__stat ac-label">${d.stat}</p>
          </div>
          <span class="ac-media sk__media">${raw(imageHTML(shots[i], { sizes: '(max-width: 760px) 92vw, 44vw', alt: '' }))}</span>
        </article>`)}
    </section>

    <section class="sk__outro ac-wrap" aria-labelledby="sk-outro">
      <h2 class="ac-h1" id="sk-outro">Not sure which you need? Tell us about the site.</h2>
      <a class="ac-btn ac-btn--lg" href="#top">${studio.email}</a>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const cards = [...root.querySelectorAll('[data-card]')];
  const apply = () => {
    root.style.setProperty('--top', `${cfg.top}svh`);
    root.style.setProperty('--peek', `${cfg.peek}px`);
  };
  apply();

  useLenis(ctx);
  if (ctx.motion !== 'full') {
    root.classList.add('sk--still');
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  let tweens = [];
  // Card i settles while card i + 1 travels from the bottom of the viewport to its own sticky top.
  const build = () => {
    tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
    gsap.set(cards, { clearProps: 'transform' });
    cards.forEach((c) => c.style.setProperty('--dim', '0'));
    context.add(() => {
      tweens = cards.slice(0, -1).map((card, i) => {
        const next = cards[i + 1];
        const settle = { s: 0 };
        return gsap.to(settle, {
          s: 1,
          ease: 'none',
          onUpdate: () => {
            gsap.set(card, { scale: 1 - (1 - (cfg.scale - i * 0.02)) * settle.s });
            card.style.setProperty('--dim', (cfg.dim * settle.s).toFixed(3));
          },
          scrollTrigger: {
            trigger: next,
            start: 'top bottom',
            end: () => `top ${Math.round((innerHeight * cfg.top) / 100 + (i + 1) * cfg.peek)}px`,
            scrub: 0.4,
            invalidateOnRefresh: true,
          },
        });
      });
    });
  };
  build();
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  root.querySelectorAll('img').forEach((img) => on(ctx, img, 'load', () => ScrollTrigger.refresh(), { once: true }));

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.some((c) => c === 'top' || c === 'peek')) { ScrollTrigger.refresh(); return undefined; }
      // Scale and dim are read on every update; nudge each tween so the new values show at once.
      tweens.forEach((t) => t.vars.onUpdate());
      return undefined;
    },
  };
}
