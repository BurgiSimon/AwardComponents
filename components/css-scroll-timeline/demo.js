// CSS scroll-driven — a magazine long read whose motion is all in demo.css: a reading-progress bar on
// scroll(root), paragraphs rising on view(), the hero copy leaving on its section's named view timeline, and a
// sticky figure that grows on a rail's view timeline while a cover slides off its chart. This module only builds the
// page and, where animation-timeline is unknown (or the Engine control forces it), runs the fallback: one passive
// scroll listener for the bar and an IntersectionObserver that clears marks on blocks still below the fold.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, html, raw, clamp, photos, imageHTML, content, observeIntersection } from '../../src/demo-kit/index.js';

const MORE = {
  kilns: 'Each boiling house has one pan, three metres across, set over a brick firebox. Brine from the shallow wells is ladled in at dawn and boiled down by dusk.',
  price: 'A family with two pans makes perhaps four tonnes in a good summer. The wet ones make half that, and the ledger records which were which.',
  birthe: 'When the crust forms she rakes it to the edge, lets it drain on a board and starts again. The pan is never left alone while the fire is in.',
  building: 'Inside, the shelves run the length of the slot. The ledgers sit at eye height, the oldest at the end where the light is softest.',
};

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

export default function mount(root, options, ctx) {
  const { magazine, people } = content;
  const article = magazine.articles.find((a) => a.slug === 'salt-and-time');
  const p = magazine.longRead;
  const [heroShot] = photos({ tags: ['landscape'], count: 1, seed: 'cst-hero' });
  const [ledgerShot] = photos({ tags: ['water'], count: 1, seed: 'cst-ledger' });
  let cfg = { ...options };

  const supported = { scroll: CSS.supports('animation-timeline: scroll()'), view: CSS.supports('animation-timeline: view()') };
  const engine = supported.scroll && supported.view && cfg.engine !== 'script' ? 'css' : 'script';

  root.className = 'cst';
  root.dataset.engine = engine;
  root.innerHTML = html`
    <div class="cst__progress" aria-hidden="true"><span data-progress></span></div>
    <header class="cst__bar ac-bar">
      <a class="ac-brand cst__brand" href="#top">${magazine.name}</a>
      <span class="ac-label cst__issue">${magazine.issue}</span>
      <a class="ac-btn ac-btn--sm ac-btn--ghost" href="#top">Subscribe</a>
    </header>

    <main>
      <section class="cst__hero ac-wrap" aria-labelledby="cst-title">
        <div class="cst__hero-copy">
          <p class="ac-label">${article.section} · ${article.read} read</p>
          <h1 class="cst__title" id="cst-title">${article.title}</h1>
          <p class="cst__dek">${article.dek}</p>
          <p class="cst__byline">Words by <strong>${article.author}</strong> · Photographs by <strong>${people[3].name}</strong></p>
        </div>
        <figure class="cst__hero-fig">
          <span class="ac-media">${raw(imageHTML(heroShot, { sizes: '(max-width: 760px) 92vw, 44vw', eager: true, alt: 'The salt flats at low water, late in the afternoon' }))}</span>
          <figcaption class="ac-small">Læsø in August. The boiling houses sit on the dune line, upwind of the village.</figcaption>
        </figure>
      </section>

      <section class="cst__chapter ac-wrap" aria-labelledby="cst-c1">
        <h2 class="cst__h2 reveal" id="cst-c1">The kilns</h2>
        <div class="cst__text"><p class="reveal cst__first">${p[0]}</p><p class="reveal">${MORE.kilns}</p></div>
      </section>

      <section class="cst__chapter ac-wrap" aria-labelledby="cst-c2">
        <h2 class="cst__h2 reveal" id="cst-c2">The price</h2>
        <div class="cst__text"><p class="reveal">${p[1]}</p><p class="reveal">${MORE.price}</p></div>
      </section>

      <section class="cst__rail" data-rail aria-labelledby="cst-c3">
        <div class="cst__stage ac-wrap">
          <h2 class="cst__h2" id="cst-c3">The ledger</h2>
          <figure class="cst__fig">
            <div class="cst__frame" data-frame>
              <span class="cst__photo ac-media">${raw(imageHTML(ledgerShot, { sizes: '(max-width: 760px) 92vw, 72rem', alt: 'Brine pans on the shore below the archive' }))}</span>
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

      <section class="cst__chapter ac-wrap" aria-labelledby="cst-c4">
        <h2 class="cst__h2 reveal" id="cst-c4">Birthe</h2>
        <div class="cst__text"><p class="reveal">${p[2]}</p><p class="reveal">${MORE.birthe}</p></div>
      </section>

      <section class="cst__chapter ac-wrap" aria-labelledby="cst-c5">
        <h2 class="cst__h2 reveal" id="cst-c5">The new building</h2>
        <div class="cst__text"><p class="reveal">${p[3]}</p><p class="reveal">${p[4]}</p><p class="reveal">${MORE.building}</p></div>
      </section>
    </main>

    <footer class="cst__foot ac-wrap">
      <p class="ac-small">${magazine.name} · ${magazine.issue}</p>
      <p class="ac-label cst__engine">Drawn by <strong data-engine-name>${engine === 'css' ? 'CSS scroll timelines' : 'the script fallback'}</strong></p>
    </footer>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

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
