// Smooth scroll — a short Fieldnote long read (title, dek, four paragraphs, two pictures) on the boot every scroll
// demo stands on. Lenis (lerp 0.1, autoRaf off) is driven by gsap.ticker with lagSmoothing(0) and feeds ScrollTrigger
// on each scroll (useLenis does exactly that). Text work waits for document.fonts.ready: the headline lines rise
// (yPercent 120 → 0, 1.4 s expo.out, stagger 0.09), sections reveal once at 80 % of the viewport, and the reading bar
// is a linear scrub (the smoothing already lives in Lenis). A readout samples velocity and progress while the page
// moves and sleeps when it rests. Reduced motion: no Lenis (native scroll), the lines fade in 0.4 s; static:
// everything set at once.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, ticker, damp, clamp, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const EXPO_OUT = (t) => Math.min(1, 1.001 - 2 ** (-10 * t)); // Lenis' own default curve for duration mode
const SPARK = 48;

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const story = magazine.articles[0];
  const P = magazine.longRead;
  const [lead] = photos({ tags: ['landscape'], count: 1, seed: 'ss-lead', orientation: 'portrait' });
  const [wide] = photos({ tags: ['water'], not: ['art'], count: 1, seed: 'ss-wide', orientation: 'landscape' });
  const fig = (p, cls, sizes, cap, eager = false) => html`<figure class="${cls}" data-reveal><span class="ac-media">${raw(imageHTML(p, { sizes, alt: '', eager }))}</span><figcaption class="ac-small">${cap}</figcaption></figure>`;
  let cfg = { ...options };

  root.className = 'ss';
  root.innerHTML = html`
    <a class="ss__skip ac-btn ac-btn--sm" href="#ss-main">Skip to the article</a>
    <div class="ss__progress" aria-hidden="true"><span data-bar></span></div>
    <main id="ss-main" tabindex="-1">
      <article class="ss__article" aria-labelledby="ss-title">
        <header class="ss__head ac-wrap">
          <div class="ss__titles">
            <h1 class="ss__title" id="ss-title"><span class="ss__mask"><span class="ss__line">Salt</span></span> <span class="ss__mask"><span class="ss__line"><em>and time</em></span></span></h1>
            <p class="ac-lede ss__dek">${story.dek}</p>
          </div>
          ${fig(lead, 'ss__lead', '(max-width: 760px) 100vw, 46vw', 'The boiling house at Vesterø Havn, lit in May.', true)}
        </header>
        <div class="ss__body">
          <p class="ss__p ss__p--first" data-reveal>${P[0]}</p>
          <p class="ss__p" data-reveal>${P[2]}</p>
          ${fig(wide, 'ss__wide', '(max-width: 1100px) 100vw, 1080px', 'Brine pans at the saltworks: iron, wood smoke and a day and a night per batch.')}
          <p class="ss__p" data-reveal>${P[3]}</p>
          <p class="ss__p ss__p--last" data-reveal>${P[4]}</p>
        </div>
      </article>
    </main>
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
      if (id === 'glide') glideTo(document.documentElement.scrollHeight);
      if (id === 'top') glideTo(0);
    },
  };
}
