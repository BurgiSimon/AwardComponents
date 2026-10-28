// Flicker text — Signal's night programme. The sign and each act name are split into glyph spans (words kept whole,
// a visually hidden copy for assistive tech) after the fonts settle; a flicker runs every glyph through the opacity
// ladder [0, 1, 0, 0, 1, 1] as GSAP keyframes with ease none, staggered. The bloom behind the sign follows how much of
// it is lit. Loop mode: a random glyph catches every 2–5 s, only while on screen. Reduced: everything lit, no replays.
import './demo.css';
import { on, whileVisible, html, content, colour } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const LADDER = [0, 1, 0, 0, 1, 1];
const ACTS = [
  { time: '21:30', act: 'Black Pine', stage: 'Hall 4' },
  { time: '23:00', act: 'Moss Theory', stage: 'The Crane' },
  { time: '00:30', act: 'Juno Park', stage: 'Hall 4' },
  { time: '02:00', act: 'Vesper Choir', stage: 'Greenhouse' },
];

// Glyph spans inside word spans (so a line never breaks mid-word), after a visually hidden copy of the text.
function split(el) {
  const text = el.textContent;
  el.textContent = '';
  const mirror = document.createElement('span');
  mirror.className = 'sr-only';
  mirror.textContent = text;
  const wrap = document.createElement('span');
  wrap.setAttribute('aria-hidden', 'true');
  text.split(' ').forEach((word, w, words) => {
    const ws = document.createElement('span');
    ws.className = 'fl__word';
    for (const ch of word) {
      const g = document.createElement('span');
      g.className = 'fl__glyph';
      g.textContent = ch;
      ws.append(g);
    }
    wrap.append(ws);
    if (w < words.length - 1) wrap.append(' ');
  });
  el.append(mirror, wrap);
  return [...wrap.querySelectorAll('.fl__glyph')];
}

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  root.className = 'fl';
  root.innerHTML = html`
    <header class="ac-bar fl__bar">
      <a class="ac-brand" href="#top">${festival.name}</a>
      <nav aria-label="Festival"><a href="#top">Line-up</a><a href="#top" aria-current="page">After dark</a><a href="#top">Tickets</a></nav>
    </header>
    <section class="fl__night ac-wrap" aria-labelledby="fl-sign">
      <div class="fl__bloom" aria-hidden="true"></div>
      <div class="fl__head">
        <p class="ac-label fl__label">${festival.name} after dark · ${festival.dates}</p>
        <h1 class="fl__sign" id="fl-sign" data-sign>Doors at 21:00</h1>
        <p class="fl__sub">Hall 4, the Crane and the Greenhouse stay open until three. Night tickets are €45, or free with a weekend pass.</p>
      </div>
      <ol class="fl__acts" role="list">
        ${ACTS.map((a) => html`<li><a class="fl__act" href="#top"><span class="fl__time ac-num">${a.time}</span><span class="fl__name" data-act>${a.act}</span><span class="fl__stage ac-label">${a.stage}</span></a></li>`)}
      </ol>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const night = root.querySelector('.fl__night');
  const signEl = root.querySelector('[data-sign]');
  const { gsap, context: g } = useGsap(ctx, root);
  const full = ctx.motion === 'full';
  let sign = [];
  let signTl = null;
  let fault = null;

  const apply = () => {
    root.style.setProperty('--fl-glow', String(cfg.glow));
    root.style.setProperty('--fl-tube', colour(cfg.colour));
  };
  apply();

  // How much of the sign is lit, for the bloom behind it.
  const bloom = () => {
    const lit = sign.reduce((s, el) => s + Number(gsap.getProperty(el, 'opacity')), 0) / (sign.length || 1);
    night.style.setProperty('--fl-lit', lit.toFixed(3));
  };

  const flicker = (glyphs, { shift = 0, onUpdate } = {}) => g.add(() => {
    const step = cfg.step / 1000;
    const each = cfg.stagger / 1000;
    const tl = gsap.timeline({ onUpdate });
    // Keyframes with ease none: hard steps, the whole character of the effect.
    tl.fromTo(glyphs, { opacity: 0 }, { keyframes: LADDER.map((o) => ({ opacity: o, duration: step })), ease: 'none', stagger: each }, 0);
    if (shift) tl.fromTo(glyphs, { x: shift }, { x: 0, duration: 0.8, ease: 'expo.out', stagger: each * 0.5 }, 0);
    return tl;
  });
  const playSign = (shift = 0) => {
    if (!full || !sign.length) return;
    signTl?.kill();
    signTl = flicker(sign, { shift, onUpdate: bloom });
  };

  // The faulty tube: one glyph catches, flickers and recovers, then the next one waits 2–5 s.
  const scheduleFault = () => {
    fault = gsap.delayedCall(2 + Math.random() * 3, () => {
      const pool = sign.filter((el) => el.textContent.trim());
      const el = pool[Math.floor(Math.random() * pool.length)];
      const step = cfg.step / 1000;
      g.add(() => gsap.to(el, { keyframes: [0.15, 1, 0.3, 0.1, 1].map((o) => ({ opacity: o, duration: step })), ease: 'none', onUpdate: bloom }));
      scheduleFault();
    });
  };
  let onScreen = false;
  const startLoop = () => { if (full && onScreen && cfg.trigger === 'loop' && !fault) scheduleFault(); };
  const stopLoop = () => { fault?.kill(); fault = null; };
  ctx.onCleanup(stopLoop);

  document.fonts.ready.then(() => {
    if (ctx.signal.aborted) return;
    sign = split(signEl);
    const acts = [...root.querySelectorAll('[data-act]')].map((el) => ({ el, glyphs: split(el) }));
    night.style.setProperty('--fl-lit', '1');

    // The thumbnail: the sign on, two tubes caught mid-flicker.
    if (ctx.capture) {
      gsap.set([sign[1], sign[8]], { opacity: 0.12 });
      night.style.setProperty('--fl-lit', '0.86');
      return;
    }
    if (!full) return;

    if (cfg.trigger !== 'hover') playSign();
    on(ctx, signEl, 'pointerenter', () => playSign(6));
    acts.forEach(({ el, glyphs }) => {
      const link = el.closest('a');
      let tl = null;
      const play = () => { tl?.kill(); tl = flicker(glyphs, { shift: 6 }); };
      on(ctx, link, 'pointerenter', play);
      on(ctx, link, 'focus', play);
    });
    whileVisible(ctx, signEl, () => { onScreen = true; startLoop(); }, () => { onScreen = false; stopLoop(); });
  });

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('trigger')) {
        stopLoop();
        if (cfg.trigger === 'loop') { playSign(); startLoop(); }
      }
      if (changed.includes('step') || changed.includes('stagger')) playSign();
    },
    action(id) { if (id === 'replay') playSign(); },
  };
}
