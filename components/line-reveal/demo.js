// Masked line reveal — a magazine story opener. Every [data-reveal] block is split by GSAP SplitText after the
// fonts have landed (line boundaries depend on the real face), each line wrapped in an overflow mask, and rises
// from yPercent ±120 with expo-out. The tween is built inside onSplit and returned, so autoSplit can rebuild it on
// a resize without leaving a paragraph half hidden. Above the fold the blocks play in order (dek +0.5 s); below
// it each fires once at top 85 %. Reduced motion: no split, a 0.4 s fade per block. Static: the text is just there.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { SplitText } from 'gsap/SplitText';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

gsap.registerPlugin(SplitText);

// Per-unit stagger as a share of the line stagger (the recipe's .1 for lines, .03 for words).
const STEP = { lines: 1, words: 0.3, chars: 0.12 };

export default async function mount(root, options, ctx) {
  const { magazine } = content;
  const story = magazine.articles[0];
  const next = magazine.articles[1];
  const [hero] = photos({ tags: ['water'], count: 1, seed: 'lr-hero' });
  const body = magazine.longRead;
  let cfg = { ...options };

  root.className = 'lr';
  root.innerHTML = html`
    <header class="ac-bar lr__bar">
      <a class="lr__brand" href="#top">${magazine.name}</a>
      <nav aria-label="Sections">${['Places', 'Architecture', 'Craft', 'Culture'].map((s) => html`<a href="#top">${s}</a>`)}</nav>
      <span class="ac-label lr__issue">${magazine.issue}</span>
    </header>
    <section class="lr__hero ac-wrap" aria-labelledby="lr-title">
      <div class="lr__head">
        <p class="ac-label lr__kicker"><span>${story.section}</span><span>${story.title}</span><span>${story.read} read</span></p>
        <h1 class="lr__title" id="lr-title" data-reveal="head">On Læsø, the summer is spent boiling <em>the sea.</em></h1>
        <div class="lr__meta">
          <p class="lr__dek" data-reveal="body" data-delay="0.5">For four months the island’s kilns stay lit and the salt comes off the pans in grey, glittering crusts. Ingrid Vold spent a season with the last families who still do it.</p>
          <p class="lr__by" data-reveal="body" data-delay="0.7"><span class="ac-label">Words</span> ${story.author}<br><span class="ac-label">Pictures</span> Jonas Brekke</p>
        </div>
      </div>
      <figure class="lr__fig" data-fade>
        <div class="ac-media lr__media">${raw(imageHTML(hero, { sizes: '(max-width: 880px) 92vw, 34vw', eager: true, alt: 'The shore below the boiling houses, late summer' }))}</div>
        <figcaption class="ac-label">The shore below the boiling houses at Vesterø, August</figcaption>
      </figure>
    </section>

    <article class="lr__story ac-wrap" aria-label="${story.title}">
      <aside class="lr__aside">
        <p class="ac-label">Chapter one</p>
        <p class="lr__aside-t">The pans</p>
        <p class="ac-small">${magazine.issue}</p>
      </aside>
      <div class="lr__col">
        <p class="lr__p lr__p--first" data-reveal="body">${body[0]}</p>
        <p class="lr__p" data-reveal="body">${body[1]}</p>
        <blockquote class="lr__quote">
          <p data-reveal="head">“A low roll means the water is too deep. A hiss means it is nearly done.”</p>
          <footer class="ac-label">Birthe, thirty-one summers at the pans</footer>
        </blockquote>
        <p class="lr__p" data-reveal="body">${body[2]}</p>
        <h2 class="lr__h2" data-reveal="head">A ledger for every summer since 1788</h2>
        <p class="lr__p" data-reveal="body">${body[3]}</p>
        <p class="lr__p" data-reveal="body">${body[4]}</p>
        <a class="lr__next" href="#top"><span class="ac-label">Next story</span><strong>${next.title}</strong><span>${next.dek}</span></a>
      </div>
    </article>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const blocks = [...root.querySelectorAll('[data-reveal]')];
  const fig = root.querySelector('[data-fade]');
  const heroEl = root.querySelector('.lr__hero');
  const inHero = (el) => heroEl.contains(el);

  // Static: settled at once. Nothing to split, nothing to play.
  if (ctx.motion === 'static') return {};

  const lenis = useLenis(ctx);
  const { context } = useGsap(ctx, root);
  let built = [];

  // Fonts first: wait for the faces this page sets, then for anything else still loading.
  root.classList.add('lr--pending');
  await Promise.all([
    document.fonts?.load('500 64px "Bodoni Moda Variable"'),
    document.fonts?.load('italic 500 64px "Bodoni Moda Variable"'),
    document.fonts?.load('400 18px "Mona Sans Variable"'),
  ].map((p) => p?.catch(() => {}))).then(() => document.fonts?.ready);
  if (ctx.signal.aborted) return {};

  const teardown = () => {
    for (const b of built) b.revert();
    built = [];
  };

  // Reduced motion: whole blocks fade for 0.4 s; the DOM keeps whole sentences.
  const buildReduced = () => {
    teardown();
    context.add(() => {
      for (const el of [...blocks, fig]) {
        const below = !inHero(el);
        const t = gsap.from(el, { autoAlpha: 0, duration: 0.4, delay: below ? 0 : Number(el.dataset.delay || 0) * 0.5, scrollTrigger: below ? { trigger: el, start: 'top 85%', once: true } : undefined });
        built.push({ revert: () => { t.scrollTrigger?.kill(); t.revert(); } });
      }
    });
  };

  const build = () => {
    teardown();
    context.add(() => {
      const from = cfg.direction === 'above' ? -120 : 120;
      for (const el of blocks) {
        const unit = el.dataset.reveal === 'head' ? cfg.unit : 'lines';
        const below = !inHero(el);
        // ARIA forbids naming a paragraph: a split paragraph is hidden and a visually hidden copy reads whole.
        const named = /^H[1-6]$/.test(el.tagName);
        let copy = null;
        if (!named) {
          copy = el.cloneNode(true);
          copy.className = 'sr-only';
          delete copy.dataset.reveal;
          el.before(copy);
        }
        const split = SplitText.create(el, {
          type: unit === 'lines' ? 'lines' : unit === 'words' ? 'words,lines' : 'chars,words,lines',
          mask: 'lines',
          aria: named ? 'auto' : 'hidden',
          autoSplit: true,
          linesClass: 'lr-line',
          wordsClass: 'lr-word',
          charsClass: 'lr-char',
          onSplit(self) {
            const targets = unit === 'lines' ? self.lines : unit === 'words' ? self.words : self.chars;
            return gsap.from(targets, {
              yPercent: from,
              duration: cfg.duration,
              ease: cfg.ease,
              stagger: cfg.stagger * STEP[unit],
              delay: below ? 0 : 0.12 + Number(el.dataset.delay || 0),
              scrollTrigger: below ? { trigger: el, start: 'top 85%', once: true } : undefined,
            });
          },
        });
        built.push({ revert: () => { split.revert(); copy?.remove(); } });
      }
      const t = gsap.from(fig, { autoAlpha: 0, scale: 1.04, duration: 1.6, ease: 'expo.out', delay: 0.3, transformOrigin: '50% 60%' });
      built.push({ revert: () => t.revert() });
    });
  };

  const run = () => (ctx.motion === 'full' ? build() : buildReduced());
  run();
  root.classList.remove('lr--pending');
  ctx.onCleanup(teardown);

  const replay = () => {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
    run();
  };

  return {
    update(nextOptions) {
      cfg = { ...nextOptions };
      run();
    },
    action(id) { if (id === 'replay') replay(); },
  };
}
