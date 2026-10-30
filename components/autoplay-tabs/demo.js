// Autoplay tabs — Parallel's feature tabs and their panel, on their own. The bar under the open tab IS the timer:
// one linear GSAP tween scales it 0 → 1 over the delay and its onComplete opens the next tab, so what the bar shows
// and when the set moves never drift. A `holds` set (hover, keyboard focus, off-screen, the pause button) pauses that
// one tween; any choice restarts it from 0. Real tabs with a roving tabindex. Reduced/static: no autoplay, no bar, no
// pause control.
import './demo.css';
import { on, observeIntersection, html, raw, photo, photos, imageHTML, colour, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

// Each panel's screen: a small, believable slice of the app, decorative (the panel's text carries the point).
const SCREENS = [
  () => html`
    <div class="at__ui">
      <div class="at__ui-head"><strong>Invoices</strong><span>October</span></div>
      <ul class="at__rows" role="list">
        <li><span>Northgate</span><span class="at__mono">INV-0412</span><span class="at__mono">€4,800</span><em class="at__pill at__pill--ok">Paid</em></li>
        <li><span>Morrow</span><span class="at__mono">INV-0415</span><span class="at__mono">€1,250</span><em class="at__pill at__pill--warn">Nudged day 3</em></li>
        <li><span>Hollis</span><span class="at__mono">INV-0418</span><span class="at__mono">€2,900</span><em class="at__pill">Due in 6 days</em></li>
      </ul>
    </div>`,
  () => html`
    <div class="at__ui">
      <div class="at__ui-head"><strong>Tax pot</strong><span class="at__lock">Locked to 30 Apr</span></div>
      <p class="at__big at__mono">€12,480.60</p>
      <p class="at__sub">22 % of every payment in, set aside the day it lands</p>
      <div class="at__chart">${[38, 52, 44, 70, 58, 86].map((h, i) => html`<span style="--h:${h}%"><i>${['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i]}</i></span>`)}</div>
    </div>`,
  () => html`
    <div class="at__ui">
      <div class="at__cards">
        <div class="at__card"><span class="at__card-brand">Parallel</span><span class="at__card-name">Kiln House · project</span><span class="at__mono">•••• 4821</span></div>
        <ul class="at__holders" role="list">
          <li><span class="at__avatar">IV</span><span>Ingrid</span><span class="at__mono">€410</span></li>
          <li><span class="at__avatar">TR</span><span>Tomas</span><span class="at__mono">€230</span></li>
          <li><span class="at__avatar">+2</span><span>Virtual</span><span class="at__mono">€0</span></li>
        </ul>
      </div>
      <div class="at__limit"><span>Spent this month</span><span class="at__mono">€640 of €1,500</span></div>
      <div class="at__meter"><i></i></div>
      <div class="at__switch-row"><span>Freeze card</span><span class="at__switch" aria-hidden="true"></span></div>
    </div>`,
  () => html`
    <div class="at__ui">
      <div class="at__ui-head"><strong>Receipts</strong><span>3 of 3 matched</span></div>
      <ul class="at__rows at__rows--books" role="list">
        <li><span>Tømmer &amp; Sag</span><span class="at__mono">€312.00</span><em class="at__pill at__pill--ok">Matched</em></li>
        <li><span>Fjord Print</span><span class="at__mono">€86.40</span><em class="at__pill at__pill--ok">Matched</em></li>
        <li><span>NSB rail</span><span class="at__mono">€49.90</span><em class="at__pill at__pill--ok">Matched</em></li>
      </ul>
      <div class="at__chips"><span>CSV</span><span>Xero</span><span>DATEV</span><span>Fiken</span></div>
    </div>`,
];
const TABS = ['Invoicing', 'Tax pot', 'Team cards', 'Bookkeeping'];
// Studio rooms behind each screen: chosen pictures from the shared set, any interior when one is missing.
const ROOMS = ['interior-butterfly-chair', 'interior-concrete-hall', 'tex-curtain-shadow', 'arch-spiral-stair'];

export default function mount(root, options, ctx) {
  const { app } = content;
  let cfg = { ...options };
  const autoplay = ctx.motion === 'full';
  const shots = ROOMS.map((id, i) => { const p = photo(id); return p.drawn ? photos({ tags: ['interior'], count: i + 1, seed: 'at-studios' })[i] : p; });

  root.className = 'at';
  root.innerHTML = html`
    <section class="ac-stage at__stage" aria-label="${app.name} features">
      <div class="at__set" data-set>
        <div class="at__side">
          <div class="at__tabs" role="tablist" aria-label="${app.name} features" data-list>
            ${TABS.map((t, i) => html`
              <button class="at__tab" type="button" role="tab" id="at-tab-${i}" aria-controls="at-panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
                <span class="at__num ac-label">${String(i + 1).padStart(2, '0')}</span>
                <span class="at__name">${t}</span>
                <span class="at__rule" aria-hidden="true"><span class="at__fill" data-bar></span></span>
              </button>`)}
          </div>
          <button class="at__pause" type="button" aria-pressed="false" data-pause>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path class="at__i-pause" d="M5 3.5v9M11 3.5v9"/><path class="at__i-play" d="M5 3.2v9.6L12.6 8Z"/></svg>
            <span data-pause-label>Pause</span>
          </button>
        </div>
        <div class="at__panels">
          ${app.features.map((f, i) => html`
            <div class="at__panel" role="tabpanel" id="at-panel-${i}" aria-labelledby="at-tab-${i}" tabindex="0" ${i ? raw('hidden') : ''}>
              <div class="at__media ac-media" aria-hidden="true">
                ${raw(imageHTML(shots[i], { sizes: '(min-width: 760px) 56vw, 100vw', eager: i === 0, alt: '' }))}
                <div class="at__screen">${SCREENS[i]()}</div>
              </div>
              <p class="at__line">${f.title}</p>
            </div>`)}
        </div>
      </div>
      <p class="ac-stage__note"><span>${app.name} · features</span></p>
    </section>`;

  const set = root.querySelector('[data-set]');
  const list = root.querySelector('[data-list]');
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];
  const bars = [...root.querySelectorAll('[data-bar]')];
  const pause = root.querySelector('[data-pause]');
  const pauseLabel = root.querySelector('[data-pause-label]');
  const { gsap } = useGsap(ctx, root);

  const holds = new Set(); // why the clock is stopped: hover, focus, offscreen, user
  let index = 0;
  let clock = null;
  let seen = false;

  // The bar is the timer: linear scaleX 0 → 1 over the delay; its completion opens the next tab.
  const run = () => {
    clock?.kill();
    clock = null;
    if (!autoplay || !seen) return;
    clock = gsap.fromTo(bars[index], { scaleX: 0 }, {
      scaleX: 1, duration: cfg.duration, ease: 'none', paused: holds.size > 0,
      onComplete: () => select((index + 1) % tabs.length),
    });
  };
  const hold = (reason, held) => {
    if (held) holds.add(reason); else holds.delete(reason);
    root.classList.toggle('is-held', holds.size > 0);
    if (clock) { if (holds.size) clock.pause(); else clock.resume(); }
  };

  const reveal = (panel) => {
    if (ctx.motion === 'static') return;
    const full = ctx.motion === 'full';
    gsap.fromTo(panel, { autoAlpha: 0, y: full ? 16 : 0 }, { autoAlpha: 1, y: 0, duration: full ? 0.6 : 0.3, ease: 'expo.out', overwrite: true });
    if (full) gsap.fromTo(panel.querySelector('.at__screen'), { y: 24 }, { y: 0, duration: 0.9, ease: 'expo.out', delay: 0.05, overwrite: true });
  };

  // Any choice (a click, a key, the clock itself) restarts the timer from 0 on the new tab.
  const select = (next, focus = false) => {
    if (next !== index) {
      gsap.set(bars[index], { scaleX: 0 });
      tabs[index].setAttribute('aria-selected', 'false');
      tabs[index].tabIndex = -1;
      panels[index].hidden = true;
      index = next;
      tabs[index].setAttribute('aria-selected', 'true');
      tabs[index].tabIndex = 0;
      panels[index].hidden = false;
      reveal(panels[index]);
    }
    if (focus) tabs[index].focus();
    run();
  };

  tabs.forEach((tab, i) => on(ctx, tab, 'click', () => select(i)));
  // Roving tabindex with automatic activation; both axes, so the vertical and horizontal layouts share the keys.
  const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  on(ctx, list, 'keydown', (e) => {
    const from = Math.max(0, tabs.indexOf(document.activeElement));
    let next;
    if (e.key in STEP) next = (from + STEP[e.key] + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    select(next, true);
  });

  // Hover holds (optional); keyboard focus holds, a mouse click's focus does not, or the set would stall after a click.
  on(ctx, set, 'pointerenter', (e) => { if (e.pointerType === 'mouse' && cfg.hover) hold('hover', true); });
  on(ctx, set, 'pointerleave', () => hold('hover', false));
  on(ctx, set, 'focusin', (e) => hold('focus', e.target.matches(':focus-visible')));
  on(ctx, set, 'focusout', (e) => { if (!set.contains(e.relatedTarget)) hold('focus', false); });

  const setPaused = (paused) => {
    hold('user', paused);
    pause.setAttribute('aria-pressed', String(paused));
    pauseLabel.textContent = paused ? 'Play' : 'Pause';
  };
  on(ctx, pause, 'click', () => setPaused(!holds.has('user')));

  // Start once the set is a quarter into view; hold off screen and carry on from where it was.
  observeIntersection(ctx, set, ([entry]) => {
    hold('offscreen', !entry.isIntersecting);
    if (entry.isIntersecting && !seen) { seen = true; run(); }
  }, { rootMargin: '0px 0px -25% 0px' });

  const apply = () => {
    root.dataset.orientation = cfg.orientation;
    list.setAttribute('aria-orientation', cfg.orientation);
    root.style.setProperty('--at-bar', colour(cfg.bar));
  };
  apply();
  root.dataset.autoplay = autoplay ? 'on' : 'off';
  pause.hidden = !autoplay;

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      // A new delay keeps the bar where it is and stretches the rest of the run to the new length.
      if (changed.includes('duration') && clock) {
        const p = clock.progress();
        run();
        clock?.progress(p);
      }
      if (changed.includes('hover') && !cfg.hover) hold('hover', false);
    },
    action(id) {
      if (id === 'toggle' && autoplay) setPaused(!holds.has('user'));
      if (id === 'next') select((index + 1) % tabs.length);
    },
  };
}
