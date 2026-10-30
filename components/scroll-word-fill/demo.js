// Scroll word fill — Halden's "what we believe", the statement and its attribution alone on a sticky stage. A tall
// section (300 svh) holds a 100 svh sticky stage, so no pin spacer is injected. After the fonts land, SplitText
// splits the statement into words (autoSplit, the timeline returned from onSplit so a resize rebuilds it at the same
// progress); one timeline scrubbed from top top to bottom 130 % takes each word from the resting opacity to 1 over
// one unit, staggered by half a unit, linear: the scroll is the easing. Reduced motion and static: no split, the
// sentence at full ink.
import './demo.css';
import { SplitText } from 'gsap/SplitText';
import { on, html, raw, colour, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

gsap.registerPlugin(SplitText);

export default async function mount(root, options, ctx) {
  const { studio, people } = content;
  const [portrait] = photos({ tags: ['portrait'], count: 1, seed: 'swf-face' });
  let cfg = { ...options };

  root.className = 'swf';
  root.innerHTML = html`
    <section class="swf__fill" data-fill aria-labelledby="swf-title">
      <div class="swf__stage ac-wrap">
        <h2 class="sr-only" id="swf-title">What we believe</h2>
        <p class="swf__statement" data-fill-text>We design for <em>long winters and short summers:</em> rooms that hold the low sun, walls that keep the weather out, and materials that look <em>better at fifty</em> than they did on the day we handed over the keys.</p>
        <div class="swf__sign">
          <span class="swf__face ac-media">${raw(imageHTML(portrait, { sizes: '48px', alt: '' }))}</span>
          <p><strong>${people[0].name}</strong><span>${people[0].role}</span></p>
        </div>
        <p class="ac-stage__note"><span>${studio.name} · studio statement</span></p>
      </div>
    </section>`;

  const section = root.querySelector('[data-fill]');
  const text = root.querySelector('[data-fill-text]');

  const apply = () => {
    root.style.setProperty('--swf-length', `${cfg.length}svh`);
    root.style.setProperty('--swf-hi', cfg.highlight === 'accent' ? 'var(--accent-ink)' : colour(cfg.highlight));
  };
  apply();

  // Reduced and static: no split, no fill; the statement rests at full ink as one sentence.
  if (ctx.motion !== 'full') {
    root.classList.add('swf--still');
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  useLenis(ctx);
  const { context, ScrollTrigger } = useGsap(ctx, root);
  let split = null;
  let tl = null;
  let copy = null;

  // Word boundaries depend on the real face, so split after the fonts land.
  await Promise.all([
    document.fonts?.load('620 64px "Mona Sans Variable"'),
    document.fonts?.load('italic 620 64px "Mona Sans Variable"'),
  ].map((p) => p?.catch(() => {}))).then(() => document.fonts?.ready);
  if (ctx.signal.aborted) return {};

  const teardown = () => {
    tl?.scrollTrigger?.kill();
    tl?.kill();
    split?.revert();
    copy?.remove();
    split = tl = copy = null;
  };

  const build = () => {
    teardown();
    // ARIA forbids naming a paragraph: the split words are hidden and a visually hidden copy carries the sentence.
    copy = text.cloneNode(true);
    copy.className = 'sr-only';
    copy.removeAttribute('data-fill-text');
    text.before(copy);
    context.add(() => {
      split = SplitText.create(text, {
        aria: 'hidden',
        type: cfg.unit === 'chars' ? 'words,chars' : 'words',
        wordsClass: 'swf-word',
        charsClass: 'swf-char',
        autoSplit: true,
        onSplit(self) {
          const units = cfg.unit === 'chars' ? self.chars : self.words;
          tl = gsap.timeline({
            scrollTrigger: { trigger: section, start: 'top top', end: 'bottom 130%', scrub: 0.5, invalidateOnRefresh: true },
          });
          // Set the floor explicitly: a staggered fromTo in a scrubbed timeline only renders the from-state of
          // children the playhead has reached, so every later word would sit at full ink.
          gsap.set(units, { opacity: cfg.floor });
          tl.to(units, { opacity: 1, duration: 1, stagger: cfg.edge, ease: 'none' });
          return tl;
        },
      });
    });
  };
  build();
  ctx.onCleanup(teardown);
  on(ctx, window, 'load', () => ScrollTrigger.refresh());

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('length')) ScrollTrigger.refresh();
      if (changed.some((k) => k === 'floor' || k === 'edge' || k === 'unit')) build();
    },
  };
}
