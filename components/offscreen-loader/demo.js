// Off-thread loader — a banking app's "preparing your export" panel. The loader's canvas goes to a Worker through
// transferControlToOffscreen(), but only after a hello handshake: a transferred canvas can never give a context on
// the main thread again, so the transfer waits for proof the Worker is alive (1000 ms). One draw function and one
// message handler run in the Worker on its own requestAnimationFrame, or on the main thread's ticker as the fallback
// (timeout, error, no support, or chosen). The step counter and the spinner are main-thread JavaScript on purpose:
// "Block the main thread" freezes them and not the loader. Reduced and static: one settled frame, no loop.
import './demo.css';
import { on, ticker, observeIntersection, observeResize, readToken, html, content } from '../../src/demo-kit/index.js';

// Shared verbatim by both threads. Each function is self-contained (no outer names), because the Worker is built
// from their source text: that keeps one copy of the drawing and survives minification.
function drawFrame(ctx, t, colors) {
  const TAU = Math.PI * 2;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = Math.min(w, h) * 0.36;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  // A ring of ticks whose lengths ripple around the circle.
  ctx.strokeStyle = colors.ink;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, s * 0.014);
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const r = s * 1.1;
    const len = s * (0.04 + 0.09 * (0.5 + 0.5 * Math.sin(a * 3 - t * 2.4)));
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // A pen tracing a Lissajous figure, its trail the last 1.6 s of the path.
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = Math.max(2, s * 0.032);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let x = cx;
  let y = cy;
  for (let k = 0; k <= 120; k++) {
    const u = t - 1.6 * (1 - k / 120);
    x = cx + s * 0.86 * Math.sin(u * 1.5 + 0.6);
    y = cy + s * 0.7 * Math.sin(u * 2);
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(3, s * 0.05), 0, TAU);
  ctx.fill();
}

// One handler for both threads. clock(fn) calls fn(dt) every frame and returns a stop function.
function createHandler(clock, draw) {
  const STILL_T = 2.2; // the settled frame under reduced motion
  let ctx = null;
  let colors = null;
  let animate = false;
  let t = STILL_T;
  let stop = null;
  let frames = 0;
  const paint = () => { if (ctx && colors) draw(ctx, t, colors); };
  const tick = (dt) => { t += dt; frames++; paint(); };
  return (msg) => {
    if (msg.type === 'init') { ctx = msg.canvas.getContext('2d'); colors = msg.colors; t = msg.animate ? 0 : STILL_T; }
    else if (msg.colors) { colors = msg.colors; paint(); }
    if ('animate' in msg) {
      animate = msg.animate;
      if (!animate && msg.type !== 'init') { t = STILL_T; paint(); }
    }
    if (msg.width && ctx) { ctx.canvas.width = msg.width; ctx.canvas.height = msg.height; paint(); }
    if ('run' in msg) {
      const go = msg.run && animate;
      if (go && !stop) stop = clock(tick);
      if (!go && stop) { stop(); stop = null; }
    }
    return msg.type === 'count' ? frames : undefined;
  };
}

// The Worker's own frame clock: requestAnimationFrame exists in a dedicated worker that owns an OffscreenCanvas.
function workerClock(fn) {
  let last = 0;
  let id = 0;
  const frame = (now) => { fn(last ? Math.min(0.1, (now - last) / 1000) : 1 / 60); last = now; id = requestAnimationFrame(frame); };
  id = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(id);
}

const workerSource = () => `
const draw = (${drawFrame.toString()});
const clock = (${workerClock.toString()});
const handle = (${createHandler.toString()})(clock, draw);
self.onmessage = ({ data }) => {
  if (data.type === 'hello') { self.postMessage({ type: 'hello' }); return; }
  const out = handle(data);
  if (data.type === 'count') self.postMessage({ type: 'count', id: data.id, frames: out });
};`;

const RECEIPTS = 312;
const START = 212;
const nf = (n) => n.toLocaleString('en-GB');

export default function mount(root, options, ctx) {
  const { app } = content;
  let cfg = { ...options };
  const animate = ctx.motion === 'full';
  root.className = 'ol';
  root.innerHTML = html`
    <div class="ol__app" inert aria-hidden="true">
      <aside class="ol__side"><span class="ac-brand">${app.name}</span>${['Overview', 'Invoices', 'Cards', 'Tax pot', 'Exports'].map((n) => html`<span class="ol__nav${n === 'Exports' ? ' is-on' : ''}">${n}</span>`)}</aside>
      <div class="ol__main">
        <p class="ac-label">Exports</p>
        <p class="ol__h">Exports for your accountant</p>
        ${['2025 · full year', '2024 · full year', 'Q4 2025', 'Q3 2025'].map((n, i) => html`<div class="ol__row"><span>${n}</span><span>CSV + PDF</span><span>${['3.8', '3.1', '1.2', '1.0'][i]} MB</span></div>`)}
      </div>
    </div>
    <div class="ol__scrim" aria-hidden="true"></div>
    <section class="ol__panel" role="dialog" aria-modal="true" aria-labelledby="ol-title" aria-describedby="ol-desc">
      <div class="ol__head"><p class="ac-label">Export · Year 2026</p><button class="ol__x" type="button" aria-label="Cancel the export"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <h1 class="ol__title" id="ol-title" data-title>Preparing your export</h1>
      <p class="ac-small" id="ol-desc">Everything your accountant asked for, in one file. Keep this window open; it takes about a minute.</p>
      <figure class="ol__loader" data-stage>
        <canvas aria-hidden="true" data-canvas></canvas>
        <figcaption class="ol__thread"><i data-thread-dot></i><output aria-live="polite" data-thread>Starting the loader…</output></figcaption>
      </figure>
      <ol class="ol__steps" role="list">
        <li class="is-done"><i aria-hidden="true"></i><span>Transactions</span><span class="ac-num">${nf(1284)}</span></li>
        <li class="is-active" data-step="receipts"><i aria-hidden="true"></i><span>Matching receipts</span><span class="ac-num" data-receipts>${START} of ${RECEIPTS}</span></li>
        <li data-step="pdf"><i aria-hidden="true"></i><span>Summary PDF</span><span class="ac-num" data-pdf>Waiting</span></li>
      </ol>
      <div class="ol__bar" aria-hidden="true"><span data-bar></span></div>
      <div class="ol__check">
        <p class="ol__lane"><svg class="ol__spin" viewBox="0 0 24 24" aria-hidden="true" data-spin><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9"/></svg><span><strong>Main thread</strong><span data-main-state>Responsive</span></span></p>
        <button class="ac-btn ac-btn--sm ac-btn--ghost" type="button" data-block>Block the main thread</button>
      </div>
      <p class="ol__report ac-small" aria-live="polite" data-report>The counter and the spinner run on the main thread; the loader does not.</p>
      <div class="ol__foot"><span class="ac-small">CSV + PDF · about 4 MB</span><button class="ac-btn ac-btn--sm" type="button" disabled data-download>Download</button></div>
    </section>`;

  const $ = (s) => root.querySelector(s);
  let canvas = $('[data-canvas]');
  const stage = $('[data-stage]');
  const threadOut = $('[data-thread]');
  const blockBtn = $('[data-block]');
  const report = $('[data-report]');
  const colours = () => ({ ink: readToken('--ink'), accent: readToken('--accent') });

  // 1. The hand-off: hello first, transfer second, the same handler on the main thread as the fallback.
  let mode = 'pending';
  let worker = null;
  let url = '';
  let send = () => {};
  let count = () => Promise.resolve(0);
  let visible = true;
  let helloTimer = 0;
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { width: Math.max(1, Math.round(canvas.clientWidth * dpr)), height: Math.max(1, Math.round(canvas.clientHeight * dpr)) };
  };
  const start = (next, reason) => {
    mode = next;
    root.dataset.thread = next;
    threadOut.textContent = next === 'worker' ? 'Drawn in a Worker · OffscreenCanvas' : `Drawn on the main thread · ${reason}`;
    send({ type: 'init', colors: colours(), animate: animate && !done, ...size() });
    send({ run: visible });
  };
  const runOnMain = (reason) => {
    worker?.terminate();
    worker = null;
    if (mode === 'worker') {
      // The old canvas belongs to the dead Worker and can never give a context here: swap in a fresh one.
      const fresh = canvas.cloneNode();
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
    const handle = createHandler((fn) => { ticker.add(fn); return () => ticker.remove(fn); }, drawFrame);
    send = (msg) => handle(msg.type === 'init' ? { ...msg, canvas } : msg);
    count = () => Promise.resolve(handle({ type: 'count' }));
    start('main', reason);
  };
  const runInWorker = () => {
    const offscreen = canvas.transferControlToOffscreen();
    send = (msg) => (msg.type === 'init' ? worker.postMessage({ ...msg, canvas: offscreen }, [offscreen]) : worker.postMessage(msg));
    let seq = 0;
    const waiting = new Map();
    on(ctx, worker, 'message', ({ data }) => { if (data.type === 'count') { waiting.get(data.id)?.(data.frames); waiting.delete(data.id); } });
    count = () => new Promise((resolve) => { seq++; waiting.set(seq, resolve); worker.postMessage({ type: 'count', id: seq }); });
    start('worker', 'hello');
  };
  ctx.onCleanup(() => {
    clearTimeout(helloTimer);
    send({ run: false });
    worker?.terminate();
    if (url) URL.revokeObjectURL(url);
  });

  const supported = 'transferControlToOffscreen' in HTMLCanvasElement.prototype && typeof Worker !== 'undefined';
  let done = false;
  if (cfg.mode === 'main' || !supported) {
    runOnMain(cfg.mode === 'main' ? 'chosen in the controls' : 'no OffscreenCanvas here');
  } else {
    try {
      url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
      worker = new Worker(url);
      helloTimer = setTimeout(() => runOnMain('the Worker did not answer'), cfg.hello);
      on(ctx, worker, 'message', ({ data }) => { if (data.type === 'hello' && mode === 'pending') { clearTimeout(helloTimer); runInWorker(); } });
      on(ctx, worker, 'error', () => { clearTimeout(helloTimer); if (mode !== 'main') runOnMain('the Worker failed'); });
      worker.postMessage({ type: 'hello' });
    } catch {
      runOnMain('the Worker could not start');
    }
  }
  observeIntersection(ctx, stage, ([e]) => { visible = e.isIntersecting; if (mode !== 'pending') send({ run: visible }); });
  observeResize(ctx, stage, () => { if (mode !== 'pending') send(size()); });
  ctx.onTheme(() => send({ colors: colours() }));

  // 2. The main thread's own work: the receipt counter, the bar and a JavaScript spinner (not CSS, which the
  //    compositor would keep turning through a block).
  const receiptsEl = $('[data-receipts]');
  const pdfEl = $('[data-pdf]');
  const bar = $('[data-bar]');
  const spin = $('[data-spin]');
  let matched = START;
  let pdf = 0;
  let angle = 0;
  const render = () => {
    receiptsEl.textContent = matched >= RECEIPTS ? `${RECEIPTS} matched` : `${Math.floor(matched)} of ${RECEIPTS}`;
    pdfEl.textContent = matched < RECEIPTS ? 'Waiting' : pdf >= 1 ? 'Ready' : `${Math.round(pdf * 100)} %`;
    root.querySelector('[data-step="receipts"]').className = matched >= RECEIPTS ? 'is-done' : 'is-active';
    root.querySelector('[data-step="pdf"]').className = pdf >= 1 ? 'is-done' : matched >= RECEIPTS ? 'is-active' : '';
    bar.style.transform = `scaleX(${(0.42 + 0.48 * Math.min(1, (matched - START) / (RECEIPTS - START)) + 0.1 * pdf).toFixed(4)})`;
  };
  const finish = () => {
    done = true;
    $('[data-title]').textContent = 'Your export is ready';
    $('[data-download]').disabled = false;
    send({ animate: false, run: false });
    work.stop();
  };
  const work = {
    on: false,
    tick: (dt) => {
      if (matched < RECEIPTS) matched = Math.min(RECEIPTS, matched + dt * 6);
      else pdf = Math.min(1, pdf + dt / 4);
      if (animate) { angle = (angle + dt * 300) % 360; spin.style.transform = `rotate(${angle.toFixed(1)}deg)`; }
      render();
      if (pdf >= 1) finish();
    },
    start() { if (!this.on && ctx.motion !== 'static') { this.on = true; ticker.add(this.tick); } },
    stop() { if (this.on) { this.on = false; ticker.remove(this.tick); } },
  };
  ctx.onCleanup(() => work.stop());
  render();
  work.start();

  // 3. The proof: hog the main thread. A Worker keeps drawing; the fallback freezes with everything else.
  let blocking = false;
  const block = async () => {
    if (blocking) return;
    blocking = true;
    const ms = cfg.block * 1000;
    blockBtn.disabled = true;
    $('[data-main-state]').textContent = 'Blocked';
    root.classList.add('is-blocked');
    report.textContent = `Blocking the main thread for ${cfg.block.toFixed(1)} s…`;
    const before = await count();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // let "Blocked" paint first
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { /* busy: no events, no frames, no timers on this thread */ }
    const drawn = Math.max(0, (await count()) - before);
    if (ctx.signal.aborted) return;
    blocking = false;
    blockBtn.disabled = false;
    root.classList.remove('is-blocked');
    $('[data-main-state]').textContent = 'Responsive';
    report.textContent = mode === 'worker'
      ? `The main thread was blocked for ${cfg.block.toFixed(1)} s. The loader drew ${nf(drawn)} frames meanwhile, in its Worker.`
      : `The main thread was blocked for ${cfg.block.toFixed(1)} s, and the loader froze with it: it shares that thread.`;
  };
  on(ctx, blockBtn, 'click', block);
  const label = () => { blockBtn.textContent = `Block the main thread for ${cfg.block % 1 ? cfg.block.toFixed(1) : cfg.block} s`; };
  label();

  return {
    update(next, changed) {
      cfg = { ...next };
      label();
      if (changed.includes('mode')) return false; // a transferred canvas cannot come back: mount a fresh one
      return undefined;
    },
    action(id) {
      if (id === 'block') block();
      if (id === 'restart') {
        done = false; matched = START; pdf = 0;
        $('[data-title]').textContent = 'Preparing your export';
        $('[data-download]').disabled = true;
        send({ animate, run: visible });
        render();
        work.start();
      }
    },
  };
}
