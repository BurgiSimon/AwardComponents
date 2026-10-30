// Scramble decode — Signal's ferry departures board, alone on the stage. Every value sits in a real table cell as a visually hidden copy
// plus an aria-hidden twin that anime.js's scrambleText animates through a character set into the text (reveal rate,
// settle rate, a block cursor at the frontier). A refresh decodes only the cells whose value changed, from the old
// value into the new one; hovering a row decodes it again. Live refreshes run only on screen. Reduced: no scramble.
import './demo.css';
import { animate, scrambleText } from 'animejs';
import { on, whileVisible, html, content } from '../../src/demo-kit/index.js';

const COLS = ['time', 'ferry', 'from', 'due', 'status'];
const HEAD = { time: 'Time', ferry: 'Ferry', from: 'From', due: 'Due', status: 'Status' };
const MIXED = { time: 'numbers', ferry: 'A-Z0-9', from: 'uppercase', due: 'numbers', status: 'blocks', big: 'numbers', line: 'uppercase', clock: 'numbers' };
const ROUTES = [['F1', 'NYHAVN'], ['991', 'OPERAEN'], ['F2', 'NORDRE TOLDBOD'], ['992', 'ISLANDS BRYGGE'], ['993', 'KNIPPELSBRO']];
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  const full = ctx.motion === 'full';

  // The timetable, in minutes after midnight. Each refresh moves the clock on two minutes.
  let clock = 21 * 60 + 40;
  let nextRoute = 0;
  const departure = (at) => {
    const [ferry, from] = ROUTES[nextRoute++ % ROUTES.length];
    return { at, ferry, from, delay: 0, full: false };
  };
  let deps = [];
  for (let at = clock + 2; deps.length < 6; at += 4 + (deps.length % 3) * 2) deps.push(departure(at));
  deps[3].delay = 4;
  const statusOf = (d) => {
    const due = d.at + d.delay - clock;
    if (due <= 0) return 'DEPARTED';
    if (d.full) return 'FULL';
    if (due <= 3) return 'BOARDING';
    return d.delay ? `DELAYED ${d.delay}` : 'ON TIME';
  };
  const dueOf = (d) => { const due = d.at + d.delay - clock; return due <= 0 ? '—' : due <= 1 ? 'NOW' : `${due} MIN`; };
  const valuesOf = (d) => ({ time: hhmm(d.at), ferry: d.ferry, from: d.from, due: dueOf(d), status: statusOf(d) });

  const cell = (kind) => html`<span class="sc__cell" data-cell="${kind}"><span class="sr-only"></span><span class="sc__live" aria-hidden="true"></span></span>`;
  root.className = 'sc';
  root.innerHTML = html`
    <section class="ac-stage sc__stage" aria-label="Departures">
      <div class="sc__board ac-card">
        <div class="sc__top">
          <div class="sc__next">
            <p class="ac-label">Next ferry</p>
            <p class="sc__big ac-num" data-slot="big">${cell('big')}</p>
            <p class="sc__line" data-slot="line">${cell('line')}</p>
          </div>
          <div class="sc__meta">
            <p class="ac-label">Updated <span data-slot="clock">${cell('clock')}</span></p>
            <button class="ac-btn ac-btn--sm ac-btn--ghost" type="button" data-refresh>Refresh</button>
          </div>
        </div>
        <table class="sc__table">
          <caption class="sr-only">Departures to ${festival.place.split(',')[0]}</caption>
          <thead><tr>${COLS.map((c) => html`<th scope="col" class="ac-label sc__${c}">${HEAD[c]}</th>`)}</tr></thead>
          <tbody>${deps.map(() => html`<tr class="sc__row">${COLS.map((c) => html`<td class="sc__${c}">${cell(c)}</td>`)}</tr>`)}</tbody>
        </table>
        <p class="sr-only" role="status" aria-live="polite" data-status></p>
      </div>
      <p class="ac-stage__note"><span>${festival.name} · getting there</span></p>
    </section>`;

  const wrap = (el) => ({ el, kind: el.dataset.cell, mirror: el.firstElementChild, live: el.lastElementChild, text: '', anim: null });
  const rows = [...root.querySelectorAll('.sc__row')].map((tr) => ({ tr, cells: Object.fromEntries([...tr.querySelectorAll('[data-cell]')].map((el) => [el.dataset.cell, wrap(el)])) }));
  const top = Object.fromEntries(['big', 'line', 'clock'].map((k) => [k, wrap(root.querySelector(`[data-slot="${k}"] [data-cell]`))]));
  const status = root.querySelector('[data-status]');
  const all = () => [...rows.flatMap((r) => Object.values(r.cells)), ...Object.values(top)];
  const charsFor = (kind) => (cfg.charset === 'mixed' ? MIXED[kind] : cfg.charset);

  // Decode one cell into text. The live twin starts from whatever it shows, so a change decodes old → new.
  const decode = (c, text, { delay = 0, force = false, paused = false, instant = false } = {}) => {
    if (c.text === text && !force) return null;
    c.text = text;
    c.mirror.textContent = text;
    c.anim?.cancel();
    c.anim = null;
    if (!full || instant) { c.live.textContent = text; return null; }
    c.anim = animate(c.live, {
      innerHTML: scrambleText({ chars: charsFor(c.kind), cursor: cfg.cursor ? '░▒▓█' : '', revealRate: cfg.reveal, settleRate: cfg.settle, text }),
      delay: paused ? 0 : delay, // a paused decode is placed by seek() instead
      ease: 'linear',
      autoplay: !paused,
      onComplete: () => { c.live.textContent = text; c.anim = null; },
    });
    return c.anim;
  };
  ctx.onCleanup(() => all().forEach((c) => c.anim?.cancel()));

  // Write the board; changed cells decode, staggered by row and column.
  const render = ({ force = false, paused = false, instant = false } = {}) => {
    const anims = [];
    deps.forEach((d, r) => {
      const v = valuesOf(d);
      rows[r].tr.dataset.status = v.status.split(' ')[0].toLowerCase();
      COLS.forEach((k, i) => anims.push([decode(rows[r].cells[k], v[k], { delay: r * 90 + i * 60, force, paused, instant }), r * 90 + i * 60]));
    });
    const next = deps.find((d) => d.at + d.delay > clock) || deps[0];
    const nv = valuesOf(next);
    anims.push([decode(top.big, nv.time, { force, paused, instant }), 0]);
    anims.push([decode(top.line, `${nv.ferry} FROM ${nv.from} · ${nv.status}`, { delay: 120, force, paused, instant }), 120]);
    anims.push([decode(top.clock, hhmm(clock), { delay: 60, force, paused, instant }), 60]);
    return anims.filter(([a]) => a);
  };

  // A refresh: the clock moves on, a departed ferry leaves the board and a new one joins the end.
  const refresh = () => {
    clock += 2;
    if (deps[0].at + deps[0].delay < clock) deps = [...deps.slice(1), departure(deps[deps.length - 1].at + 5 + Math.floor(Math.random() * 5))];
    const pick = deps[2 + Math.floor(Math.random() * 3)];
    if (Math.random() < 0.35) pick.delay = pick.delay ? 0 : 2 + Math.floor(Math.random() * 5);
    deps.forEach((d) => { d.full = d === deps[1] && statusOf(d) === 'BOARDING' && Math.random() < 0.3; });
    render();
  };

  // Every value is written once without animation, so the board reads before the fonts arrive.
  render({ instant: true });

  document.fonts.ready.then(() => {
    if (ctx.signal.aborted) return;
    if (ctx.capture) {
      // The thumbnail: the arrival decode held part-way, the top rows landed and the rest still scrambling.
      render({ force: true, paused: true }).forEach(([a, delay]) => a.seek(Math.max(0, 800 - delay)));
      return;
    }
    render({ force: true });
  });

  on(ctx, root.querySelector('[data-refresh]'), 'click', () => { refresh(); status.textContent = `Departures updated at ${hhmm(clock)}`; });
  rows.forEach((r) => on(ctx, r.tr, 'pointerenter', () => {
    if (!cfg.hover) return;
    COLS.forEach((k, i) => decode(r.cells[k], r.cells[k].text, { delay: i * 50, force: true }));
  }));

  let timer = 0;
  const startLive = () => { if (cfg.live && !timer && !ctx.capture) timer = setInterval(refresh, 7000); };
  const stopLive = () => { clearInterval(timer); timer = 0; };
  let onScreen = false;
  whileVisible(ctx, root.querySelector('.sc__board'), () => { onScreen = true; startLive(); }, () => { onScreen = false; stopLive(); });
  ctx.onCleanup(stopLive);

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('live')) { stopLive(); if (onScreen) startLive(); }
      if (changed.some((k) => ['charset', 'reveal', 'settle', 'cursor'].includes(k))) render({ force: true });
    },
    action(id) { if (id === 'update') refresh(); },
  };
}
