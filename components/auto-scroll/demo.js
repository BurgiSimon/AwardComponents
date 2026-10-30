// Auto-scroll takeover — a festival's walk from the harbour bus to the last stage, six timed stops with one line
// each, and an Auto toggle, off on every visit. On, it advances the document through Lenis at a fixed rate in px per
// second of ticker time (dt clamped to 100 ms, so a stalled frame cannot jump a stop; a float accumulator keeps the
// sub-pixel remainder). The first wheel, touch, pointer press or key hands control straight back (capture phase, the
// toggle's own press excluded), as does a scroll the drive did not write (more than 3 px from where it put the page)
// and reaching the end. Each change is announced once in a polite status line. Under reduced motion the toggle stays
// focusable but aria-disabled, with the reason beside it. The drive is on GSAP's ticker only while it runs: nothing
// ticks for it at rest.
import './demo.css';
import { on, html, clamp } from '../../src/demo-kit/index.js';
import { gsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const FOREIGN = 3;
const REASONS = {
  wheel: 'the wheel took over',
  touch: 'a touch took over',
  pointer: 'a pointer press took over',
  key: 'a key press took over',
  scroll: 'the page was scrolled another way',
  button: 'turned off',
};
const STRETCHES = [
  { t: '00:00', place: 'The harbour bus', line: 'Step off at the end of the island and walk towards the cranes.' },
  { t: '01:40', place: 'Past the boatyard', line: 'Wristbands are checked at the old weighbridge; the right lane moves faster.' },
  { t: '03:15', place: 'The Harbour stage', line: 'The first stage faces the water, so the sound goes out to sea.' },
  { t: '05:30', place: 'Hall 4', line: 'A welding hall from 1962: dark, loud and twelve degrees cooler.' },
  { t: '07:50', place: 'Under the Crane', line: 'Stand by the second leg of the gantry for the best sound.' },
  { t: '10:20', place: 'The Greenhouse', line: 'The quiet end: soup, long tables and the bus back from the jetty.' },
];

export default function mount(root, options, ctx) {
  let cfg = { ...options };
  root.className = 'asc';
  root.innerHTML = html`
    <main>
      <div class="asc-cover ac-wrap">
        <h1 class="ac-display asc-title">From the harbour bus to the Crane, on foot.</h1>
      </div>

      <article class="asc-walk ac-wrap" aria-label="The walk, stop by stop">
        ${STRETCHES.map((s, i) => html`
          <section class="asc-stretch" data-stretch="${i}" aria-labelledby="asc-s${i}">
            <p class="asc-time ac-num" aria-label="${s.t.replace(':', ' minutes ')} seconds in">${s.t}</p>
            <div class="asc-stretch__body">
              <h2 class="ac-h2" id="asc-s${i}">${s.place}</h2>
              <p class="asc-text">${s.line}</p>
            </div>
          </section>`)}
      </article>
    </main>

    <div class="asc-dock" role="group" aria-label="Auto scroll">
      <button type="button" class="asc-toggle" aria-pressed="false" aria-describedby="asc-note" data-auto>
        <svg class="asc-ring" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><circle class="asc-ring__fill" cx="10" cy="10" r="7" data-ring/></svg>
        Auto<span class="sr-only"> scroll</span>
        <span class="asc-toggle__state" aria-hidden="true" data-state>off</span>
      </button>
      <div class="asc-dock__text">
        <p class="asc-note" id="asc-note" data-note></p>
        <p class="asc-status" role="status" data-status></p>
      </div>
      <div class="asc-now" aria-hidden="true"><span class="asc-now__bar"><span data-progress></span></span><span class="asc-now__label" data-now></span></div>
    </div>`;

  const toggle = root.querySelector('[data-auto]');
  const stateText = root.querySelector('[data-state]');
  const note = root.querySelector('[data-note]');
  const status = root.querySelector('[data-status]');
  const ring = root.querySelector('[data-ring]');
  const progress = root.querySelector('[data-progress]');
  const nowLabel = root.querySelector('[data-now]');
  const stretches = [...root.querySelectorAll('[data-stretch]')];

  const lenis = useLenis(ctx, { smoothWheel: true });
  const allowed = ctx.motion === 'full' && !!lenis;
  const S = { on: false, arming: false, y: 0, armTimer: 0 };
  const limit = () => (lenis ? lenis.limit : Math.max(0, document.documentElement.scrollHeight - innerHeight));

  const render = () => {
    toggle.setAttribute('aria-pressed', String(S.on || S.arming));
    stateText.textContent = S.on ? 'on' : S.arming ? 'wait' : 'off';
    toggle.classList.toggle('is-arming', S.arming);
  };
  // One polite line, written only on a change: nothing is announced on load.
  const announce = (text) => { status.textContent = text; };
  const setNote = () => {
    note.textContent = allowed
      ? `A steady walk at ${cfg.speed} px a second. Any wheel, touch, press or key takes it back.`
      : 'Unavailable: your system asks for reduced motion.';
  };

  // The drive: only on the ticker while it runs.
  const drive = (time, deltaTime) => {
    if (!S.on) return;
    if (Math.abs(scrollY - S.y) > FOREIGN) { stop('scroll'); return; }
    S.y = Math.min(limit(), S.y + cfg.speed * Math.min(0.1, deltaTime / 1000));
    lenis.scrollTo(S.y, { immediate: true, force: true });
    if (S.y >= limit() - 0.5) stop('end');
  };
  const begin = () => {
    S.arming = false;
    S.on = true;
    S.y = scrollY;
    render();
    gsap.ticker.add(drive);
  };
  const start = () => {
    if (limit() - scrollY < 1) { announce('Auto scroll needs room: this is already the end of the page.'); return; }
    if (cfg.delay > 0) {
      S.arming = true;
      ring.style.transitionDuration = `${cfg.delay}s`;
      render();
      announce(`Auto scroll starts in ${cfg.delay} ${cfg.delay === 1 ? 'second' : 'seconds'}.`);
      S.armTimer = setTimeout(begin, cfg.delay * 1000);
      return;
    }
    announce('Auto scroll on.');
    begin();
  };
  const stop = (reason) => {
    if (!S.on && !S.arming) return;
    clearTimeout(S.armTimer);
    S.on = false;
    S.arming = false;
    gsap.ticker.remove(drive);
    ring.style.transitionDuration = '0s';
    render();
    announce(reason === 'end' ? 'Auto scroll stopped at the end of the page.' : `Auto scroll off: ${REASONS[reason]}.`);
  };
  ctx.onCleanup(() => { clearTimeout(S.armTimer); gsap.ticker.remove(drive); });

  const press = () => {
    if (!allowed) { announce('Auto scroll is unavailable: reduced motion is on.'); return; }
    if (S.on || S.arming) stop('button'); else start();
  };
  on(ctx, toggle, 'click', press);

  // Every road back, in the capture phase. The toggle's own press and activation keys are left to its click.
  const onToggle = (e) => toggle.contains(e.target);
  on(ctx, window, 'wheel', () => stop('wheel'), { capture: true, passive: true });
  on(ctx, window, 'touchstart', (e) => { if (!onToggle(e)) stop('touch'); }, { capture: true, passive: true });
  on(ctx, window, 'pointerdown', (e) => { if (!onToggle(e)) stop(e.pointerType === 'touch' ? 'touch' : 'pointer'); }, { capture: true });
  on(ctx, window, 'keydown', (e) => {
    if (onToggle(e) && (e.key === 'Enter' || e.key === ' ')) return;
    stop('key');
  }, { capture: true });

  // Where the walk is: a progress line and the current stop, from the scroll position (no loop of its own).
  let current = -1;
  const where = () => {
    const max = limit() || 1;
    progress.style.transform = `scaleX(${clamp(scrollY / max, 0, 1).toFixed(4)})`;
    let i = 0;
    stretches.forEach((el, k) => { if (el.getBoundingClientRect().top < innerHeight * 0.55) i = k; });
    if (i !== current) {
      current = i;
      nowLabel.textContent = `${STRETCHES[i].t} · ${STRETCHES[i].place}`;
    }
  };
  on(ctx, window, 'scroll', where, { passive: true });
  on(ctx, window, 'resize', where);

  toggle.setAttribute('aria-disabled', String(!allowed));
  root.dataset.dock = cfg.dock;
  setNote();
  render();
  where();

  return {
    update(next) {
      cfg = { ...next };
      setNote();
      root.dataset.dock = cfg.dock;
    },
    action(id) { if (id === 'auto') press(); },
  };
}
