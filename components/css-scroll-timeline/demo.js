// CSS scroll-driven — a magazine long read, cut to a title, five short paragraphs and one figure, whose motion is
// all in demo.css: a reading-progress bar on scroll(root), paragraphs rising on view(), the title leaving on its
// section's named view timeline, and a sticky figure that grows on a rail's view timeline while a cover slides off
// its chart. This module only builds the page and, where animation-timeline is unknown (or the Engine control forces
// it), runs the fallback: one passive scroll listener for the bar and an IntersectionObserver that clears marks on
// blocks still below the fold.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, html, raw, clamp, photo, photos, imageHTML, content, observeIntersection } from '../../src/demo-kit/index.js';

// The long read, cut to five short paragraphs: two before the figure, three after it.
const BEFORE = [
  'The kilns on Læsø are lit in May and kept going until the first storms of September.',
  'Nobody does it for the money any more. A kilo of island salt sells for less than a coffee in Copenhagen.',
];
const AFTER = [
  'Birthe has boiled brine for thirty-one summers. She reads the pan by sound, never by thermometer.',
  'Above the boiling house the island keeps every ledger since 1788, in a room the size of a garage.',
  'The new building gives that record a proper home: half buried, lit from one slot along the horizon.',
];

// One value per summer, 1788–1860: the ledger's yield, drawn as a line (illustrative, not archival).
function ledgerPath() {
  const n = 73;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const v = 0.56 + 0.17 * Math.sin(i * 0.23 + 0.4) + 0.09 * Math.sin(i * 0.97 + 1.3) + 0.05 * Math.sin(i * 2.71) - 0.0024 * i;
    pts.push(`${((i / (n - 1)) * 1200).toFixed(1)} ${(300 - clamp(v, 0.08, 0.96) * 300).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

// A named picture when the shared set has it, else a pick by tag (the set may change; a demo never depends on one file).
const pick = (id, tags, seed) => { const p = photo(id); return p.drawn ? photos({ tags, count: 1, seed })[0] : p; };

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const article = magazine.articles.find((a) => a.slug === 'salt-and-time');
  const ledgerShot = pick('land-overcast-sea', ['water'], 'cst-ledger');
  let cfg = { ...options };

  const supported = { scroll: CSS.supports('animation-timeline: scroll()'), view: CSS.supports('animation-timeline: view()') };
  const engine = supported.scroll && supported.view && cfg.engine !== 'script' ? 'css' : 'script';

  root.className = 'cst';
  root.dataset.engine = engine;
  root.innerHTML = html`
    <div class="cst__progress" aria-hidden="true"><span data-progress></span></div>

    <main>
      <section class="cst__hero ac-wrap" aria-labelledby="cst-title">
        <div class="cst__hero-copy">
          <h1 class="cst__title" id="cst-title">${article.title}</h1>
        </div>
      </section>

      <div class="cst__text ac-wrap--narrow">${BEFORE.map((t, i) => html`<p class="reveal${i === 0 ? ' cst__first' : ''}">${t}</p>`)}</div>

      <section class="cst__rail" data-rail aria-label="The ledger">
        <div class="cst__stage ac-wrap">
          <figure class="cst__fig">
            <div class="cst__frame" data-frame>
              <span class="cst__photo ac-media">${raw(imageHTML(ledgerShot, { sizes: '(max-width: 760px) 92vw, 72rem', alt: 'Surf around a low rocky islet off the salt coast' }))}</span>
              <div class="cst__chart" aria-hidden="true">
                <span class="ac-label">Salt boiled each summer, in tonnes</span>
                <div class="cst__plot">
                  <svg viewBox="0 0 1200 300" preserveAspectRatio="none" focusable="false">
                    <path d="M0 150H1200" class="cst__mid" vector-effect="non-scaling-stroke"/>
                    <path d="${ledgerPath()}" class="cst__line" vector-effect="non-scaling-stroke"/>
                  </svg>
                  <span class="cst__years ac-label"><span>1788</span><span>1810</span><span>1835</span><span>1860</span></span>
                  <span class="cst__cover"></span>
                </div>
              </div>
            </div>
            <figcaption class="cst__caption">Seventy-three summers from the ledger. The dips are the wet years; the climb after 1840 follows the island’s first iron pans.</figcaption>
          </figure>
        </div>
      </section>

      <div class="cst__text cst__text--end ac-wrap--narrow">${AFTER.map((t) => html`<p class="reveal">${t}</p>`)}</div>
    </main>`;

  const apply = () => {
    root.style.setProperty('--rise', `${cfg.rise}rem`);
    root.style.setProperty('--frame-from', cfg.frameFrom);
    root.dataset.bar = cfg.bar;
  };
  apply();
  const instance = {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('engine') || (engine === 'script' && changed.includes('bar'))) return false;
      apply();
      return undefined;
    },
  };
  if (engine === 'css' || ctx.motion === 'static') return instance;

  // Fallback. The bar: one passive scroll listener, coalesced to a frame; under reduced motion it moves in tenths.
  const bar = root.querySelector('[data-progress]');
  const axis = cfg.bar === 'side' ? 'scaleY' : 'scaleX';
  let queued = false;
  const paint = () => {
    queued = false;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const prog = clamp(scrollY / max, 0, 1);
    bar.style.transform = `${axis}(${ctx.motion === 'full' ? prog.toFixed(4) : Math.floor(prog * 10) / 10})`;
  };
  on(ctx, window, 'scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
  on(ctx, window, 'resize', paint, { passive: true });
  paint();
  if (ctx.motion !== 'full') return instance;

  // Reveals: mark only what is still below the fold (nothing on screen blinks), clear the mark once seen. The top
  // margin is effectively unbounded, so a jump past a block (End, an anchor, find-in-page) never strands it hidden.
  const targets = [...root.querySelectorAll('.reveal'), root.querySelector('[data-rail]')];
  const below = (el) => el.getBoundingClientRect().top > innerHeight * 0.85;
  const pending = targets.filter(below);
  pending.forEach((el) => el.classList.add('is-pending'));
  const watch = (el) => (el.matches('[data-rail]') ? el.querySelector('[data-frame]') : el);
  const io = observeIntersection(ctx, pending.map(watch), (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.closest('.reveal, [data-rail]').classList.remove('is-pending');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '1000000px 0px -15% 0px' });
  return instance;
}
