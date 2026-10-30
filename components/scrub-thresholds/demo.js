// Scrub thresholds — Ostra's lamp in an evening room, with the two lines of copy it plays. One linear timeline
// scrubs the picture across a 400 svh sticky stage: the light warms from off to an evening glow and the dial turns.
// The copy is never scrubbed: each block is a paused timeline, and the scrub's onUpdate only checks which side of
// its window the progress is on, playing it in (timeScale 1.5) or reversing it out faster (3.5) once per crossing.
// Reduced: the light still follows, nothing moves, copy fades. Static: snaps.
import './demo.css';
import { html, raw, content } from '../../src/demo-kit/index.js';
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
    <section class="st__scene" data-scene aria-label="${lamp.name}">
      <div class="st__stage">
        <div class="st__room" data-room>
          <div class="st__figure"><div class="st__lampbox"><span class="st__glow" aria-hidden="true"></span>${raw(LAMP)}</div></div>
          <div class="st__copy">
            <p class="st__lines" data-copy><span class="st__line">Turn the dial slowly.</span><span class="st__line">It warms before it brightens.</span></p>
            <p class="st__lines st__lines--final" data-final><span class="st__line">Then it glows</span><span class="st__line">all evening.</span></p>
          </div>
        </div>
        <p class="ac-stage__note"><span>${shop.name} · lamp launch</span></p>
      </div>
    </section>`;
  root.classList.toggle('st--still', !spatial);

  const scene = root.querySelector('[data-scene]');
  const room = root.querySelector('[data-room]');
  const dial = root.querySelector('[data-dial]');
  const copyLines = [...root.querySelectorAll('[data-copy] .st__line')];
  const finalLines = [...root.querySelectorAll('[data-final] .st__line')];

  // The picture, from one value: the light, the room's warmth and (full tier only) the dial and glow.
  const paint = (v) => {
    room.style.setProperty('--on', v.toFixed(4));
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

    // The picture: one linear scrub, the only thing attached to the scroll.
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
      .to(prog, { v: 1, duration: 1, onUpdate: () => paint(prog.v) }, 0);
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
