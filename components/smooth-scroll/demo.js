// Smooth scroll — a Fieldnote long read on the boot every scroll demo stands on. Lenis (lerp 0.1, autoRaf off) is
// driven by gsap.ticker with lagSmoothing(0) and feeds ScrollTrigger on each scroll (useLenis does exactly that).
// Text work waits for document.fonts.ready: the headline lines rise (yPercent 120 → 0, 1.4 s expo.out, stagger
// 0.09), sections reveal once at 80 % of the viewport, and the reading bar is a linear scrub (the smoothing already
// lives in Lenis). A readout samples velocity and progress while the page moves and sleeps when it rests.
// Reduced motion: no Lenis (native scroll), the lines fade in 0.4 s; static: everything set at once.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, ticker, damp, clamp, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const EXPO_OUT = (t) => Math.min(1, 1.001 - 2 ** (-10 * t)); // Lenis' own default curve for duration mode
const SPARK = 48;

// The magazine's long read, extended: the shared copy plus the paragraphs a twelve-minute piece needs.
const MORE = [
  'The brine comes from a layer of groundwater under the meadows, three times saltier than the Kattegat. It is pumped into iron pans the size of a rowing boat and boiled for a day and a night, until the salt starts to grow at the edges like frost on a window.',
  'In the twelfth century the island was nearly stripped of trees to feed those fires. The dunes that cover the south coast today are the price of that salt: once the forest went, the sand had nothing to hold on to.',
  'Halden’s architects spent a winter on the island before drawing anything. Their first sketch was a single line, the horizon as seen from the pans, and it became the window.',
  'On the last evening of the season Birthe lets the fire die on its own. She scrapes the final crust into a wooden box, writes the weight in the ledger and walks home along the beach in the dark.',
];

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const story = magazine.articles[0];
  const next = magazine.articles[3];
  const P = magazine.longRead;
  const [lead] = photos({ tags: ['landscape'], count: 1, seed: 'ss-lead', orientation: 'portrait' });
  const [wide] = photos({ tags: ['water'], not: ['art'], count: 1, seed: 'ss-wide', orientation: 'landscape' });
  const pair = photos({ tags: ['texture'], count: 1, seed: 'ss-pair-a' }).concat(photos({ tags: ['architecture'], not: ['city'], count: 1, seed: 'ss-pair-b' }));
  const [nextPic] = photos({ tags: ['water'], not: ['art'], count: 1, seed: 'ss-next-water' });
  const fig = (p, cls, sizes, cap, eager = false) => html`<figure class="${cls}" data-reveal><span class="ac-media">${raw(imageHTML(p, { sizes, alt: '', eager }))}</span><figcaption class="ac-small">${cap}</figcaption></figure>`;
  let cfg = { ...options };

  root.className = 'ss';
  root.innerHTML = html`
    <a class="ss__skip ac-btn ac-btn--sm" href="#ss-main">Skip to the article</a>
    <div class="ss__progress" aria-hidden="true"><span data-bar></span></div>
    <header class="ac-bar ss__bar">
      <a class="ss__brand" href="#top">${magazine.name}</a>
      <span class="ss__issue ac-label">${magazine.issue}</span>
      <nav aria-label="Sections">${['Places', 'Architecture', 'Craft', 'Culture'].map((s) => html`<a href="#top"${s === story.section ? raw(' aria-current="page"') : ''}>${s}</a>`)}</nav>
      <a class="ac-btn ac-btn--sm ss__sub" href="#top">Subscribe</a>
    </header>
    <main id="ss-main" tabindex="-1">
      <article class="ss__article" aria-labelledby="ss-title">
        <header class="ss__head ac-wrap">
          <div class="ss__titles">
            <p class="ac-label">${story.section} · ${story.read} read</p>
            <h1 class="ss__title" id="ss-title"><span class="ss__mask"><span class="ss__line">Salt</span></span> <span class="ss__mask"><span class="ss__line"><em>and time</em></span></span></h1>
            <p class="ac-lede ss__dek">${story.dek} Four months of fires, one ledger since 1788 and a building that lets the dune blow over it.</p>
            <p class="ss__byline">Words by <strong>${story.author}</strong><span aria-hidden="true"> · </span>Photographs by <strong>Ellis Brandt</strong><time class="ac-label" datetime="2027-03-14">14 March 2027</time></p>
          </div>
          ${fig(lead, 'ss__lead', '(max-width: 760px) 100vw, 46vw', 'The boiling house at Vesterø Havn, lit in May.', true)}
        </header>
        <div class="ss__body">
          <p class="ss__p ss__p--first" data-reveal>${P[0]}</p>
          <p class="ss__p" data-reveal>${P[1]}</p>
          ${fig(wide, 'ss__wide', '(max-width: 1100px) 100vw, 1080px', 'Brine pans at the saltworks: iron, wood smoke and a day and a night per batch.')}
          <h2 class="ss__h2" data-reveal><span class="ac-label">I</span>The pans</h2>
          <p class="ss__p" data-reveal>${P[2]}</p>
          <p class="ss__p" data-reveal>${MORE[0]}</p>
          <blockquote class="ss__quote" data-reveal data-quote>
            <p>“A low roll means the water is too deep. A hiss means it is nearly done.”</p>
            <footer class="ac-label">Birthe, thirty-one summers at the pans</footer>
          </blockquote>
          <p class="ss__p" data-reveal>${MORE[1]}</p>
          <h2 class="ss__h2" data-reveal><span class="ac-label">II</span>The ledgers</h2>
          <p class="ss__p" data-reveal>${P[3]}</p>
          <div class="ss__pair" data-reveal>
            ${fig(pair[0], 'ss__half', '(max-width: 760px) 50vw, 340px', 'Ledger, 1788.')}
            ${fig(pair[1], 'ss__half', '(max-width: 760px) 50vw, 340px', 'The new reading room, half in the dune.')}
          </div>
          <p class="ss__p" data-reveal>${P[4]}</p>
          <p class="ss__p" data-reveal>${MORE[2]}</p>
          <p class="ss__p ss__p--last" data-reveal>${MORE[3]}</p>
        </div>
      </article>
      <aside class="ss__next ac-wrap" aria-labelledby="ss-next">
        <p class="ac-label">Next in ${next.section}</p>
        <a class="ss__next-link" href="#top">
          <span class="ac-media">${raw(imageHTML(nextPic, { sizes: '(max-width: 760px) 100vw, 40vw', alt: '' }))}</span>
          <span class="ss__next-copy"><strong class="ss__next-title" id="ss-next">${next.title}</strong><span class="ac-lede">${next.dek}</span><span class="ac-label">${next.author} · ${next.read}</span></span>
        </a>
      </aside>
    </main>
    <footer class="ss__foot ac-wrap ac-small"><span>${magazine.name} · ${magazine.issue}</span><span>Printed twice a year in Aarhus</span></footer>
    <div class="ss__readout" aria-hidden="true" data-readout>
      <p class="ss__engine"><span class="ss__dot"></span><span data-engine></span></p>
      <dl>
        <div><dt>Velocity</dt><dd data-vel>0 px/s</dd></div>
        <div><dt>Progress</dt><dd data-prog>0 %</dd></div>
      </dl>
      <svg class="ss__spark" viewBox="0 0 ${SPARK - 1} 24" preserveAspectRatio="none"><path class="ss__spark-zero" d="M0 12H${SPARK - 1}"/><path class="ss__spark-line" data-spark/></svg>
    </div>`;

  const main = root.querySelector('#ss-main');
  const bar = root.querySelector('[data-bar]');
  const readout = root.querySelector('[data-readout]');
  const engine = root.querySelector('[data-engine]');
  const velEl = root.querySelector('[data-vel]');
  const progEl = root.querySelector('[data-prog]');
  const spark = root.querySelector('[data-spark]');
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  // 1. One clock: useLenis puts Lenis on gsap.ticker (lagSmoothing 0) and wires lenis 'scroll' to ScrollTrigger.update.
  //    It returns null under reduced motion and static, where native scroll is the path.
  const lenis = useLenis(ctx, {
    lerp: cfg.lerp,
    wheelMultiplier: cfg.wheel,
    syncTouch: cfg.touch,
    ...(cfg.mode === 'duration' ? { duration: cfg.duration, easing: EXPO_OUT } : {}),
  });
  const tuneLenis = () => {
    if (!lenis) return;
    const o = lenis.options;
    if (cfg.mode === 'duration') { o.duration = cfg.duration; o.easing = EXPO_OUT; } else { o.duration = undefined; o.easing = undefined; o.lerp = cfg.lerp; }
    o.wheelMultiplier = cfg.wheel;
    if (lenis.virtualScroll?.options) lenis.virtualScroll.options.wheelMultiplier = cfg.wheel;
    o.syncTouch = cfg.touch;
  };
  const label = () => {
    if (!lenis) { engine.textContent = 'Native · reduced motion'; return; }
    engine.textContent = cfg.mode === 'duration' ? `Lenis · ${cfg.duration.toFixed(1)} s expo-out` : `Lenis · lerp ${cfg.lerp.toFixed(2)}`;
  };
  const apply = () => {
    tuneLenis();
    label();
    readout.hidden = !cfg.readout;
  };
  apply();

  // 2. Reveal vocabulary, chosen once from the motion tier. Static: no hidden states at all.
  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  const lines = [...root.querySelectorAll('.ss__line')];
  if (ctx.motion !== 'static') {
    root.classList.add('ss--reveal');
    gsap.set(lines, ctx.motion === 'full' ? { yPercent: 120 } : { autoAlpha: 0 });
    document.fonts.ready.then(() => {
      if (ctx.signal.aborted) return;
      context.add(() => {
        gsap.to(lines, ctx.motion === 'full'
          ? { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.09 }
          : { autoAlpha: 1, duration: 0.4, stagger: 0.03 });
        // 3. Sections reveal once on entry; a class toggle, so CSS owns the reduced variant.
        root.querySelectorAll('[data-reveal]').forEach((el) => {
          ScrollTrigger.create({ trigger: el, start: 'top 80%', once: true, onEnter: () => el.classList.add('is-in') });
        });
        // 4. The reading bar: a linear scrub across the article (ease none; Lenis already smooths).
        gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.ss__article', start: 'top top', end: 'bottom bottom', scrub: true } });
        ScrollTrigger.refresh();
      });
    });
  } else {
    gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.ss__article', start: 'top top', end: 'bottom bottom', scrub: true } });
  }
  on(ctx, window, 'load', () => ScrollTrigger.refresh(), { once: true });

  // 5. The readout: samples while the page moves, sleeps 400 ms after it rests (the last gesture's curve stays drawn). Velocity in px/s from the rendered
  //    position (Lenis' animated scroll, or the native one), damped so the number is readable.
  const history = new Float32Array(SPARK);
  let lastY = lenis ? lenis.animatedScroll : window.scrollY;
  let vel = 0;
  let idle = 0;
  let awake = false;
  const position = () => (lenis ? lenis.animatedScroll : window.scrollY);
  const draw = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const y = position();
    const v = Math.round(vel);
    velEl.textContent = `${v > 0 ? '↓ ' : v < 0 ? '↑ ' : ''}${Math.abs(v).toLocaleString('en-GB')} px/s`;
    progEl.textContent = `${Math.round(clamp(y / max, 0, 1) * 100)} %`;
    const peak = Math.max(1200, ...history.map(Math.abs));
    let d = '';
    history.forEach((h, i) => { d += `${i ? 'L' : 'M'}${i} ${(12 - (h / peak) * 11).toFixed(2)}`; });
    spark.setAttribute('d', d);
  };
  const frame = (dt) => {
    const y = position();
    const instant = (y - lastY) / Math.max(dt, 1 / 240);
    lastY = y;
    vel = damp(vel, instant, 14, dt);
    history.copyWithin(0, 1);
    history[SPARK - 1] = vel;
    idle = Math.abs(instant) < 0.5 ? idle + dt : 0;
    draw();
    if (idle > 0.4 && Math.abs(vel) < 1) { vel = 0; draw(); sleep(); }
  };
  const wake = () => { if (!awake && cfg.readout) { awake = true; idle = 0; lastY = position(); readout.classList.add('is-live'); ticker.add(frame); } };
  const sleep = () => { if (awake) { awake = false; readout.classList.remove('is-live'); ticker.remove(frame); } };
  ctx.onCleanup(sleep);
  on(ctx, window, 'scroll', wake, { passive: true });
  on(ctx, window, 'resize', draw);
  draw();

  // Skip link: move focus to the article and scroll there on the same clock.
  const glideTo = (target, offset = 0) => {
    if (lenis) { lenis.scrollTo(target, { offset }); return; }
    const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: 'auto' });
  };
  on(ctx, root.querySelector('.ss__skip'), 'click', (e) => {
    e.preventDefault();
    main.focus({ preventScroll: true });
    glideTo(root.querySelector('.ss__body'), -24);
  });

  return {
    update(next) {
      cfg = { ...next };
      apply();
      if (!cfg.readout) sleep();
    },
    action(id) {
      if (id === 'glide') glideTo(root.querySelector('[data-quote]'), -Math.round(innerHeight * 0.3));
      if (id === 'top') glideTo(0);
    },
  };
}
