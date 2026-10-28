// Goo line reveal — a Fieldnote feature whose headings condense out of a pool of ink. Each heading is split into lines
// (SplitText, aria auto) and every line gets its own SVG filter: feGaussianBlur tweened to 0, then an feColorMatrix
// alpha row that starts as a hard threshold and relaxes to identity in the blur's tail. Each filter comes off as its
// line lands and the split is reverted once the heading has landed. Once per heading at top 85 %. Reduced: a fade.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { SplitText } from 'gsap/SplitText';
import { later, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';

gsap.registerPlugin(SplitText);

const SVG = 'http://www.w3.org/2000/svg';
const SETTLE = 0.45;    // s, the threshold relaxes over the last part of each line
const CUT = 7 / 18;     // the alpha the threshold cuts at, kept whatever its sharpness
const START = 'top 85%';
const FADE = 0.4;       // reduced tier: opacity only
const matrix = (amp, off) => `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${amp.toFixed(3)} ${off.toFixed(3)}`;

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const article = magazine.articles.find((a) => a.slug === 'salt-and-time');
  const [pic] = photos({ tags: ['landscape'], count: 1, seed: 'gr-salt', orientation: 'landscape' });
  const [p0, p1, p2, p3, p4] = magazine.longRead;
  let cfg = { ...options };
  root.className = 'gr gr--wait';
  root.innerHTML = html`
    <header class="ac-bar gr__bar">
      <a class="ac-brand gr__brand" href="#top">${magazine.name}</a>
      <nav aria-label="Sections"><a href="#top">${magazine.issue.split(' — ')[0]}</a><a href="#top" aria-current="page">Places</a><a href="#top">Craft</a></nav>
      <a class="ac-btn ac-btn--sm" href="#top">Subscribe</a>
    </header>
    <article class="gr__article">
      <header class="gr__open ac-wrap">
        <p class="ac-label">${article.section} · ${magazine.issue}</p>
        <h1 class="gr__title" id="gr-title" data-goo>${article.title}</h1>
        <div class="gr__meta">
          <p class="gr__dek">${article.dek}</p>
          <p class="ac-label gr__by">Words by ${article.author}<br>Photographs by Jens Holt · ${article.read} read</p>
        </div>
      </header>
      <figure class="gr__fig ac-wrap">
        <div class="ac-media gr__pic">${raw(imageHTML(pic, { eager: true, sizes: '(max-width: 1320px) 100vw, 1320px', alt: 'Salt pans on Læsø under a low grey sky' }))}</div>
        <figcaption class="ac-small">The boiling house at Hals Mose, the last one still worked by hand.</figcaption>
      </figure>
      <div class="gr__body ac-wrap ac-wrap--narrow">
        <p>${p0}</p>
        <p>${p1}</p>
        <h2 class="gr__h2" id="gr-h1" data-goo>She reads the pan by sound, and has never used a thermometer.</h2>
        <p>${p2}</p>
        <h2 class="gr__h2" id="gr-h2" data-goo>Every summer since 1788 is written down above the boiling house.</h2>
        <p>${p3}</p>
        <p>${p4}</p>
      </div>
    </article>
    <svg class="gr__defs" aria-hidden="true" focusable="false" width="0" height="0"><defs data-defs></defs></svg>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault(), { signal: ctx.signal }));

  const defs = root.querySelector('[data-defs]');
  const { ScrollTrigger } = useGsap(ctx, root);
  const headings = [...root.querySelectorAll('[data-goo]')].map((el) => ({ el, status: 'idle', filters: [], tl: null, split: null, st: null }));
  let uid = 0;

  // One filter per line: blur → alpha threshold. The region is generous so the pooled blur is not cut square.
  const makeFilter = (px, amp) => {
    const id = `gr-goo-${++uid}`;
    const f = document.createElementNS(SVG, 'filter');
    for (const [k, v] of [['id', id], ['x', '-20%'], ['y', '-60%'], ['width', '140%'], ['height', '220%'], ['color-interpolation-filters', 'sRGB']]) f.setAttribute(k, v);
    const blur = document.createElementNS(SVG, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', String(px));
    blur.setAttribute('result', 'pool');
    const alpha = document.createElementNS(SVG, 'feColorMatrix');
    alpha.setAttribute('in', 'pool');
    alpha.setAttribute('type', 'matrix');
    alpha.setAttribute('values', matrix(amp, -amp * CUT));
    f.append(blur, alpha);
    defs.append(f);
    return { id, f, blur, alpha };
  };
  // Take one line's filter off and delete its node: after this the line is ordinary text.
  const release = (fx) => {
    if (fx.released) return;
    fx.line.style.removeProperty('filter');
    fx.f.remove();
    fx.released = true;
  };

  // The heading has landed: every filter is off, so revert the split to the authored markup.
  const finish = (h) => {
    h.filters.forEach(release);
    h.filters = [];
    h.split?.revert();
    h.split = null;
    h.tl = null;
    h.status = 'done';
  };

  // Build (or rebuild, after a re-split) the filters and the paused timeline for the current lines; a rebuild
  // mid-reveal carries on from the same moment.
  const arm = (h, lines) => {
    const time = h.tl ? h.tl.time() : 0;
    h.tl?.kill();
    h.filters.forEach(release);
    h.filters = [];
    const px = parseFloat(getComputedStyle(h.el).fontSize) * cfg.blur;
    const amp = cfg.amp;
    const tl = gsap.timeline({ paused: true, onComplete: () => finish(h) });
    lines.forEach((line, i) => {
      const fx = { ...makeFilter(px, amp), line, released: false };
      line.style.filter = `url(#${fx.id})`;
      h.filters.push(fx);
      const at = i * cfg.stagger;
      const t = { amp, off: -amp * CUT };
      const settle = Math.min(SETTLE, cfg.duration * 0.6);
      tl.fromTo(fx.blur, { attr: { stdDeviation: px } }, { attr: { stdDeviation: 0 }, duration: cfg.duration, ease: 'power3.out' }, at)
        // The threshold relaxes in the blur's tail, so the edges soften back into antialiased type as it ends.
        .fromTo(t, { amp, off: -amp * CUT }, { amp: 1, off: 0, duration: settle, ease: 'none', onUpdate: () => fx.alpha.setAttribute('values', matrix(t.amp, t.off)) }, at + cfg.duration - settle)
        .call(() => release(fx), null, at + cfg.duration);
    });
    h.tl = tl;
    if (time > 0) tl.time(time, false);
    if (h.status === 'playing') tl.play();
  };

  const armFull = (h) => {
    h.status = 'armed';
    h.split = SplitText.create(h.el, { type: 'lines', linesClass: 'gr__line', aria: 'auto', autoSplit: true, onSplit: (self) => arm(h, self.lines) });
    h.st = ScrollTrigger.create({
      trigger: h.el,
      start: START,
      once: true,
      onEnter: () => { if (h.status !== 'armed') return; h.status = 'playing'; h.tl.play(); },
    });
  };
  const armReduced = (h) => {
    h.status = 'armed';
    gsap.set(h.el, { opacity: 0 });
    h.st = ScrollTrigger.create({
      trigger: h.el,
      start: START,
      once: true,
      onEnter: () => {
        h.status = 'playing';
        h.tl = gsap.to(h.el, { opacity: 1, duration: FADE, ease: 'power1.out', onComplete: () => { gsap.set(h.el, { clearProps: 'opacity' }); h.tl = null; h.status = 'done'; } });
      },
    });
  };

  // Undo everything on every heading, landed or not, so a replay starts from plain text.
  const teardown = () => {
    for (const h of headings) {
      h.st?.kill();
      h.st = null;
      h.tl?.kill();
      h.tl = null;
      h.filters.forEach(release);
      h.filters = [];
      h.split?.revert();
      h.split = null;
      gsap.set(h.el, { clearProps: 'opacity' });
      h.status = 'idle';
    }
  };
  ctx.onCleanup(teardown);

  const build = () => {
    teardown();
    for (const h of headings) {
      if (ctx.motion === 'full') armFull(h);
      else if (ctx.motion === 'reduced') armReduced(h);
      else h.status = 'done';
    }
    root.classList.remove('gr--wait');
    ScrollTrigger.refresh();
  };

  // Line breaks depend on the real face; without it after 2.5 s the headings show as plain text.
  later(ctx, () => root.classList.remove('gr--wait'), 2500);
  document.fonts.ready.then(() => {
    if (ctx.signal.aborted) return;
    build();
    // The thumbnail: the title halfway out of its pool, the second line a beat behind the first.
    if (ctx.capture && headings[0].tl) {
      const h = headings[0];
      h.st?.kill();
      h.status = 'playing';
      h.tl.time(cfg.duration * 0.5).pause();
    }
  });

  return {
    update(next) {
      cfg = { ...next };
      build();
    },
    action(id) { if (id === 'replay') build(); },
  };
}
