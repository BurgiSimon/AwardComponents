// Frame-exact film scrub — Meridian's exhibition page for “One orbit”. A twelve-second time-lapse from the station
// window (the shared orbit footage) is packed offline by pack.mjs into one file: H.264 chunks back to back, a JSON
// manifest of every frame's offset, length, timestamp and type, and a four-byte pointer to the manifest. The page
// fetches it once and WebCodecs decodes exactly the frame the scroll names, on a sticky stage; the four captions land
// when the frame on screen reaches their share of the clip. The decoding rules live in scrubber.js.
// Without WebCodecs or an H.264 decoder the shared WebM is scrubbed by <video>.currentTime instead (not frame-exact).
// Reduced motion and static: no film at all, one still above the captions as a list.
import './demo.css';
import { on, html, clamp, video, content, observeResize } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';
import { readPack, decoderConfig, FrameScrubber, VideoScrubber } from './scrubber.js';

const FILM_URL = new URL('./film.bin', import.meta.url).href;
const FILM_KB = 777;                 // what the readout announces while the file loads (pack.mjs prints it)
const FALLBACK = { fps: 30, total: 360, bars: 16 };   // the shared WebM: 30 fps; 16 rows off each edge, as pack.mjs crops
const FLY_SECONDS = 9;

// One fetch per page visit, shared by every mount; a failed fetch is forgotten so the next mount tries again.
let packed = null;
function loadPack() {
  packed ??= fetch(FILM_URL)
    .then((r) => { if (!r.ok) throw new Error(`film.bin: HTTP ${r.status}`); return r.arrayBuffer(); })
    .then(readPack)
    .catch((e) => { packed = null; throw e; });
  return packed;
}

const pad = (n, w = 3) => String(n).padStart(w, '0');
const num = (n) => n.toLocaleString('en');

export default function mount(root, options, ctx) {
  const { observatory: m } = content;
  const footage = video('video-earth-orbit');
  const captions = m.orbit;
  let cfg = { ...options };
  const full = ctx.motion === 'full';

  root.className = `wc${full ? '' : ' wc--still'}${ctx.capture ? ' wc--capture' : ''}`;
  root.style.setProperty('--track', `${cfg.track}svh`);
  root.innerHTML = html`
    <section class="wc__track" data-track aria-labelledby="wc-title">
      <div class="wc__stage">
        <header class="ac-bar wc__bar">
          <a class="ac-brand" href="#top">${m.name}</a>
          <nav aria-label="${m.name}"><a href="#top">Shows</a><a href="#top" aria-current="page">Exhibitions</a><a href="#top">Visit</a></nav>
          <a class="ac-btn ac-btn--sm" href="#wc-visit" data-to-visit>Tickets</a>
        </header>
        <div class="wc__intro" data-intro>
          <p class="ac-label wc__kicker">Exhibition · ${m.exhibition.dates}</p>
          <h1 class="ac-display wc__title" id="wc-title">${m.exhibition.title}</h1>
          <p class="wc__dek">${m.exhibition.dek}</p>
          <p class="ac-label wc__cue" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2v11M3.5 8.5 8 13l4.5-4.5"/></svg>Scroll to fly the orbit</p>
        </div>
        <figure class="wc__film" data-film>
          ${footage ? html`<img class="wc__poster" src="${footage.poster}" alt="" width="1800" height="1013" decoding="async">` : ''}
          <canvas class="wc__canvas" data-canvas aria-hidden="true"></canvas>
          <figcaption class="sr-only">${footage ? footage.alt : ''} Twelve seconds of the orbit, one frame for every step of the scroll.</figcaption>
        </figure>
        <ol class="wc__caps" role="list" aria-label="What the film shows, in order">
          ${captions.map((c, i) => html`<li class="wc__cap" data-cap="${i}"><span class="ac-label wc__num">${pad(i + 1, 2)} / ${pad(captions.length, 2)}</span><p class="wc__line">${c.label}</p></li>`)}
        </ol>
        <p class="wc__readout" data-readout aria-hidden="true"></p>
        <div class="wc__meta" aria-hidden="true">
          <div class="wc__rail" data-rail>
            <span class="wc__fill"></span>
            ${captions.map((c, i) => html`<span class="wc__tick" data-tick="${i}" style="--at:${c.at}"><b>${pad(i + 1, 2)}</b></span>`)}
            <span class="wc__head"></span>
          </div>
        </div>
      </div>
    </section>

    <section class="wc__visit ac-wrap" id="wc-visit" aria-labelledby="wc-visit-title">
      <div class="wc__visit-head">
        <p class="ac-label">Dome gallery · ${m.place}</p>
        <h2 class="ac-h1" id="wc-visit-title" tabindex="-1">The whole orbit, on a wall eleven metres wide.</h2>
        <p class="ac-lede">This page holds twelve seconds of it. In the gallery the film runs all ninety-two minutes, start to finish, on a loop from opening to close.</p>
        <a class="ac-btn ac-btn--accent ac-btn--lg" href="#top">Book a time</a>
      </div>
      <dl class="wc__facts">
        ${m.visit.map((v) => html`<div><dt class="ac-label">${v.label}</dt><dd>${v.value}</dd></div>`)}
        <div><dt class="ac-label">Dates</dt><dd>${m.exhibition.dates}</dd></div>
      </dl>
      ${footage ? html`<p class="ac-small wc__credit">Footage: <a class="ac-link" href="${footage.page}" target="_blank" rel="noopener">${footage.credit}</a>.</p>` : ''}
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const track = root.querySelector('[data-track]');
  const film = root.querySelector('[data-film]');
  const canvas = root.querySelector('[data-canvas]');
  const intro = root.querySelector('[data-intro]');
  const caps = [...root.querySelectorAll('[data-cap]')];
  const ticks = [...root.querySelectorAll('[data-tick]')];
  const rail = root.querySelector('[data-rail]');
  const readout = root.querySelector('[data-readout]');
  const visit = root.querySelector('#wc-visit');
  const g = canvas.getContext('2d', { alpha: false });
  const applyLook = () => {
    root.classList.toggle('wc--no-readout', !cfg.readout);
    root.classList.toggle('wc--no-rail', !cfg.rail);
  };
  applyLook();
  // An in-page link moves focus with the scroll, as a native one would; a ring only when it was pressed with a key.
  const toVisit = (e) => root.querySelector('#wc-visit-title').focus({ preventScroll: true, focusVisible: e.detail === 0 });

  // ── Captions: each lands when the frame on screen reaches its share of the clip ─────────────────────────────────
  let active = null;
  const setShare = (p) => {
    rail.style.setProperty('--p', p.toFixed(4));
    let idx = -1;
    captions.forEach((c, i) => { if (p >= c.at) idx = i; });
    if (idx === active) return;
    active = idx;
    intro.classList.toggle('is-on', idx === -1);
    caps.forEach((el, i) => el.classList.toggle('is-on', i === idx));
    ticks.forEach((el, i) => el.classList.toggle('is-past', i <= idx));
  };

  // Reduced motion and static: the poster as the one still, the captions as a list, nothing fetched or decoded.
  if (!full) {
    setShare(0);
    readout.textContent = '';
    const toList = () => root.querySelector('.wc__caps').scrollIntoView({ block: 'center' });
    on(ctx, root.querySelector('[data-to-visit]'), 'click', (e) => { e.preventDefault(); visit.scrollIntoView(); toVisit(e); });
    return {
      update(next) { cfg = { ...next }; applyLook(); root.style.setProperty('--track', `${cfg.track}svh`); return true; },
      action(id) { if (id === 'fly' || id === 'next') toList(); },
    };
  }

  // ── The canvas: covers the panel, never backed by more pixels than the film has ──────────────────────────────────
  const geo = { dx: 0, dy: 0, dw: 0, dh: 0, fw: 640, fh: 336 };
  const layout = () => {
    const box = film.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cover = Math.max(box.width / geo.fw, box.height / geo.fh);     // CSS px per film px
    const ratio = Math.min(dpr, 1 / cover);                              // backing px per CSS px
    const w = Math.max(1, Math.round(box.width * ratio));
    const h = Math.max(1, Math.round(box.height * ratio));
    const scale = cover * ratio;                                         // backing px per film px, at most 1
    const focusX = parseFloat(getComputedStyle(root).getPropertyValue('--focus-x')) || 0.5;
    const dw = Math.round(geo.fw * scale);
    const dh = Math.round(geo.fh * scale);
    const next = { dw, dh, dx: Math.round((w - dw) * focusX), dy: Math.round((h - dh) / 2) };
    const moved = Object.keys(next).some((k) => next[k] !== geo[k]);
    Object.assign(geo, next);
    if (canvas.width === w && canvas.height === h) return moved;
    canvas.width = w;     // clears the canvas: the caller draws the frame again
    canvas.height = h;
    return true;
  };

  let engine = null;
  let mode = 'loading';
  let reason = '';
  let wanted = 0;              // the scroll's share of the clip, 0–1
  let shownFrame = null;
  let total = FALLBACK.total;
  let clipInfo = null;

  const paint = (src, i, crop) => {
    if (crop) g.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, geo.dx, geo.dy, geo.dw, geo.dh);
    else g.drawImage(src, geo.dx, geo.dy, geo.dw, geo.dh);
    shownFrame = i;
    root.classList.add('wc--live');
    setShare(total > 1 ? i / (total - 1) : 0);
    queueReadout();
  };

  // ── The readout: a developer's view of the mechanism, decoration for assistive tech ──────────────────────────────
  let rq = 0;
  const item = (k, v) => html`<i>${k}</i><b>${v}</b>`;
  const renderReadout = () => {
    rq = 0;
    if (!cfg.readout) return;
    const frame = shownFrame === null ? '—' : pad(shownFrame + 1);
    if (mode === 'webcodecs') {
      const s = engine.stats;
      readout.innerHTML = html`${item('H.264', `${Math.round(clipInfo.bytes / 1024)} KB · key every ${clipInfo.keyEvery}`)}${item('Frame', `${frame} / ${total}`)}${item('Asked', `${num(s.requests)} · decoded ${num(s.decodes)}`)}${item('Cache', `${engine.cached} / ${engine.cacheSize} · ${num(s.cacheHits)} hits`)}`;
    } else if (mode === 'video') {
      const s = engine.stats;
      readout.innerHTML = html`${item('Video', 'currentTime · not frame-exact')}${reason ? item('Why', reason) : ''}${item('Frame', `${frame} / ${total}`)}${item('Asked', `${num(s.requests)} · seeked ${num(s.seeks)}`)}`;
    } else if (mode === 'failed') {
      readout.innerHTML = html`${item('Film', 'not playable here · the still stays')}`;
    } else {
      readout.innerHTML = html`${item('Loading', `the film · ${FILM_KB} KB, one file`)}`;
    }
  };
  const queueReadout = () => { if (!rq) rq = requestAnimationFrame(renderReadout); };
  ctx.onCleanup(() => cancelAnimationFrame(rq));
  renderReadout();

  // ── The scroll names a frame ──────────────────────────────────────────────────────────────────────────────────────
  const request = (p) => {
    wanted = clamp(p, 0, 1);
    if (engine) engine.seek(wanted * (total - 1));
    else setShare(wanted);   // no picture yet: the captions follow the scroll
    queueReadout();
  };

  // ── Engines ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const stop = () => { engine?.destroy(); engine = null; };
  ctx.onCleanup(stop);
  ctx.onCleanup(() => { if (window.__wcScrub === hook) delete window.__wcScrub; });

  const startVideo = (why) => {
    stop();
    reason = why;
    if (!footage) { mode = 'failed'; root.dataset.engine = 'still'; queueReadout(); return; }
    const video = document.createElement('video');
    Object.assign(video, { muted: true, playsInline: true, preload: 'auto', disableRemotePlayback: true });
    video.className = 'wc__video';
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    video.src = footage.src;
    film.append(video);
    total = FALLBACK.total;
    const s = new VideoScrubber(video, {
      fps: FALLBACK.fps, total, bars: FALLBACK.bars, draw: paint, onChange: queueReadout, signal: ctx.signal,
      onError: () => { if (engine === s) { stop(); mode = 'failed'; root.dataset.engine = 'still'; queueReadout(); } },
    });
    engine = s;
    mode = 'video';
    root.dataset.engine = 'video';
    s.seek(wanted * (total - 1));
    queueReadout();
  };

  const startFrames = (clip, config) => {
    stop();
    clipInfo = clip;
    total = clip.totalFrames;
    geo.fw = clip.width;
    geo.fh = clip.height;
    layout();
    const s = new FrameScrubber(clip, config, {
      draw: paint, cacheSize: cfg.cache, bitmapWidth: geo.dw, onChange: queueReadout,
      // A decoder that dies mid-scroll (a GPU process restart, a chunk it refuses) hands over to the <video> path.
      onError: () => { if (engine === s) startVideo('the decoder stopped'); },
    });
    engine = s;
    mode = 'webcodecs';
    root.dataset.engine = 'webcodecs';
    s.seek(wanted * (total - 1));
    queueReadout();
  };

  const boot = async () => {
    if (cfg.engine !== 'webcodecs') { startVideo(''); return; }
    if (typeof window.VideoDecoder !== 'function') { startVideo('no WebCodecs here'); return; }
    try {
      const clip = await loadPack();
      if (ctx.signal.aborted) return;
      const config = await decoderConfig(clip);
      if (ctx.signal.aborted) return;
      if (config) startFrames(clip, config);
      else startVideo('no H.264 decoder here');
    } catch {
      if (!ctx.signal.aborted) startVideo('the film did not load');
    }
  };

  layout();
  observeResize(ctx, film, () => {
    if (!layout()) return;
    engine?.resize?.(geo.dw);
    engine?.refresh();
  });

  // ── Scroll: a 420 svh track, the stage sticky inside it, one tween from top top to bottom bottom ─────────────────
  const lenis = useLenis(ctx);
  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  const head = { p: 0 };
  let tween = null;
  const build = () => {
    tween?.scrollTrigger?.kill();
    tween?.kill();
    const scrub = ctx.capture || cfg.smoothing <= 0 ? true : cfg.smoothing;
    tween = context.add(() => gsap.fromTo(head, { p: 0 }, {
      p: 1, ease: 'none', immediateRender: false,
      onUpdate: () => request(head.p),
      scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub, invalidateOnRefresh: true },
    }));
    tween.progress(tween.scrollTrigger.progress);
    request(head.p);
  };
  build();
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) ScrollTrigger.refresh(); });

  const st = () => tween.scrollTrigger;
  const yAt = (p) => st().start + clamp(p, 0, 1) * (st().end - st().start);
  const scrollTo = (y, opts = {}) => {
    if (lenis) lenis.scrollTo(y, { force: true, ...opts });
    else { window.scrollTo(0, y); ScrollTrigger.update(); }
  };
  on(ctx, root.querySelector('[data-to-visit]'), 'click', (e) => {
    e.preventDefault();
    if (lenis) lenis.scrollTo(visit, { duration: 1.4 }); else visit.scrollIntoView();
    toVisit(e);
  });

  boot();

  // For verification scripts: the engine and the mechanism's counters (removed on unmount).
  const hook = {
    get mode() { return mode; },
    get shown() { return shownFrame; },
    get target() { return Math.round(wanted * (total - 1)); },
    get total() { return total; },
    get stats() { return engine ? { ...engine.stats, busy: engine.busy, cached: engine.cached ?? 0 } : null; },
    get geo() { return { ...geo, width: canvas.width, height: canvas.height }; },
    seek(i) { engine?.seek(i); },
    go(p) { scrollTo(yAt(p), { immediate: true }); },
  };
  window.__wcScrub = hook;

  return {
    update(next, changed) {
      if (changed.includes('engine')) return false;
      cfg = { ...next };
      applyLook();
      if (changed.includes('cache')) engine?.setCacheSize?.(cfg.cache);
      if (changed.includes('track')) { root.style.setProperty('--track', `${cfg.track}svh`); ScrollTrigger.refresh(); }
      if (changed.includes('smoothing')) build();
      if (changed.includes('readout')) renderReadout();
      return true;
    },
    action(id) {
      if (id === 'fly') {
        // Play the clip by scrolling the page through the track: from the top when it is already at the end.
        if (st().progress > 0.97) scrollTo(yAt(0), { immediate: true });
        scrollTo(yAt(1), { duration: FLY_SECONDS, easing: (t) => -(Math.cos(Math.PI * t) - 1) / 2 });
      } else if (id === 'next') {
        // Straight to the next caption's moment: a jump the decoder answers from the nearest keyframe.
        const next = captions[((active ?? -1) + 1) % captions.length];
        scrollTo(yAt(next.at + 0.02), { immediate: true });
      }
    },
  };
}
