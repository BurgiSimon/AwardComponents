// Goo line reveal — four Fieldnote headings, each with one paragraph, condensing out of a pool of ink as they scroll
// in. Each heading is split into lines (SplitText, aria auto) and every line gets its own SVG filter: feGaussianBlur
// tweened to 0, then an feColorMatrix alpha row that starts as a hard threshold and relaxes to identity in the blur's
// tail. Each filter comes off as its line lands and the split is reverted once the heading has landed. Once per
// heading at top 85 %. Reduced: a fade.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { SplitText } from 'gsap/SplitText';
import { later, html, content } from '../../src/demo-kit/index.js';
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
  const [, , p2, p3, p4] = magazine.longRead;
  const sections = [
    ['She reads the pan by sound, and has never used a thermometer.', p2],
    ['Every summer since 1788 is written down above the boiling house.', p3],
    ['The archive gets a building of its own.', p4],
  ];
  let cfg = { ...options };
  root.className = 'gr gr--wait';
  root.innerHTML = html`
    <article class="gr__article ac-wrap ac-wrap--narrow">
      <header class="gr__open">
        <h1 class="gr__title" id="gr-title" data-goo>${article.title}</h1>
        <p class="gr__dek">${article.dek}</p>
      </header>
      ${sections.map(([h, p], i) => html`<section class="gr__sec" aria-labelledby="gr-h${i}"><h2 class="gr__h2" id="gr-h${i}" data-goo>${h}</h2><p>${p}</p></section>`)}
    </article>
    <svg class="gr__defs" aria-hidden="true" focusable="false" width="0" height="0"><defs data-defs></defs></svg>`;

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
