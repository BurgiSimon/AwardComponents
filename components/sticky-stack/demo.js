// Sticky stack cards — an architecture studio's four disciplines as four cards (name, one line, picture), alone.
// Every card is a sticky article (top 12 svh, each a few px lower than the last so the pile's edges show). As the
// next card travels from the bottom of the viewport to its sticky top, a scrubbed tween settles the card beneath:
// scale 0.92 − 0.02 × index from its top centre, and a dim overlay of the page ground. Reduced motion: still sticky
// (that is layout), no scale, no dim.
import './demo.css';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const DISCIPLINES = [
  { name: 'Architecture', line: 'Houses, schools, bathing places and libraries.', tags: ['architecture'] },
  { name: 'Interiors', line: 'Kitchens, reading rooms, a bar lit only from the floor.', tags: ['interior'] },
  { name: 'Landscape', line: 'Ground and planting drawn for wind and salt air.', tags: ['landscape'] },
  { name: 'Furniture', line: 'Small editions in ash and oak, made in Os.', tags: ['furniture'] },
];

export default function mount(root, options, ctx) {
  const { studio } = content;
  const shots = DISCIPLINES.map((d, i) => photos({ tags: d.tags, count: 1, seed: `sk-${i}` })[0]);
  let cfg = { ...options };

  root.className = 'sk';
  root.innerHTML = html`
    <section class="sk__stack ac-wrap" aria-label="${studio.name} disciplines">
      ${DISCIPLINES.map((d, i) => html`
        <article class="sk__card" data-card style="--i:${i}" aria-labelledby="sk-d${i}">
          <div class="sk__copy">
            <h2 class="sk__name" id="sk-d${i}">${d.name}</h2>
            <p class="sk__line">${d.line}</p>
          </div>
          <span class="ac-media sk__media">${raw(imageHTML(shots[i], { sizes: '(max-width: 760px) 92vw, 44vw', alt: '' }))}</span>
        </article>`)}
    </section>
    <p class="ac-stage__note sk__note"><span>${studio.name} · services</span></p>`;

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
