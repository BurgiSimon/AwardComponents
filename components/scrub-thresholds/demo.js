// Scrub thresholds — a lamp launch. One linear timeline scrubs the picture across a 400 svh sticky stage: the light
// warms from off to an evening glow, the dial turns, the readouts count, and an Off/On label flips with two
// 0.001 s tweens at the half-way mark. The copy is never scrubbed: each block is a paused timeline, and the scrub's
// onUpdate only checks which side of its window the progress is on, playing it in (timeScale 1.5) or reversing it
// out faster (3.5) once per crossing. Reduced: the light still follows, nothing moves, copy fades. Static: snaps.
import './demo.css';
import { on, html, raw, content, formatPrice } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const LAMP = `
  <svg class="st__lamp" viewBox="0 0 400 520" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="st-opal" cx="40%" cy="36%" r="70%"><stop offset="0" class="st__opal-a"/><stop offset="1" class="st__opal-b"/></radialGradient>
      <radialGradient id="st-lit" cx="50%" cy="45%" r="62%"><stop offset="0" class="st__lit-a"/><stop offset=".7" class="st__lit-b"/><stop offset="1" class="st__lit-c"/></radialGradient>
      <linearGradient id="st-brass" x1="0" x2="1"><stop offset="0" class="st__brass-a"/><stop offset=".45" class="st__brass-b"/><stop offset="1" class="st__brass-c"/></linearGradient>
    </defs>
    <ellipse class="st__pool" cx="200" cy="486" rx="190" ry="26"/>
    <rect x="193" y="318" width="14" height="150" rx="3" fill="url(#st-brass)"/>
    <path d="M130 470 h140 v10 a70 13 0 0 1 -140 0 z" fill="url(#st-brass)"/>
    <ellipse cx="200" cy="470" rx="70" ry="13" class="st__brass-top"/>
    <g class="st__dial" data-dial><circle cx="0" cy="0" r="9" class="st__knob"/><path d="M0 -8 V-2" class="st__notch"/></g>
    <circle cx="200" cy="208" r="124" fill="url(#st-opal)"/>
    <circle cx="200" cy="208" r="124" fill="url(#st-lit)" class="st__lit"/>
    <ellipse cx="160" cy="150" rx="34" ry="20" class="st__shine" transform="rotate(-28 160 150)"/>
    <rect x="182" y="326" width="36" height="14" rx="4" fill="url(#st-brass)"/>
  </svg>`;

export default function mount(root, options, ctx) {
  const { shop } = content;
  const lamp = shop.products.find((p) => p.id === 'luma-lamp');
  let cfg = { ...options };
  const tier = ctx.motion;
  const spatial = tier === 'full';

  root.className = 'st';
  root.innerHTML = html`
    <header class="ac-bar st__bar">
      <a class="ac-brand" href="#top">${shop.name}</a>
      <nav aria-label="Shop"><a href="#top">Lighting</a><a href="#top">Vases</a><a href="#top">Journal</a></nav>
      <a class="st__bag" href="#top">Bag <span class="ac-num">0</span></a>
    </header>

    <section class="st__scene" data-scene aria-labelledby="st-title">
      <div class="st__stage">
        <div class="st__room" data-room>
          <div class="st__hud">
            <h1 class="ac-label st__name" id="st-title">${lamp.name} · ${lamp.colours[0]} glass</h1>
            <p class="ac-label st__read" aria-hidden="true">
              <span><b data-kelvin>1,800</b> K</span>
              <span><b data-lumen>000</b> lm</span>
              <span class="st__step"><span data-step="off">Off</span><span data-step="on">On</span></span>
            </p>
          </div>
          <div class="st__figure"><div class="st__lampbox"><span class="st__glow" aria-hidden="true"></span>${raw(LAMP)}</div></div>
          <div class="st__copy">
            <p class="st__lines" data-copy><span class="st__line">Turn the dial slowly.</span><span class="st__line">It warms before it brightens.</span></p>
            <p class="st__lines st__lines--final" data-final><span class="st__line">Then it glows</span><span class="st__line">all evening.</span></p>
          </div>
        </div>
      </div>
    </section>

    <section class="st__buy ac-wrap" aria-labelledby="st-buy">
      <div class="st__buy-copy">
        <p class="ac-label">${lamp.material}</p>
        <h2 class="ac-h1" id="st-buy">${lamp.name}, ${formatPrice(lamp.price)}.</h2>
        <p class="ac-lede">A dimmer in the base runs from 1,800 K candlelight to 2,700 K reading light. ${lamp.dims.h} × ${lamp.dims.d} cm, ${lamp.weight}.</p>
      </div>
      <div class="st__buy-actions">
        <fieldset class="st__sizes"><legend class="ac-label">Size</legend>${lamp.sizes.map((s, i) => html`<label><input type="radio" name="st-size" value="${s}" ${i === 0 ? 'checked' : ''}><span>${s}</span></label>`)}</fieldset>
        <a class="ac-btn ac-btn--lg ac-btn--accent" href="#top">Add to bag</a>
      </div>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));
  root.classList.toggle('st--still', !spatial);

  const scene = root.querySelector('[data-scene]');
  const room = root.querySelector('[data-room]');
  const dial = root.querySelector('[data-dial]');
  const kelvin = root.querySelector('[data-kelvin]');
  const lumen = root.querySelector('[data-lumen]');
  const steps = { off: root.querySelector('[data-step="off"]'), on: root.querySelector('[data-step="on"]') };
  const copyLines = [...root.querySelectorAll('[data-copy] .st__line')];
  const finalLines = [...root.querySelectorAll('[data-final] .st__line')];

  // The picture, from one value: the light, the room's warmth, the readouts and (full tier only) the dial and glow.
  const paint = (v) => {
    room.style.setProperty('--on', v.toFixed(4));
    kelvin.textContent = Math.round(1800 + v * 900).toLocaleString('en-GB');
    lumen.textContent = String(Math.round(v * 420)).padStart(3, '0');
    if (spatial) dial.setAttribute('transform', `translate(252 476) rotate(${(-135 + v * 270).toFixed(1)})`);
  };
  dial.setAttribute('transform', 'translate(252 476) rotate(-135)');
  paint(0);

  // Each copy block owns a window [from, to) of the scrub's progress, an entrance and a faster exit speed.
  const beats = () => {
    const from = cfg.copyIn / 100;
    const to = Math.max(from + 0.05, cfg.copyOut / 100);
    const fin = Math.max(to + 0.02, cfg.finalAt / 100);
    return [
      { lines: copyLines, from, to, inSpeed: cfg.inSpeed, outSpeed: cfg.outSpeed },
      { lines: finalLines, from: fin, to: Infinity, inSpeed: cfg.inSpeed * 0.83, outSpeed: cfg.outSpeed },
    ];
  };
  let BEATS = beats();

  useLenis(ctx);
  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  let tls = [];
  const inside = [false, false];
  let lastP = 0;
  // Only a change of side does anything: one play() or reverse() per crossing, then the line runs on its own clock.
  const gate = (p, instant) => {
    lastP = p;
    BEATS.forEach((b, i) => {
      const now = p >= b.from && p < b.to;
      if (now === inside[i] && !instant) return;
      inside[i] = now;
      const tl = tls[i];
      if (tier === 'static' || instant) tl.progress(now ? 1 : 0).pause();
      else if (now) tl.timeScale(b.inSpeed).play();
      else tl.timeScale(b.outSpeed).reverse();
    });
  };

  context.add(() => {
    // The copy: paused timelines, never attached to the scroll. Reduced keeps the fade and drops the rise.
    tls = BEATS.map((b) => gsap.timeline({ paused: true }).fromTo(b.lines,
      { autoAlpha: 0, yPercent: spatial ? 60 : 0 },
      { autoAlpha: 1, yPercent: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }));

    // The picture: one linear scrub; the Off/On step flips with two 0.001 s tweens at 0.5, so scrubbing back
    // across the middle flips it back exactly.
    const prog = { v: 0 };
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: scene,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onRefresh: (self) => gate(self.progress, true),
        onUpdate: (self) => gate(self.progress, false),
      },
    })
      .to(prog, { v: 1, duration: 1, onUpdate: () => paint(prog.v) }, 0)
      .to(steps.off, { autoAlpha: 0, duration: 0.001 }, 0.5)
      .to(steps.on, { autoAlpha: 1, duration: 0.001 }, 0.5);
  });
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return {
    update(next, changed) {
      cfg = { ...next };
      BEATS = beats();
      if (changed.some((c) => c === 'copyIn' || c === 'copyOut' || c === 'finalAt')) gate(lastP, true);
      return undefined;
    },
  };
}
