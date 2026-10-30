// Counter preloader — Signal festival's first visit. A fixed panel counts real promises (the type, each hero
// picture's decode, the programme data): every `tick` ms the shown number jumps 3–14 toward done ÷ total and never
// past it, holds at 100, then lifts out of its mask while the panel leaves (whole, or as six strips) and the hero
// headline rises by lines. A sessionStorage flag skips it on repeat visits. Reduced: the count and a 300 ms hold,
// then a fade with the lines in place. Static: no panel at all.
import './demo.css';
import { on, html, raw, photos, imageHTML, content, formatPrice, colour } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const KEY = 'signal:preloaded';
const STRIPS = 6;
const seen = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = (on) => { try { if (on) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch { /* storage blocked: every visit is a first visit */ } };
const MARK = raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/></svg>');

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  const pics = photos({ tags: ['night'], count: 1, seed: 'cp-hero' }).concat(photos({ tags: ['people'], count: 3, seed: 'cp-days' }));
  const days = [
    { day: 'Thu 12 Aug', acts: festival.lineup.slice(0, 3) },
    { day: 'Fri 13 Aug', acts: festival.lineup.slice(3, 6) },
    { day: 'Sat 14 Aug', acts: festival.lineup.slice(6, 9) },
  ];
  root.className = 'cp';
  root.innerHTML = html`
    <div class="cp__page" data-page>
      <header class="ac-bar cp__bar">
        <a class="ac-brand cp__brand" href="#top">${MARK}${festival.name}</a>
        <nav aria-label="Festival"><a href="#lineup">Line-up</a><a href="#lineup">Programme</a><a href="#lineup">Getting there</a></nav>
        <a class="ac-btn ac-btn--sm" href="#tickets">Tickets</a>
      </header>
      <main>
        <section class="cp__hero ac-wrap" aria-labelledby="cp-title">
          <div class="cp__copy">
            <p class="ac-label cp__fade">${festival.dates} · ${festival.place}</p>
            <h1 class="ac-display cp__title" id="cp-title"><span class="cp__mask"><span class="cp__line">Three days,</span></span><span class="cp__mask"><span class="cp__line">four stages.</span></span></h1>
            <p class="ac-lede cp__fade">Sixty acts on the harbour at Refshaleøen, from the Crane at dusk to Hall 4 until three in the morning.</p>
            <div class="cp__cta cp__fade">
              <a class="ac-btn ac-btn--lg ac-btn--accent" href="#tickets">Weekend pass — ${formatPrice(festival.tickets[1].price)}</a>
              <a class="ac-btn ac-btn--lg ac-btn--ghost" href="#lineup">See the line-up</a>
            </div>
          </div>
          <figure class="cp__fig">
            <div class="ac-media cp__pic">${raw(imageHTML(pics[0], { eager: true, sizes: '(max-width: 760px) 100vw, 36vw', alt: 'The harbour stage at night' }))}</div>
            <figcaption class="ac-label">Harbour stage, 2026</figcaption>
          </figure>
        </section>
        <section class="cp__days ac-wrap" id="lineup" aria-label="Headliners by day">
          ${days.map((d, i) => html`<article class="cp__day"><span class="ac-media cp__thumb">${raw(imageHTML(pics[i + 1], { eager: true, sizes: '64px', alt: '' }))}</span><div><p class="ac-label">${d.day}</p><p class="cp__acts">${d.acts.join(' · ')}</p></div></article>`)}
        </section>
      </main>
    </div>
    <div class="cp__pre" data-pre hidden>
      <div class="cp__strips" aria-hidden="true">${Array.from({ length: STRIPS }, () => raw('<span></span>'))}</div>
      <div class="cp__pre-in">
        <div class="cp__pre-top" data-fadeout>
          <span class="ac-brand cp__brand">${MARK}${festival.name}</span>
          <span class="ac-label cp__pre-meta">${festival.dates}</span>
          <button class="cp__skip" type="button" data-skip>Skip intro</button>
        </div>
        <div class="cp__pre-main">
          <p class="ac-label cp__pre-label" data-fadeout>Loading the 2027 programme</p>
          <p class="cp__count" aria-hidden="true"><span class="cp__mask"><span class="cp__line" data-count>000</span></span></p>
          <p class="cp__word" aria-hidden="true"><span class="cp__mask"><span class="cp__line" data-word>${festival.name}</span></span></p>
          <ul class="cp__signals" role="list" aria-hidden="true">
            <li data-signal="type"><span>Type</span><span data-state>Waiting</span></li>
            <li data-signal="pictures"><span>Pictures</span><span data-state>0 of 4</span></li>
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
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const page = root.querySelector('[data-page]');
  const pre = root.querySelector('[data-pre]');
  const count = root.querySelector('[data-count]');
  const word = root.querySelector('[data-word]');
  const readout = root.querySelector('[data-readout]');
  const status = root.querySelector('[data-status]');
  const toast = root.querySelector('[data-toast]');
  const strips = [...root.querySelectorAll('.cp__strips span')];
  const signals = [...root.querySelectorAll('[data-signal]')];
  const lines = [...root.querySelectorAll('.cp__hero .cp__line')];
  const fades = [...root.querySelectorAll('.cp__fade')];
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

  // The hero's arrival: the headline rises by lines, the rest fades up after it.
  const rise = () => {
    risen = true;
    if (!full) { gsap.set(lines, { yPercent: 0 }); gsap.set(fades, { autoAlpha: 1, y: 0 }); return null; }
    return gsap.timeline()
      .fromTo(lines, { yPercent: 120 }, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.09 })
      .fromTo(fades, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.07 }, 0.3);
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
    if (rising) { gsap.set(lines, { yPercent: 0 }); gsap.set(fades, { autoAlpha: 1, y: 0 }); } else rise();
  };

  const start = () => {
    stop();
    const id = runId;
    risen = false;
    toast.hidden = true;
    gsap.set([pre, count, word, ...strips, ...signals, ...fadeouts], { clearProps: 'all' });
    gsap.set(lines, { yPercent: full ? 120 : 0 });
    gsap.set(fades, { autoAlpha: 0 });
    signals.forEach((s) => s.classList.remove('is-done'));
    mark('type', 'Waiting', false);
    mark('pictures', '0 of 4', false);
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
    const imgs = [...page.querySelectorAll('img')];
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
