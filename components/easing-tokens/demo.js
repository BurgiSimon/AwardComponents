// Easing tokens — the motion page of a banking app's design system, with a live specimen. Five curves and a
// duration ladder live as CSS custom properties on the root (the single source). At mount the script reads them,
// registers each with CustomEase under its token name and calls gsap.defaults({ ease, duration: m }). Nothing in the
// app names an ease: the list stagger, the card-to-sheet clip and the toast stack all inherit the default, and the
// CSS transitions (rows, buttons) use the same four numbers. A plot draws the default curve and rides a playhead
// over each move. Reduced: movement durations and the stagger are 0 s and fades survive; static: everything 0 s.
import './demo.css';
import { CustomEase } from 'gsap/CustomEase';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { on, observeIntersection, html, content } from '../../src/demo-kit/index.js';

gsap.registerPlugin(CustomEase);

const CURVES = ['house', 'out', 'in', 'in-out', 'write'];
const LADDER = ['xs', 's', 'm', 'l', 'fade'];
const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const signed = (v) => `${v < 0 ? '−' : '+'}${money.format(Math.abs(v))}`;

const ROWS = [
  { who: 'Morrow', what: 'Invoice 0139 paid', amount: 1280, when: 'Today' },
  { who: 'Tax pot', what: 'Set aside for April', amount: -320, when: 'Today' },
  { who: 'Hollis', what: 'Studio rent, March', amount: -2150, when: 'Mon' },
  { who: 'Kestrel', what: 'Invoice 0141 paid', amount: 4600, when: 'Mon' },
  { who: 'Card ••42', what: 'Paper & Co.', amount: -86.4, when: 'Sun' },
];
const TOASTS = [
  { t: 'Payment received', b: 'Morrow paid invoice 0139.', a: '+€1,280.00' },
  { t: 'Tax pot topped up', b: '€320.00 set aside for April.', a: '' },
  { t: 'Reminder sent', b: 'Arden & Vale, invoice 0143.', a: '' },
];
const LINES = [['Kitchen joinery, oak', 2100], ['Site visits × 3', 450], ['Drawings, revision C', 600]];

export default function mount(root, options, ctx) {
  const { app } = content;
  const full = ctx.motion === 'full';
  let cfg = { ...options };
  root.className = 'et';
  root.innerHTML = html`
    <header class="ac-bar et__bar">
      <a class="ac-brand" href="#top"><span class="et__mark" aria-hidden="true"></span>${app.name}<span class="et__ds">Design system</span></a>
      <nav aria-label="Design system">${['Colour', 'Type', 'Motion', 'Components'].map((n) => html`<a href="#top"${n === 'Motion' ? html` aria-current="page"` : ''}>${n}</a>`)}</nav>
    </header>
    <section class="et__intro ac-wrap" aria-labelledby="et-title">
      <div class="et__intro-copy">
        <p class="ac-label">Motion tokens · 5 curves · 4 durations</p>
        <h1 class="ac-h1" id="et-title">One curve family for every move.</h1>
      </div>
      <div class="et__intro-side">
        <p class="ac-body">Written once as CSS properties, registered with GSAP at boot. Nothing in the app below names an ease; each move inherits the default.</p>
        <div class="et__moments" role="group" aria-label="Play the moments">
          <button class="ac-btn ac-btn--sm ac-btn--accent" type="button" data-play>Play all</button>
          <button class="ac-btn ac-btn--sm ac-btn--ghost" type="button" data-moment="list">List</button>
          <button class="ac-btn ac-btn--sm ac-btn--ghost" type="button" data-moment="sheet">Sheet</button>
          <button class="ac-btn ac-btn--sm ac-btn--ghost" type="button" data-moment="toasts">Toasts</button>
        </div>
      </div>
    </section>
    <section class="et__main ac-wrap">
      <aside class="et__inspector" aria-label="Active motion tokens">
        <div class="et__ins-head">
          <p class="ac-label">Default curve</p>
          <p class="et__state ac-label" data-state>Idle</p>
        </div>
        <p class="et__name"><span data-name>house</span><code class="et__bezier" data-bezier></code></p>
        <div class="et__plot-wrap"><svg class="et__plot" viewBox="-8 -8 116 116" aria-hidden="true">
          <g class="et__grid">${[0, 25, 50, 75, 100].map((v) => html`<line x1="${v}" y1="0" x2="${v}" y2="100"/><line x1="0" y1="${v}" x2="100" y2="${v}"/>`)}</g>
          <g class="et__ghosts">${CURVES.map((n) => html`<path data-ghost="${n}"/>`)}</g>
          <path class="et__handles" data-handles/>
          <path class="et__curve" data-curve/>
          <circle class="et__cp" r="1.8" data-cp="1"/><circle class="et__cp" r="1.8" data-cp="2"/>
          <line class="et__guide" data-gx/><line class="et__guide" data-gy/>
          <circle class="et__head" r="3.2" cx="0" cy="100" data-head/>
        </svg></div>
        <div class="et__axes ac-label" aria-hidden="true"><span>Time</span><span data-progress>Progress 0 %</span></div>
        <dl class="et__ladder" data-ladder>${LADDER.map((k) => html`<div data-dur="${k}"><dt>${k}</dt><dd><span data-sec>—</span><span class="et__unit"> s</span></dd></div>`)}</dl>
        <p class="et__stagger ac-small">Stagger <span data-stagger></span><span class="et__aside"> · scrubbed tweens stay linear</span></p>
      </aside>
      <div class="et__app" data-app>
        <div class="et__top">
          <p class="ac-label">Overview</p>
          <p class="et__balance ac-num">€48,210.40</p>
          <p class="ac-small">Across three accounts · updated 09:41</p>
        </div>
        <div class="et__grid-app">
          <article class="et__invoice" data-card aria-labelledby="et-inv">
            <div class="et__inv-row"><h2 class="ac-label" id="et-inv">Invoice 0143</h2><span class="et__due">Due in 4 days</span></div>
            <p class="et__inv-amount ac-num">${money.format(3150)}</p>
            <p class="ac-small">Arden &amp; Vale · Kitchen fit-out, phase 2</p>
            <button class="ac-btn ac-btn--sm et__open" type="button" data-open aria-expanded="false" aria-controls="et-sheet">Open invoice</button>
          </article>
          <div class="et__pot">
            <div class="et__inv-row"><p class="ac-label">Tax pot · April</p><p class="ac-label">71 %</p></div>
            <p class="et__pot-amount ac-num">${money.format(6420)} <span class="ac-small">of ${money.format(9000)}</span></p>
            <span class="et__bar-track" aria-hidden="true"><span class="et__bar-fill" data-pot></span></span>
          </div>
          <section class="et__activity" aria-labelledby="et-act">
            <h2 class="ac-label" id="et-act">Recent activity</h2>
            <ul role="list" data-list>
              ${ROWS.map((r) => html`<li class="et__row"><span class="et__avatar" aria-hidden="true">${r.who[0]}</span><span class="et__who"><strong>${r.who}</strong><span>${r.what}</span></span><span class="et__amt ac-num${r.amount > 0 ? ' is-in' : ''}">${signed(r.amount)}</span><span class="et__when ac-label">${r.when}</span></li>`)}
            </ul>
          </section>
        </div>
        <section class="et__sheet" id="et-sheet" aria-labelledby="et-sheet-title" hidden data-sheet>
          <div class="et__sheet-head" data-part>
            <div><p class="ac-label">Invoice 0143 · Arden &amp; Vale</p><h2 class="ac-h2" id="et-sheet-title">${money.format(3150)}</h2></div>
            <button class="et__close" type="button" data-close aria-label="Close the invoice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
          </div>
          <ul class="et__lines" role="list" data-part>${LINES.map(([l, v]) => html`<li><span>${l}</span><span class="ac-num">${money.format(v)}</span></li>`)}</ul>
          <p class="et__sheet-meta ac-small" data-part>Sent 2 March · due 18 March · reminders on day 3 and day 10</p>
          <div class="et__sheet-actions" data-part><button class="ac-btn ac-btn--sm ac-btn--accent" type="button">Send reminder</button><button class="ac-btn ac-btn--sm ac-btn--ghost" type="button">Download PDF</button></div>
        </section>
        <ol class="et__toasts" role="list" aria-live="off" data-toasts></ol>
      </div>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const $ = (s) => root.querySelector(s);
  const appEl = $('[data-app]');
  const card = $('[data-card]');
  const sheet = $('[data-sheet]');
  const parts = [...root.querySelectorAll('[data-part]')];
  const openBtn = $('[data-open]');
  const closeBtn = $('[data-close]');
  const list = [...root.querySelectorAll('.et__row')];
  const toastList = $('[data-toasts]');
  const head = $('[data-head]');
  const gx = $('[data-gx]');
  const gy = $('[data-gy]');
  const progressEl = $('[data-progress]');
  const stateEl = $('[data-state]');
  const ladder = Object.fromEntries([...root.querySelectorAll('[data-dur]')].map((el) => [el.dataset.dur, el]));

  // GSAP's defaults are global: put them back when the demo goes.
  const before = { ease: gsap.defaults().ease, duration: gsap.defaults().duration };
  ctx.onCleanup(() => gsap.defaults(before));
  const { context } = useGsap(ctx, root);

  // 1. Read the tokens from CSS, the single source: curves as four numbers, durations in seconds (already scaled and,
  //    under reduced or static, already zero, because the CSS decides that).
  let tokens = null;
  const seconds = (v) => { const n = parseFloat(v) || 0; return /ms\s*$/.test(v) ? n / 1000 : n; };
  const readTokens = () => {
    const cs = getComputedStyle(root);
    const ease = Object.fromEntries(CURVES.map((n) => [n, (cs.getPropertyValue(`--ease-${n}`).match(/-?\d*\.?\d+/g) || [0, 0, 1, 1]).map(Number)]));
    const dur = Object.fromEntries(LADDER.map((k) => [k, seconds(cs.getPropertyValue(`--dur-${k}`))]));
    return { ease, dur, stagger: seconds(cs.getPropertyValue('--stagger')) };
  };

  // 2. The plot: every curve as a ghost, the default drawn with its handles.
  const pt = (x, y) => `${(x * 100).toFixed(2)},${(100 - y * 100).toFixed(2)}`;
  const curvePath = ([x1, y1, x2, y2]) => `M0,100 C${pt(x1, y1)} ${pt(x2, y2)} 100,0`;
  const drawPlot = () => {
    const pts = tokens.ease[cfg.curve];
    root.querySelectorAll('[data-ghost]').forEach((p) => { p.setAttribute('d', curvePath(tokens.ease[p.dataset.ghost])); p.classList.toggle('is-on', p.dataset.ghost === cfg.curve); });
    $('[data-curve]').setAttribute('d', curvePath(pts));
    $('[data-handles]').setAttribute('d', `M0,100 L${pt(pts[0], pts[1])} M100,0 L${pt(pts[2], pts[3])}`);
    const [c1, c2] = root.querySelectorAll('[data-cp]');
    c1.setAttribute('cx', pts[0] * 100); c1.setAttribute('cy', 100 - pts[1] * 100);
    c2.setAttribute('cx', pts[2] * 100); c2.setAttribute('cy', 100 - pts[3] * 100);
    $('[data-name]').textContent = cfg.curve;
    $('[data-bezier]').textContent = `cubic-bezier(${pts.map((n) => String(n).replace(/^(-?)0\./, '$1.')).join(', ')})`;
    for (const k of LADDER) ladder[k].querySelector('[data-sec]').textContent = tokens.dur[k].toFixed(2);
    $('[data-stagger]').textContent = `${tokens.stagger.toFixed(2)} s`;
    placeHead(1);
  };
  const placeHead = (t) => {
    const y = gsap.parseEase(cfg.curve)(t);
    head.setAttribute('cx', t * 100); head.setAttribute('cy', 100 - y * 100);
    gx.setAttribute('x1', t * 100); gx.setAttribute('x2', t * 100); gx.setAttribute('y1', 100); gx.setAttribute('y2', 100 - y * 100);
    gy.setAttribute('x1', 0); gy.setAttribute('x2', t * 100); gy.setAttribute('y1', 100 - y * 100); gy.setAttribute('y2', 100 - y * 100);
    progressEl.textContent = `Progress ${Math.round(y * 100)} %`;
  };

  // The playhead rides one move's duration on the default curve (the proxy itself is time, so it is linear).
  const clock = { t: 1 };
  let rideTween = null;
  const ride = (key, label) => {
    rideTween?.kill();
    Object.entries(ladder).forEach(([k, el]) => el.classList.toggle('is-active', k === key));
    stateEl.textContent = `${label} · ${key}`;
    root.classList.add('is-riding');
    const done = () => { root.classList.remove('is-riding'); stateEl.textContent = 'Idle'; placeHead(1); };
    if (!full || !tokens.dur[key]) { done(); return; }
    context.add(() => {
      rideTween = gsap.fromTo(clock, { t: 0 }, { t: 1, duration: tokens.dur[key], ease: 'none', onUpdate: () => placeHead(clock.t), onComplete: done });
    });
  };

  const apply = () => {
    root.dataset.curve = cfg.curve;
    root.style.setProperty('--dur-scale', String(cfg.scale));
    root.style.setProperty('--stagger-base', `${cfg.stagger}s`);
    tokens = readTokens();
    gsap.defaults({ ease: cfg.curve, duration: tokens.dur.m });
    drawPlot();
  };
  tokens = readTokens();
  for (const [name, pts] of Object.entries(tokens.ease)) CustomEase.create(name, pts.join(','));
  apply();

  // 3. The moments. None of them names an ease; durations come from the ladder.
  const pot = $('[data-pot]');
  const playList = () => {
    context.add(() => {
      gsap.killTweensOf([...list, pot]);
      if (full) {
        gsap.fromTo(list, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: tokens.stagger });
        gsap.fromTo(pot, { scaleX: 0 }, { scaleX: 0.71, duration: tokens.dur.l });
      } else {
        gsap.fromTo(list, { autoAlpha: 0 }, { autoAlpha: 1, duration: tokens.dur.fade, stagger: tokens.stagger });
        gsap.set(pot, { scaleX: 0.71 });
      }
    });
    ride('m', 'List');
  };

  let isOpen = false;
  const cardInset = () => {
    const a = appEl.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return `inset(${(c.top - a.top).toFixed(1)}px ${(a.right - c.right).toFixed(1)}px ${(a.bottom - c.bottom).toFixed(1)}px ${(c.left - a.left).toFixed(1)}px round 14px)`;
  };
  const openSheet = (byUser = false) => {
    if (isOpen) return;
    isOpen = true;
    openBtn.setAttribute('aria-expanded', 'true');
    sheet.hidden = false;
    context.add(() => {
      gsap.killTweensOf([sheet, ...parts]);
      if (full) {
        gsap.fromTo(sheet, { clipPath: cardInset(), opacity: 1 }, { clipPath: 'inset(0px 0px 0px 0px round 14px)', duration: tokens.dur.l });
        gsap.fromTo(parts, { y: 14, opacity: 0 }, { y: 0, opacity: 1, stagger: tokens.stagger, delay: tokens.dur.l * 0.3 });
      } else {
        gsap.set(sheet, { clipPath: 'none' });
        gsap.set(parts, { opacity: 1 });
        gsap.fromTo(sheet, { opacity: 0 }, { opacity: 1, duration: tokens.dur.fade });
      }
    });
    ride('l', 'Sheet');
    if (byUser) closeBtn.focus({ preventScroll: true });
  };
  const closeSheet = (byUser = false) => {
    if (!isOpen) return;
    isOpen = false;
    openBtn.setAttribute('aria-expanded', 'false');
    const hide = () => { if (!isOpen) sheet.hidden = true; };
    context.add(() => {
      gsap.killTweensOf([sheet, ...parts]);
      if (full) {
        gsap.to(parts, { opacity: 0, duration: tokens.dur.s });
        gsap.to(sheet, { clipPath: cardInset(), onComplete: hide });
      }
      else gsap.to(sheet, { opacity: 0, duration: tokens.dur.fade, onComplete: hide });
    });
    ride('m', 'Sheet');
    if (byUser) openBtn.focus({ preventScroll: true });
  };

  // Toasts stack: the newest in front, older ones step back, up and fade. Three at most.
  const restack = (instant = false) => {
    const items = [...toastList.children].reverse();
    items.forEach((el, i) => {
      el.classList.toggle('is-back', i > 0);
      if (i === 0) return;
      const step = full || instant ? { y: -i * 14, scale: 1 - i * 0.06 } : {};
      const vars = { ...step, autoAlpha: i > 2 ? 0 : 1 - i * 0.2, duration: instant ? 0 : full ? tokens.dur.s : tokens.dur.fade };
      gsap.to(el, { ...vars, onComplete: i > 2 ? () => el.remove() : undefined });
    });
  };
  const pushToast = (t, i, instant = false) => {
    const li = document.createElement('li');
    li.className = 'et__toast';
    li.innerHTML = html`<span class="et__toast-dot" aria-hidden="true"></span><span class="et__toast-copy"><strong>${t.t}</strong><span>${t.b}</span></span>${t.a ? html`<span class="et__toast-amt ac-num">${t.a}</span>` : ''}`;
    li.style.zIndex = String(10 + i);
    toastList.append(li);
    context.add(() => {
      if (instant) gsap.set(li, { autoAlpha: 1 });
      else if (full) gsap.fromTo(li, { y: 28, scale: 0.98, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: tokens.dur.s });
      else gsap.fromTo(li, { autoAlpha: 0 }, { autoAlpha: 1, duration: tokens.dur.fade });
      restack(instant);
    });
    if (!instant) ride('s', 'Toast');
  };
  let calls = [];
  const after = (s, fn) => { context.add(() => calls.push(gsap.delayedCall(s, fn))); };
  const cancel = () => { calls.forEach((c) => c.kill()); calls = []; };
  const playToasts = (live) => {
    toastList.setAttribute('aria-live', live ? 'polite' : 'off');
    gsap.killTweensOf([...toastList.children]);
    toastList.replaceChildren();
    TOASTS.forEach((t, i) => after(i * Math.max(0.45 * cfg.scale, 0.3), () => pushToast(t, i)));
  };

  // Play all: list → sheet opens, holds and closes → toasts stack. Settles on the dashboard.
  const playAll = (live) => {
    cancel();
    closeSheet();
    playList();
    let t = tokens.dur.m + tokens.stagger * (list.length - 1) + 0.2;
    after(t, () => openSheet());
    t += tokens.dur.l + 0.9;
    after(t, () => closeSheet());
    t += tokens.dur.m + 0.25;
    after(t, () => playToasts(live));
  };

  on(ctx, $('[data-play]'), 'click', () => playAll(true));
  root.querySelectorAll('[data-moment]').forEach((b) => on(ctx, b, 'click', () => {
    cancel();
    if (b.dataset.moment === 'list') playList();
    if (b.dataset.moment === 'sheet') { if (isOpen) closeSheet(); else openSheet(); }
    if (b.dataset.moment === 'toasts') playToasts(true);
  }));
  on(ctx, openBtn, 'click', () => { cancel(); openSheet(true); });
  on(ctx, closeBtn, 'click', () => closeSheet(true));
  on(ctx, sheet, 'keydown', (e) => { if (e.key === 'Escape') closeSheet(true); });
  on(ctx, window, 'resize', () => { if (!isOpen) gsap.set(sheet, { clipPath: cardInset() }); });

  // The settled end of Play all, set at once: the reduced and static first screen, and the preview frame.
  const settle = () => {
    gsap.set(list, { autoAlpha: 1, y: 0 });
    gsap.set(pot, { scaleX: 0.71 });
    toastList.replaceChildren();
    TOASTS.forEach((t, i) => pushToast(t, i, true));
  };

  // Nothing autoplays outside the full tier. In full, the specimen plays once when it first comes into view.
  if (full && !ctx.capture) {
    let played = false;
    observeIntersection(ctx, appEl, ([e]) => { if (e.isIntersecting && !played) { played = true; playAll(false); } }, { threshold: 0.3 });
  } else {
    settle();
  }

  let replayTimer = 0;
  ctx.onCleanup(() => clearTimeout(replayTimer));
  return {
    update(next) {
      cfg = { ...next };
      apply();
      // Show the change: re-run the quickest moment that uses all three values.
      clearTimeout(replayTimer);
      replayTimer = setTimeout(() => { cancel(); playList(); }, 260);
    },
    action(id) {
      if (id === 'play') playAll(true);
    },
  };
}
