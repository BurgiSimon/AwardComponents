// Counter preloader — Signal festival's first visit: the counting panel, and after it one headline that rises. A
// fixed panel counts real promises (the type, the decode of each of the site's first pictures, the programme data):
// every `tick` ms the shown number jumps 3–14 toward done ÷ total and never past it, holds at 100, then lifts out of
// its mask while the panel leaves (whole, or as six strips) and the headline rises by lines. A sessionStorage flag
// skips it on repeat visits. Reduced: the count and a 300 ms hold, then a fade with the lines in place. Static: no
// panel at all.
import './demo.css';
import { on, html, raw, photos, image, content, colour } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const KEY = 'signal:preloaded';
const STRIPS = 6;
const seen = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = (on) => { try { if (on) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch { /* storage blocked: every visit is a first visit */ } };
const MARK = raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/></svg>');

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  // The site's first pictures, decoded off the page: what a real first visit would wait for before the hero shows.
  const pics = photos({ tags: ['night'], count: 1, seed: 'cp-hero' }).concat(photos({ tags: ['people'], count: 3, seed: 'cp-days' }));
  root.className = 'cp';
  root.innerHTML = html`
    <main class="ac-stage cp__stage" data-page>
      <h1 class="ac-display cp__title"><span class="cp__mask"><span class="cp__line">Three days,</span></span><span class="cp__mask"><span class="cp__line">four stages.</span></span></h1>
      <p class="ac-stage__note"><span>${festival.name} · first visit</span></p>
    </main>
    <div class="cp__pre" data-pre hidden>
      <div class="cp__strips" aria-hidden="true">${Array.from({ length: STRIPS }, () => raw('<span></span>'))}</div>
      <div class="cp__pre-in">
        <div class="cp__pre-top" data-fadeout>
          <span class="ac-brand cp__brand">${MARK}${festival.name}</span>
          <button class="cp__skip" type="button" data-skip>Skip intro</button>
        </div>
        <div class="cp__pre-main">
          <p class="ac-label cp__pre-label" data-fadeout>Loading the 2027 programme</p>
          <p class="cp__count" aria-hidden="true"><span class="cp__mask"><span class="cp__line" data-count>000</span></span></p>
          <p class="cp__word" aria-hidden="true"><span class="cp__mask"><span class="cp__line" data-word>${festival.name}</span></span></p>
          <ul class="cp__signals" role="list" aria-hidden="true">
            <li data-signal="type"><span>Type</span><span data-state>Waiting</span></li>
            <li data-signal="pictures"><span>Pictures</span><span data-state>0 of ${pics.length}</span></li>
            <li data-signal="programme"><span>Programme</span><span data-state>Waiting</span></li>
          </ul>
        </div>
        <div class="cp__track" aria-hidden="true" data-fadeout><span class="cp__fill"></span><span class="cp__readout ac-num" data-readout>0%</span></div>
        <p class="sr-only" role="status" aria-live="polite" data-status></p>
      </div>
    </div>
    <div class="cp__toast ac-card" data-toast hidden>
      <span>Seen this session, so the intro stays out of the way.</span>
      <button class="ac-btn ac-btn--sm" type="button" data-again>Play it again</button>
    </div>`;

  const page = root.querySelector('[data-page]');
  const pre = root.querySelector('[data-pre]');
  const count = root.querySelector('[data-count]');
  const word = root.querySelector('[data-word]');
  const readout = root.querySelector('[data-readout]');
  const status = root.querySelector('[data-status]');
  const toast = root.querySelector('[data-toast]');
  const strips = [...root.querySelectorAll('.cp__strips span')];
  const signals = [...root.querySelectorAll('[data-signal]')];
  const lines = [...root.querySelectorAll('.cp__title .cp__line')];
  const fadeouts = [...root.querySelectorAll('[data-fadeout]')];
  const { gsap } = useGsap(ctx, root);
  const full = ctx.motion === 'full';

  // Everything one run starts, so Replay, a control change or unmount can stop it mid-way.
  let runId = 0;
  let timers = [];
  let tl = null;
  let risen = false;
  const after = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const repeat = (fn, ms) => { const t = setInterval(fn, ms); timers.push(t); return t; };
  const stop = () => {
    runId++;
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    timers = [];
    tl?.kill();
    tl = null;
  };
  ctx.onCleanup(stop);

  const apply = () => {
    root.dataset.style = cfg.style;
    root.style.setProperty('--cp-accent', colour(cfg.accent));
  };
  const show = (n) => {
    count.textContent = String(n).padStart(3, '0');
    readout.textContent = `${n}%`;
    pre.style.setProperty('--p', String(n / 100));
  };
  const mark = (name, text, done) => {
    const li = signals.find((s) => s.dataset.signal === name);
    li.querySelector('[data-state]').textContent = text;
    li.classList.toggle('is-done', done);
  };

  // The arrival: the headline rises by lines.
  const rise = () => {
    risen = true;
    if (!full) { gsap.set(lines, { yPercent: 0 }); return null; }
    return gsap.fromTo(lines, { yPercent: 120 }, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.09 });
  };

  // The panel leaves the page and the accessibility tree; the flag marks this session as seen.
  const release = () => {
    pre.hidden = true;
    pre.setAttribute('aria-hidden', 'true');
    page.inert = false;
    remember(true);
  };
  const skip = () => {
    const rising = risen;
    stop();
    release();
    if (rising) gsap.set(lines, { yPercent: 0 }); else rise();
  };

  const start = () => {
    stop();
    const id = runId;
    risen = false;
    toast.hidden = true;
    gsap.set([pre, count, word, ...strips, ...signals, ...fadeouts], { clearProps: 'all' });
    gsap.set(lines, { yPercent: full ? 120 : 0 });
    signals.forEach((s) => s.classList.remove('is-done'));
    mark('type', 'Waiting', false);
    mark('pictures', `0 of ${pics.length}`, false);
    mark('programme', 'Waiting', false);
    show(0);
    pre.hidden = false;
    pre.removeAttribute('aria-hidden');
    page.inert = true;
    status.textContent = `Loading ${festival.edition}`;

    // The thumbnail: a believable moment mid-load, held still.
    if (ctx.capture) {
      show(64);
      mark('type', 'Ready', true);
      mark('pictures', '3 of 4', false);
      return;
    }

    // 1. Real signals: the type, each picture's decode, and the programme (a stand-in for the page's data request).
    const imgs = pics.map((p) => image(p, { eager: true }));
    let decoded = 0;
    const live = (fn) => () => { if (id === runId) fn(); };
    const tasks = [
      (document.fonts?.ready || Promise.resolve()).then(live(() => { mark('type', 'Ready', true); status.textContent = 'Type ready'; })),
      ...imgs.map((img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(live(() => {
        decoded++;
        mark('pictures', decoded === imgs.length ? 'Ready' : `${decoded} of ${imgs.length}`, decoded === imgs.length);
        if (decoded === imgs.length) status.textContent = 'Pictures ready';
      }))),
      new Promise((r) => after(r, 900 + Math.random() * 500)).then(live(() => { mark('programme', 'Ready', true); status.textContent = 'Programme ready'; })),
    ];
    let real = 0;
    let shown = 0;
    let settled = 0;
    tasks.forEach((p) => p.then(live(() => { real = ++settled / tasks.length; })));

    // 2. The shown number chases the real share in uneven jumps but never overtakes it.
    const tick = repeat(() => {
      const ceiling = Math.floor(real * 100);
      if (shown >= ceiling) return;
      shown += Math.min(ceiling - shown, 3 + Math.floor(Math.random() * 12));
      show(shown);
    }, cfg.tick);

    // 3. At 100: hold for a beat, then leave.
    const t0 = performance.now();
    Promise.all(tasks).then(live(() => {
      const wait = repeat(() => {
        if (shown < 97 && performance.now() - t0 < 4000) return;
        clearInterval(wait);
        clearInterval(tick);
        show(100);
        status.textContent = 'Loaded';
        after(leave, full ? cfg.hold : 300);
      }, 60);
    }));
  };

  // The exit: the number lifts out of its mask, then the panel goes (whole or in strips) and is released at once,
  // while the headline is still rising behind it.
  const leave = () => {
    if (!full) {
      rise();
      tl = gsap.timeline().to(pre, { autoAlpha: 0, duration: 0.4, ease: 'none' }).call(release);
      return;
    }
    tl = gsap.timeline()
      .to([count, word], { yPercent: -120, duration: 0.8, ease: 'expo.in' })
      .to(signals, { autoAlpha: 0, duration: 0.3, stagger: 0.05 }, '<')
      .to(fadeouts, { autoAlpha: 0, duration: 0.3 }, '<0.25')
      .addLabel('exit', '-=0.2');
    if (cfg.exit === 'curtain') tl.to(strips, { yPercent: -100, duration: 0.85, ease: 'expo.inOut', stagger: 0.06 }, 'exit');
    else tl.to(pre, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 'exit');
    tl.call(release).add(rise(), 'exit+=0.25');
  };

  const replay = () => { remember(false); start(); };
  on(ctx, root.querySelector('[data-skip]'), 'click', skip);
  on(ctx, root.querySelector('[data-again]'), 'click', replay);

  apply();
  if (ctx.motion === 'static') {
    rise();
  } else if (cfg.repeat && seen() && !ctx.capture) {
    // Repeat visit: no gate at all; the headline still arrives.
    rise();
    toast.hidden = false;
  } else {
    start();
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.some((k) => k !== 'repeat') && ctx.motion !== 'static') start();
    },
    action(name) { if (name === 'replay') replay(); },
  };
}
