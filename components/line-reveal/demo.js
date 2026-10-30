// Masked line reveal — a Fieldnote story opener alone on the stage: headline, dek and one paragraph. Every
// [data-reveal] block is split by GSAP SplitText after the fonts have landed (line boundaries depend on the real
// face), each line wrapped in an overflow mask, and rises from yPercent ±120 with expo-out. The tween is built inside
// onSplit and returned, so autoSplit can rebuild it on a resize without leaving a paragraph half hidden. Blocks on
// the first screen play in order (dek +0.5 s, paragraph +0.8 s); one below it (a phone) fires once at top 85 %.
// Reduced motion: no split, a 0.4 s fade per block. Static: the text is just there.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { SplitText } from 'gsap/SplitText';
import { html, content } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';

gsap.registerPlugin(SplitText);

// Per-unit stagger as a share of the line stagger (the recipe's .1 for lines, .03 for words).
const STEP = { lines: 1, words: 0.3, chars: 0.12 };

export default async function mount(root, options, ctx) {
  const { magazine } = content;
  const [first] = magazine.longRead;
  let cfg = { ...options };

  root.className = 'lr';
  root.innerHTML = html`
    <section class="ac-stage lr__stage" aria-labelledby="lr-title">
      <div class="lr__col">
        <h1 class="lr__title" id="lr-title" data-reveal="head">On Læsø, the summer is spent boiling <em>the sea.</em></h1>
        <p class="lr__dek" data-reveal="body" data-delay="0.5">For four months the island’s kilns stay lit and the salt comes off the pans in grey, glittering crusts. Ingrid Vold spent a season with the last families who still do it.</p>
        <p class="lr__p" data-reveal="body" data-delay="0.8">${first}</p>
      </div>
      <p class="ac-stage__note"><span>${magazine.name} · story opener</span></p>
    </section>`;

  const blocks = [...root.querySelectorAll('[data-reveal]')];
  // A block that starts below the first screen waits for the scroll; the rest play in order on arrival.
  const belowFold = (el) => el.getBoundingClientRect().top > innerHeight;

  // Static: settled at once. Nothing to split, nothing to play.
  if (ctx.motion === 'static') return {};

  const { context } = useGsap(ctx, root);
  let built = [];

  // Fonts first: wait for the faces this opener sets, then for anything else still loading.
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
      for (const el of blocks) {
        const below = belowFold(el);
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
        const below = belowFold(el);
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
    });
  };

  const run = () => (ctx.motion === 'full' ? build() : buildReduced());
  run();
  root.classList.remove('lr--pending');
  ctx.onCleanup(teardown);

  const replay = () => {
    window.scrollTo(0, 0);
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
