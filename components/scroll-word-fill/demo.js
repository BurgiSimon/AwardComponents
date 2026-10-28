// Scroll word fill — an architecture studio's "what we believe". A tall section (300 svh) holds a 100 svh sticky
// stage, so no pin spacer is injected. After the fonts land, SplitText splits the statement into words (autoSplit,
// the timeline returned from onSplit so a resize rebuilds it at the same progress); one timeline scrubbed from
// top top to bottom 130 % takes each word from the resting opacity to 1 over one unit, staggered by half a unit,
// linear: the scroll is the easing. Reduced motion and static: no split, the sentence at full ink.
import './demo.css';
import { SplitText } from 'gsap/SplitText';
import { on, html, raw, colour, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

gsap.registerPlugin(SplitText);

const PRINCIPLES = [
  { k: 'Site first', b: 'We spend the first month on the ground: sun paths, the prevailing wind, where the snow drifts and where people already walk.' },
  { k: 'Materials that age', b: 'Larch, brick, lime and stone. Nothing that needs to look new to look right, and nothing glued that could be screwed.' },
  { k: 'Light as a budget', b: 'In Bergen the December sun is up for six hours. Every room is drawn around where that light lands.' },
];

export default async function mount(root, options, ctx) {
  const { studio, people } = content;
  const pics = photos({ tags: ['architecture'], count: 3, seed: 'swf-arch' });
  const [portrait] = photos({ tags: ['portrait'], count: 1, seed: 'swf-face' });
  let cfg = { ...options };

  root.className = 'swf';
  root.innerHTML = html`
    <header class="ac-bar swf__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n) => html`<a href="#top" ${n === 'Studio' ? raw('aria-current="page"') : ''}>${n}</a>`)}</nav>
    </header>
    <section class="swf__fill" data-fill aria-labelledby="swf-title">
      <div class="swf__stage ac-wrap">
        <div class="swf__top">
          <h2 class="ac-label swf__label" id="swf-title"><span class="swf__dot" aria-hidden="true"></span>What we believe</h2>
          <p class="ac-label">${studio.full} · ${studio.city} · since 1998</p>
        </div>
        <p class="swf__statement" data-fill-text>We design for <em>long winters and short summers:</em> rooms that hold the low sun, walls that keep the weather out, and materials that look <em>better at fifty</em> than they did on the day we handed over the keys.</p>
        <div class="swf__sign">
          <span class="swf__face ac-media">${raw(imageHTML(portrait, { sizes: '48px', alt: '' }))}</span>
          <p><strong>${people[0].name}</strong><span>${people[0].role}</span></p>
          <p class="ac-label swf__cue" aria-hidden="true">Scroll to read</p>
        </div>
      </div>
    </section>
    <section class="swf__after ac-wrap" aria-labelledby="swf-p">
      <h2 class="ac-h2" id="swf-p">Three things we hold to on every project</h2>
      <ol class="swf__list" role="list">
        ${PRINCIPLES.map((p, i) => html`<li><span class="ac-label">0${i + 1}</span><h3 class="ac-h3">${p.k}</h3><p class="ac-body">${p.b}</p></li>`)}
      </ol>
      <div class="swf__strip">
        ${pics.map((p, i) => html`<figure><div class="ac-media">${raw(imageHTML(p, { sizes: '(max-width: 720px) 90vw, 30vw', alt: '' }))}</div><figcaption class="ac-label">${studio.projects[i].title} · ${studio.projects[i].place}</figcaption></figure>`)}
      </div>
    </section>
    <footer class="swf__foot ac-wrap"><span class="ac-label">${studio.address.join(', ')}</span><a class="ac-link" href="mailto:${studio.email}">${studio.email}</a></footer>`;
  root.querySelectorAll('a[href="#top"], a[href^="mailto"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

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
