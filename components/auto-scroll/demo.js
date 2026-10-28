// Auto-scroll takeover — a festival's "walk from the harbour bus to the last stage" page with an Auto toggle, off on
// every visit. On, it advances the document through Lenis at a fixed rate in px per second of ticker time (dt clamped
// to 100 ms, so a stalled frame cannot jump a paragraph; a float accumulator keeps the sub-pixel remainder). The first
// wheel, touch, pointer press or key hands control straight back (capture phase, the toggle's own press excluded), as
// does a scroll the drive did not write (more than 3 px from where it put the page) and reaching the end. Each change
// is announced once in a polite status line. Under reduced motion the toggle stays focusable but aria-disabled, with
// the reason beside it. The drive is on GSAP's ticker only while it runs: nothing ticks for it at rest.
import './demo.css';
import { on, html, raw, clamp, photos, imageHTML, content } from '../../src/demo-kit/index.js';
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
  { t: '00:00', place: 'The harbour bus', body: 'The yellow harbour bus stops at the end of the island every twenty minutes until one in the morning. Step off, keep the water on your left and walk towards the cranes; the gate is the gap in the blue fence.', pic: ['water'] },
  { t: '01:40', place: 'Past the boatyard', body: 'The road narrows between hulls on trestles. Wristbands are checked here, at the old weighbridge, and the queue moves faster on the right: the left lane is for people buying tickets on the day.', list: ['Wristband exchange until 23:00', 'Lockers in the weighbridge hut, €6 a day', 'Water refill on both sides of the gate'] },
  { t: '03:15', place: 'The Harbour stage', body: 'The first stage you reach faces the water, so the sound goes out to sea instead of into the flats across the harbour. Thursday opens here with a choir at six, while it is still light.', pic: ['city'], sets: [['18:00', 2], ['19:30', 3], ['21:15', 0]] },
  { t: '05:30', place: 'Hall 4', body: 'A welding hall from 1962, with the cranes still on their rails under the roof. Inside it is dark and loud and twelve degrees cooler than outside; the side doors stay open so you can step out between sets.', pic: ['architecture'] },
  { t: '07:50', place: 'Under the Crane', body: 'The gantry crane is forty metres tall and the stage hangs under it. Stand by the second leg for the best sound; the mixing desk is there for a reason. The last set on Saturday ends at one.', sets: [['20:00', 5], ['22:00', 1], ['23:45', 9]] },
  { t: '10:20', place: 'The Greenhouse', body: 'The quiet end: a glasshouse with plants, long tables, soup and the late acoustic sets. The harbour bus back leaves from the jetty behind it, every twenty minutes, the last one at one fifteen.', pic: ['night'] },
];

export default function mount(root, options, ctx) {
  const { festival } = content;
  const [coverPic] = photos({ tags: ['night'], count: 1, seed: 'as-cover', orientation: 'landscape' });
  const pics = Object.fromEntries(STRETCHES.filter((s) => s.pic).map((s, i) => [s.place, photos({ tags: s.pic, count: 1, seed: `as-${i}` })[0]]));
  let cfg = { ...options };
  root.className = 'asc';
  root.innerHTML = html`
    <a class="asc-skip" href="#asc-walk">Skip to the walk</a>
    <header class="asc-bar">
      <a class="ac-brand" href="#asc-top">${festival.name}<span class="asc-bar__year">2027</span></a>
      <nav aria-label="Festival"><a href="#asc-top">Line-up</a><a href="#asc-top">Getting there</a><a href="#asc-top">Tickets</a></nav>
    </header>
    <main id="asc-top">
      <section class="asc-cover ac-wrap" aria-labelledby="asc-title">
        <div class="asc-cover__copy">
          <p class="ac-label">${festival.dates} · ${festival.place}</p>
          <h1 class="ac-display asc-title" id="asc-title">From the harbour bus to the Crane, on foot.</h1>
          <p class="ac-lede">Eleven minutes from the ferry to the last stage, if you do not stop. Press Auto and the page walks it with you; touch anything and it stops.</p>
        </div>
        <figure class="asc-cover__fig">
          <div class="asc-media" style="--focus-point:${coverPic.focus || '50% 50%'}">${raw(imageHTML(coverPic, { eager: true, sizes: '(min-width: 900px) 45vw, 100vw', alt: coverPic.alt || 'The festival site by the harbour at night' }))}</div>
          <figcaption class="asc-cap">The island at ten in the evening, from the harbour bus.</figcaption>
        </figure>
      </section>

      <article class="asc-walk ac-wrap" id="asc-walk" aria-labelledby="asc-walk-title">
        <h2 class="sr-only" id="asc-walk-title">The walk, stop by stop</h2>
        ${STRETCHES.map((s, i) => html`
          <section class="asc-stretch" data-stretch="${i}" aria-labelledby="asc-s${i}">
            <div class="asc-stretch__head">
              <p class="asc-time ac-num" aria-label="${s.t.replace(':', ' minutes ')} seconds in">${s.t}</p>
              <h3 class="ac-h2" id="asc-s${i}">${s.place}</h3>
            </div>
            <div class="asc-stretch__body">
              <p class="asc-text">${s.body}</p>
              ${s.list ? html`<ul class="asc-list">${s.list.map((li) => html`<li>${li}</li>`)}</ul>` : ''}
              ${s.sets ? html`<dl class="asc-sets"><dt class="ac-label">Thursday on this stage</dt>${s.sets.map(([time, a]) => html`<dd><span class="ac-num">${time}</span>${festival.lineup[a]}</dd>`)}</dl>` : ''}
              ${s.pic ? html`<figure class="asc-fig"><div class="asc-media asc-media--wide" style="--focus-point:${pics[s.place].focus || '50% 50%'}">${raw(imageHTML(pics[s.place], { sizes: '(min-width: 900px) 50vw, 100vw', alt: pics[s.place].alt || s.place }))}</div></figure>` : ''}
            </div>
          </section>`)}
        <section class="asc-end" aria-labelledby="asc-end-title">
          <h2 class="ac-h1" id="asc-end-title">Eleven minutes, if you do not stop. Nobody does.</h2>
          <div class="asc-end__actions"><a class="ac-btn ac-btn--accent ac-btn--lg" href="#asc-top">Weekend tickets from €${festival.tickets[1].price}</a><a class="ac-link" href="#asc-top">Download the site map (PDF, 1.2 MB)</a></div>
        </section>
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
  root.querySelectorAll('a[href="#asc-top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

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
