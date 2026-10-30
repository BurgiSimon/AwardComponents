// Woven long-read — Fieldnote's weather issue, "Salt and time", where every picture on the page is a dither woven by
// ONE raw-WebGL context on a detached canvas (pool.js). Five scenes (the hero, two chapters, a glyph interlude and
// the close) are ordinary 2D canvases inside their sections, so they scroll natively and sit under the section's
// text: the pool draws a scene into the top-left slice of its shared buffer and drawImage()s that slice across in the
// same task. Three shared clips and one drawn sleet stream are pooled: one texture each, uploaded at most once per
// new frame however many scenes show it, playing only while a visible scene shows them. A scene draws only on screen
// and only when something it shows changed, at 30 fps at most. Light grounds take normal levels (20 / 235), dark
// grounds inverted ones (225 / 35). The season switch swaps two layers of one scene by their levels over 1.2 s, and
// a theme change redevelops a flipped section at its new levels: never a cross-fade between two pictures. The hero
// develops on arrival (1.6 s), the rest with the scroll. A page-level Pause
// footage button stops every clip. Reduced and static: one developed still per scene from the posters, no clock, no
// pause. No WebGL: the posters as quiet greyscale pictures.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, onFrame, html, raw, videos, credit, observeIntersection, observeResize, readToken, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { createPool, parseColour } from './pool.js';
import { createSleet } from './sleet.js';

const DPR_CAP = 1.5;
const ARRIVAL = 1.6;          // s: the hero develops after load
const SWAP = 1.2;             // s: the season switch and a theme change slide levels
const NORMAL = [20, 235];     // black, white points on a light ground
const INVERTED = [225, 35];   // on a dark ground: a light subject reads positive in light ink
const SLEET_AT = 6.4;         // s: the sleet's still frame
const SOURCES = { earth: 'video-earth-rotation', orbit: 'video-earth-orbit', clouds: 'video-desert-clouds' };

// Each scene's layers. fit / align / zoom place a clip like object-fit / object-position; key is the black point
// under which a cell is cut out (the space round the planet); a seasonal layer belongs to one season.
const SCENES = {
  hero: { layers: [{ clip: 'earth', fit: 'contain', align: [1, 0.5], zoom: 1.04, key: 0.07, gamma: 0.55 }] },
  kilns: {
    layers: [
      { clip: 'clouds', fit: 'cover', align: [0.5, 0.32], key: -1, season: 'summer' },
      { clip: 'clouds', fit: 'cover', align: [0.5, 0.32], key: -1, gamma: 2.1, season: 'winter' },
      { clip: 'sleet', fit: 'cover', key: 0.05, keyEdge: false, season: 'winter' },
    ],
  },
  // The whole curve of the horizon with the solar wing crossing it; the station's truss along the top is cropped away.
  pan: { layers: [{ clip: 'orbit', fit: 'cover', align: [1, 0.85], zoom: 1.14, key: 0.11, gamma: 0.85 }] },
  interlude: { glyphs: true, layers: [{ clip: 'earth', fit: 'contain', align: [0.92, 0.5], zoom: 1.04, key: 0.07 }] },
  close: { layers: [{ clip: 'clouds', fit: 'cover', align: [0.5, 0.5], key: -1 }] },
};

const CAPTIONS = {
  hero: ['Fig. 1', 'The day side of the Earth from 1.5 million km, Europe and Africa under one day’s cloud.', 'NASA Goddard / DSCOVR EPIC, public domain'],
  summer: ['Fig. 2', 'A high cloud layer crossing the Mojave in one afternoon, as a time-lapse.', 'NPS / Kristi Rugg, public domain'],
  winter: ['Fig. 2', 'The same sky set for winter, with sleet drawn over it.', 'NPS / Kristi Rugg, public domain; sleet drawn'],
  pan: ['Fig. 3', 'The curve of the Earth from the space station, about 400 km up, with one of its solar wings across it.', 'NASA, public domain'],
  interlude: ['Fig. 1, again', 'The same footage, set in type.', 'NASA Goddard / DSCOVR EPIC, public domain'],
  interludeBars: ['Fig. 1, again', 'The same footage, woven light on the dark band.', 'NASA Goddard / DSCOVR EPIC, public domain'],
  interludeStill: ['Fig. 1, again', 'The same footage, beside the quote.', 'NASA Goddard / DSCOVR EPIC, public domain'],
  close: ['Fig. 4', 'The line of the hills under figure 2’s cloud, from the same time-lapse.', 'NPS / Kristi Rugg, public domain'],
};

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const article = magazine.articles[0];
  const more = magazine.articles.slice(1);
  const [p1, p2, p3, p4, p5] = magazine.longRead;
  let cfg = { ...options };
  // Full: the clock runs and the footage plays. Reduced, static and the thumbnail capture: one still per scene.
  const full = ctx.motion === 'full' && !ctx.capture;
  const media = Object.fromEntries(Object.entries(SOURCES).map(([k, id]) => [k, videos.find((v) => v.id === id) || null]));
  credit(...Object.values(media));
  let season = 'summer';

  const caption = (key) => {
    const [k, text, credit] = CAPTIONS[key];
    return html`<span class="ws-cap__k">${k}</span> <span data-cap-text>${text}</span> <span class="ws-cap__credit" data-cap-credit>${credit}</span>`;
  };
  const figure = (name, clip, capKey, { eager = false, alt } = {}) => {
    const m = media[clip];
    const img = m
      ? html`<img class="ws-still" src="${m.poster}" alt="${alt ?? m.alt}" width="${m.width}" height="${m.height}" decoding="async"${raw(eager ? ' fetchpriority="high"' : ' loading="lazy"')}>`
      : '';
    return html`<figure class="ws-fig ws-fig--${name}" data-scene="${name}">
      <div class="ws-fig__media" data-clip="${clip}">${img}<canvas class="ws-fig__canvas" aria-hidden="true"></canvas></div>
      <figcaption class="ws-cap"${raw(name === 'kilns' ? ' data-season-cap' : '')}>${caption(capKey)}</figcaption>
    </figure>`;
  };

  root.className = 'ws';
  root.innerHTML = html`
    <header class="ws-bar">
      <a class="ws-mark" href="#ws-top" aria-label="${magazine.name}, front page">${magazine.name}</a>
      <nav class="ws-nav" aria-label="Sections"><a href="#ws-top" aria-current="page">Places</a><a href="#ws-top">Architecture</a><a href="#ws-top">Craft</a><a href="#ws-top">Culture</a></nav>
      <details class="ws-gl" data-readout>
        <summary><span class="ws-gl__dot" aria-hidden="true"></span><span class="sr-only">Compositor readout: </span><span data-gl-ctx>contexts 0</span><span class="ws-gl__rest" data-gl-rest></span></summary>
        <div class="ws-gl__panel">
          <p class="ws-gl__line" data-gl-full></p>
          <p class="ws-gl__note" data-gl-note>One WebGL context draws every picture. A clip is one texture, uploaded once per new frame however many scenes show it.</p>
          <table class="ws-gl__table" data-gl-table>
            <thead><tr><th scope="col">Clip</th><th scope="col">Scenes</th><th scope="col">Frames</th><th scope="col">Uploads</th></tr></thead>
            <tbody data-gl-rows></tbody>
          </table>
        </div>
      </details>
      <p class="ws-issue ac-label">${magazine.issue}</p>
      <button class="ws-pause" type="button" data-pause aria-pressed="false" hidden><span class="ws-pause__icon" aria-hidden="true"></span><span class="ws-pause__label">Pause footage</span></button>
    </header>

    <main id="ws-top">
      <article aria-labelledby="ws-title">
        <section class="ws-sec ws-hero">
          <div class="ws-hero__grid ac-wrap">
            <header class="ws-hero__copy">
              <p class="ws-kicker">${article.section} · ${article.read} read</p>
              <h1 class="ws-title" id="ws-title">${article.title}</h1>
              <p class="ws-dek">${article.dek}</p>
              <p class="ws-byline ac-label">Words by <span>${article.author}</span></p>
              <a class="ws-begin ac-label" href="#ws-ch1" data-begin>Begin reading <span aria-hidden="true">↓</span></a>
            </header>
            ${figure('hero', 'earth', 'hero', { eager: true })}
          </div>
        </section>

        <section class="ws-sec ws-band ws-ch" data-theme="dark" aria-labelledby="ws-ch1">
          <div class="ws-ch__grid ac-wrap">
            <div class="ws-ch__text">
              <p class="ws-num">I</p>
              <h2 class="ws-h2" id="ws-ch1" tabindex="-1">The kilns</h2>
              <p class="ws-p ws-p--first">${p1}</p>
              <p class="ws-p">${p2}</p>
              <div class="ws-season" role="group" aria-label="Season in figure 2" data-season-group hidden>
                <button type="button" data-season="summer" aria-pressed="true">Summer</button>
                <button type="button" data-season="winter" aria-pressed="false">Winter</button>
              </div>
            </div>
            ${figure('kilns', 'clouds', 'summer')}
          </div>
        </section>

        <section class="ws-sec ws-ch ws-ch--flip" aria-labelledby="ws-ch2">
          <div class="ws-ch__grid ac-wrap">
            <div class="ws-ch__text">
              <p class="ws-num">II</p>
              <h2 class="ws-h2" id="ws-ch2">Reading the pan</h2>
              <p class="ws-p">${p3}</p>
              <dl class="ws-facts">
                <div><dt class="ac-label">At the pans</dt><dd>31 summers</dd></div>
                <div><dt class="ac-label">Oldest pans</dt><dd>12th century</dd></div>
                <div><dt class="ac-label">First ledger</dt><dd>1788</dd></div>
              </dl>
            </div>
            ${figure('pan', 'orbit', 'pan')}
          </div>
        </section>

        <section class="ws-sec ws-band ws-interlude" data-theme="dark" aria-label="Pull quote">
          <div class="ws-interlude__grid ac-wrap">
            ${figure('interlude', 'earth', 'interlude', { alt: '' })}
            <blockquote class="ws-quote">
              <p>She reads the pan by sound: a low roll means the water is too deep, a hiss means it is nearly done.</p>
              <footer class="ac-label">On Birthe, thirty-one summers at the pans</footer>
            </blockquote>
          </div>
        </section>

        <section class="ws-sec ws-close" aria-labelledby="ws-ch3">
          ${figure('close', 'clouds', 'close', { alt: '' })}
          <div class="ws-close__grid ac-wrap">
            <div class="ws-close__head"><p class="ws-num">III</p><h2 class="ws-h2" id="ws-ch3">The ledgers</h2></div>
            <div class="ws-close__text">
              <p class="ws-p">${p4}</p>
              <p class="ws-p ws-p--last">${p5}</p>
              <p class="ws-filed ac-label">Filed from Læsø, August · ${magazine.issue}</p>
            </div>
          </div>
        </section>
      </article>

      <section class="ws-sec ws-more" aria-labelledby="ws-more-title">
        <div class="ac-wrap">
          <h2 class="ws-more__title ac-label" id="ws-more-title">More from ${magazine.issue}</h2>
          <ol class="ws-more__list" role="list">
            ${more.map((a) => html`<li><a class="ws-story" href="#ws-top">
              <span class="ac-label">${a.section} · ${a.read}</span>
              <span class="ws-story__title">${a.title}</span>
              <span class="ws-story__dek">${a.dek}</span>
              <span class="ws-story__by ac-label">${a.author}</span>
            </a></li>`)}
          </ol>
          <p class="ws-colophon ac-small" data-colophon>Every picture in this story is woven from public-domain footage (NASA, the US National Park Service) and one drawn sleet loop, by a single compositor in your browser.</p>
        </div>
      </section>
    </main>`;

  const $ = (sel) => root.querySelector(sel);
  root.querySelectorAll('a[href="#ws-top"]:not(.ws-mark)').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));
  // Begin reading: to the first chapter, and focus its heading so a screen reader continues from there (the ring
  // shows only when it was pressed with a key).
  on(ctx, $('[data-begin]'), 'click', (e) => {
    e.preventDefault();
    const heading = $('#ws-ch1');
    heading.closest('.ws-sec').scrollIntoView({ behavior: full ? 'smooth' : 'auto', block: 'start' });
    heading.focus({ preventScroll: true, focusVisible: e.detail === 0 });
  });

  const pauseBtn = $('[data-pause]');
  const seasonGroup = $('[data-season-group]');
  const seasonBtns = [...root.querySelectorAll('[data-season]')];
  const seasonCap = $('[data-season-cap]');
  const readout = $('[data-readout]');
  const summary = readout.querySelector('summary');
  const rows = $('[data-gl-rows]');
  const lineCtx = $('[data-gl-ctx]');
  const lineRest = $('[data-gl-rest]');
  const lineFull = $('[data-gl-full]');
  // The readout's line in the top bar: the context count always, the rest where the bar has room (the open panel
  // repeats the whole line for narrow screens).
  const setLine = (head, rest = '') => {
    lineCtx.textContent = head;
    lineRest.textContent = rest ? ` · ${rest}` : '';
    lineFull.textContent = rest ? `${head} · ${rest}` : head;
  };
  // The panel drops over the page: Escape or a press outside closes it (Escape returns focus to its summary).
  on(ctx, readout, 'keydown', (e) => {
    if (e.key !== 'Escape' || !readout.open) return;
    readout.open = false;
    summary.focus();
  });
  on(ctx, document, 'pointerdown', (e) => { if (readout.open && !readout.contains(e.target)) readout.open = false; });
  const sections = [...root.querySelectorAll('.ws-sec')];

  // The weave's ink is a token read per section, so a dark band takes the dark theme's value of the same token.
  const applyInk = () => {
    const v = /^#/.test(cfg.ink) ? cfg.ink : `var(--${cfg.ink})`;
    for (const el of sections) el.style.setProperty('--ws-weave', v);
  };
  // The interlude's caption says what it shows: glyphs, bars, or (without WebGL) the poster.
  let stillCaptions = false;
  const interludeText = $('[data-scene="interlude"] [data-cap-text]');
  const applyLook = () => {
    applyInk();
    readout.hidden = !cfg.readout;
    interludeText.textContent = CAPTIONS[stillCaptions ? 'interludeStill' : cfg.interlude === 'bars' ? 'interludeBars' : 'interlude'][1];
  };
  applyLook();

  // Count every WebGL context created from here on: the claim is one for the whole page, so measure it. The patch
  // lives only as long as this mount.
  const proto = HTMLCanvasElement.prototype;
  const original = proto.getContext;
  const seen = new WeakSet();
  let contexts = 0;
  function counting(type, ...rest) {
    const c = original.call(this, type, ...rest);
    if (c && /webgl/i.test(type) && !seen.has(this)) { seen.add(this); contexts++; }
    return c;
  }
  // ?nogl is the library's switch for the no-WebGL path. Checked here rather than with webglAvailable(): that probe
  // makes a context of its own and leaves it to the garbage collector, and the pool's own attempt is the real test.
  const glOK = !new URLSearchParams(location.search).has('nogl');
  proto.getContext = counting;
  ctx.onCleanup(() => { if (proto.getContext === counting) proto.getContext = original; });

  const family = readToken('--font-mono') || 'ui-monospace, monospace';
  let pool = null;
  if (glOK) {
    try { pool = createPool({ font: family }); } catch (error) { console.warn('woven-story: no compositor, showing the posters', error); pool = null; }
  }
  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);

  // ── No WebGL: the posters as plain pictures, no context, nothing to pause or switch ─────────────────────────
  let lost = false; // set when the context is lost after it drew
  const stillPage = () => {
    root.classList.remove('ws--gl');
    root.classList.add('ws--still');
    pauseBtn.hidden = true;
    seasonGroup.hidden = true;
    setLine(`contexts ${contexts}`, lost ? 'context lost, posters' : 'posters, no WebGL');
    $('[data-gl-note]').textContent = lost
      ? 'The WebGL context was lost, so every figure shows its poster instead of the weave.'
      : 'No WebGL here: every figure shows its poster, and no context was made.';
    $('[data-gl-table]').hidden = true;
    rows.innerHTML = '';
    stillCaptions = true;
    applyLook();
    $('[data-colophon]').textContent = 'Every picture in this story is public-domain footage (NASA, the US National Park Service). Without WebGL each figure shows the clip’s poster; with it, one compositor weaves them all.';
  };
  if (!pool) {
    stillPage();
    return {
      update(next) { cfg = { ...next }; applyLook(); return true; },
      action() {},
    };
  }
  ctx.onCleanup(() => pool.dispose());
  root.classList.add('ws--gl');
  seasonGroup.hidden = false;
  pauseBtn.hidden = ctx.motion !== 'full';

  // ── Clips: a poster first (so a scene draws at once), the playing video once it has a frame ───────────────────
  const sleet = createSleet(24);
  let sleetT = SLEET_AT;
  const clips = {};
  for (const key of Object.keys(SOURCES)) {
    const img = new Image();
    img.decoding = 'async';
    const posterFrames = () => (img.complete && img.naturalWidth ? 1 : 0);
    const source = { id: 'p', el: img, version: posterFrames };
    clips[key] = { running: false, video: null, poster: img, posterFrames, frames: posterFrames };
    pool.addClip(key, source);
    on(ctx, img, 'load', () => changed());
  }
  clips.sleet = { running: false, frames: sleet.version };
  pool.addClip('sleet', { id: 's', el: sleet.canvas, version: sleet.version });
  const posterFor = (key) => { const c = clips[key]; if (c?.poster && !c.poster.src && media[key]) c.poster.src = media[key].poster; };

  function ensureVideo(key) {
    const c = clips[key];
    if (!c || c.video || !media[key]) return c?.video || null;
    const v = document.createElement('video');
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.src = media[key].src;
    let frames = 0;
    let handle = 0;
    const rvfc = typeof v.requestVideoFrameCallback === 'function';
    const onVideoFrame = () => { frames++; handle = v.requestVideoFrameCallback(onVideoFrame); };
    if (rvfc) handle = v.requestVideoFrameCallback(onVideoFrame);
    const source = { id: 'v', el: v, version: rvfc ? () => frames : () => Math.floor(v.currentTime * 30) };
    // Frames for the readout: the poster, the first decoded frame, then every presented one.
    let loaded = 0;
    c.frames = () => c.posterFrames() + loaded + source.version();
    on(ctx, v, 'loadeddata', () => { loaded = 1; pool.setSource(key, source); changed(); }, { once: true });
    ctx.onCleanup(() => {
      if (rvfc) v.cancelVideoFrameCallback(handle);
      v.pause();
      v.removeAttribute('src');
      v.load();
    });
    c.video = v;
    return v;
  }

  // ── Scenes ───────────────────────────────────────────────────────────────────────────────────────────────────
  const scenes = [...root.querySelectorAll('[data-scene]')].map((fig) => {
    const name = fig.dataset.scene;
    const def = SCENES[name];
    const canvas = fig.querySelector('canvas');
    const s = {
      name, fig, canvas, section: fig.closest('.ws-sec'), ctx: canvas.getContext('2d'), glyphs: !!def.glyphs,
      mode: 'bars', cell: cfg.cell, visible: false, draws: 0, sig: '', W: 0, H: 0, dpr: 1,
      // develop = arrive (the hero's arrival or the scroll) × wash (a theme change redeveloping the scene).
      develop: full ? 0 : 1, arrive: full ? 0 : 1, wash: 1, pol: 0, ground: [1, 1, 1], ink: [0, 0, 0],
      layers: def.layers.map((l) => {
        const on0 = !l.season || l.season === season ? 1 : 0;
        return { ...l, develop: on0, target: on0, levels: [0, 255, 1, 255] };
      }),
    };
    s.mode = s.glyphs && cfg.interlude === 'glyphs' ? 'glyphs' : 'bars';
    return s;
  });
  const byName = Object.fromEntries(scenes.map((s) => [s.name, s]));

  // A section's ground decides its polarity: light grounds weave dark ink on normal levels, dark grounds light ink
  // on inverted ones. Returns the polarity the section wants now.
  function readColours(s) {
    const cs = getComputedStyle(s.section);
    s.ground = parseColour(cs.getPropertyValue('--ws-ground')) || [1, 1, 1];
    s.ink = parseColour(cs.getPropertyValue('--ws-weave')) || [0, 0, 0];
    return luminance(s.ground) < 0.5 ? 1 : 0;
  }
  for (const s of scenes) s.pol = readColours(s);

  // Levels: normal and inverted points mixed by the polarity, pulled toward the middle by the contrast control.
  function levelsOf(s, l) {
    const k = 1 / cfg.contrast;
    const black = 127.5 + (NORMAL[0] + (INVERTED[0] - NORMAL[0]) * s.pol - 127.5) * k;
    const white = 127.5 + (NORMAL[1] + (INVERTED[1] - NORMAL[1]) * s.pol - 127.5) * k;
    return [black, white, l.gamma ?? 1, 255];
  }

  function measure(s) {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const W = Math.max(1, Math.round(s.canvas.clientWidth * dpr));
    const H = Math.max(1, Math.round(s.canvas.clientHeight * dpr));
    s.dpr = dpr;
    if (W !== s.W || H !== s.H) { s.W = W; s.H = H; s.canvas.width = W; s.canvas.height = H; s.sig = ''; }
  }

  const live = (s, l) => l.develop * s.develop > 0.001;
  function signature(s) {
    let k = `${s.W}x${s.H}|${s.mode}|${s.cell}|${s.ink}|${s.develop.toFixed(3)}`;
    for (const l of s.layers) {
      const c = pool.clips.get(l.clip);
      k += `|${live(s, l) ? `${c.source.id}${c.source.version()}` : '-'}:${l.develop.toFixed(3)}:${l.levels[0].toFixed(1)},${l.levels[1].toFixed(1)},${l.levels[2]}`;
    }
    return k;
  }

  // Draws a scene only when something it shows changed. Returns the draw's counts, or null when nothing drew.
  function drawScene(s, force = false) {
    if (lost || !s.W || !s.H) return null;
    s.mode = s.glyphs && cfg.interlude === 'glyphs' ? 'glyphs' : 'bars';
    s.cell = cfg.cell;
    s.develop = s.arrive * s.wash;
    for (const l of s.layers) l.levels = levelsOf(s, l);
    const sig = signature(s);
    if (!force && sig === s.sig) return null;
    s.sig = sig;
    const r = pool.draw(s);
    s.draws++;
    return r;
  }

  // ── Clips play while a visible scene shows them (and the visitor has not paused) ───────────────────────────────
  let paused = false;
  function syncClips() {
    const run = full && !paused;
    const wanted = new Set();
    for (const s of scenes) if (s.visible) for (const l of s.layers) if (l.target > 0 || l.develop > 0.001) wanted.add(l.clip);
    for (const [key, c] of Object.entries(clips)) {
      if (wanted.has(key)) posterFor(key);
      c.running = run && wanted.has(key);
      if (key === 'sleet') continue;
      if (c.running) ensureVideo(key)?.play().catch(() => {});
      else c.video?.pause();
    }
    if (Object.values(clips).some((c) => c.running)) wake();
  }

  // ── The readout ──────────────────────────────────────────────────────────────────────────────────────────────
  const frameStats = { drawn: 0, uploads: 0 };
  let lastReport = 0;
  function report(force = false) {
    const now = performance.now();
    if (!force && now - lastReport < 100) return;
    lastReport = now;
    const onScreen = scenes.filter((s) => s.visible).length;
    if (lost) setLine(`contexts ${contexts}`, 'context lost, posters');
    else setLine(`contexts ${contexts}`, `drawn ${frameStats.drawn}/${onScreen} · uploads ${frameStats.uploads} · ${ctx.motion === 'full' ? `cap ${cfg.fps} fps` : 'stills'}`);
    if (!readout.open) return;
    const use = {};
    for (const s of scenes) for (const l of s.layers) (use[l.clip] ||= new Set()).add(s.name);
    rows.innerHTML = Object.keys(clips).map((key) => {
      const c = pool.clips.get(key);
      const frames = clips[key].frames();
      return `<tr><th scope="row">${key}</th><td>${[...(use[key] || [])].join(', ')}</td><td>${frames}</td><td>${c?.uploads ?? 0}</td></tr>`;
    }).join('');
  }
  on(ctx, readout, 'toggle', () => report(true));

  // ── The clock (full tier only): sleeps when nothing moves ────────────────────────────────────────────────────
  let off = null;
  let idle = 0;
  let lastDraw = 0;
  function frame(dt) {
    if (clips.sleet.running) { sleetT += dt; sleet.at(sleetT); }
    const now = performance.now();
    if (now - lastDraw < 1000 / cfg.fps - 2) return;
    lastDraw = now;
    let drawn = 0;
    let uploads = 0;
    for (const s of scenes) {
      if (!s.visible) continue;
      const r = drawScene(s);
      if (r) { drawn++; uploads += r.uploads; }
    }
    frameStats.drawn = drawn;
    frameStats.uploads = uploads;
    report();
    const running = Object.values(clips).some((c) => c.running);
    if (drawn || running) idle = 0;
    else if (++idle > 6) { off?.(); off = null; report(true); }
  }
  function wake() {
    idle = 0;
    if (!off && full && !lost) off = onFrame(ctx, frame);
  }
  // Something changed outside the clock (a poster loaded, a video's first frame, an option): redraw.
  function changed(force = false) {
    if (full) { if (force) for (const s of scenes) s.sig = ''; wake(); return; }
    let drawn = 0;
    let uploads = 0;
    for (const s of scenes) {
      if (!s.visible) continue;
      const r = drawScene(s, force);
      if (r) { drawn++; uploads += r.uploads; }
    }
    // Without a clock there are no frames: the readout keeps the last pass that drew.
    if (drawn) { frameStats.drawn = drawn; frameStats.uploads = uploads; }
    report(true);
  }

  // ── Visibility, size, develop ──────────────────────────────────────────────────────────────────────────────
  observeIntersection(ctx, scenes.map((s) => s.fig), (entries) => {
    for (const e of entries) {
      const s = scenes.find((x) => x.fig === e.target);
      s.visible = e.isIntersecting;
      if (s.visible) measure(s);
    }
    syncClips();
    changed();
  }, { rootMargin: '10% 0px' });
  // A resize clears a canvas's backing store, so a visible scene is redrawn in the same callback, before paint.
  observeResize(ctx, scenes.map((s) => s.canvas), () => {
    for (const s of scenes) {
      measure(s);
      if (s.visible) drawScene(s);
    }
    changed();
  });

  if (full) {
    context.add(() => {
      for (const s of scenes) {
        if (s.name === 'hero') gsap.to(s, { arrive: 1, duration: ARRIVAL, ease: 'power2.out', delay: 0.2, onUpdate: wake });
        else gsap.fromTo(s, { arrive: 0 }, { arrive: 1, ease: 'none', onUpdate: wake, scrollTrigger: { trigger: s.fig, start: 'top bottom', end: 'center 60%', scrub: true } });
      }
    });
    document.fonts?.ready.then(() => { if (!ctx.signal.aborted) ScrollTrigger.refresh(); });
  }
  // The glyph ramp is measured in the page's mono face once it has loaded.
  document.fonts?.load(`600 40px ${family}`).then(() => {
    if (ctx.signal.aborted || lost) return;
    pool.setGlyphFont(family);
    changed(true);
  }).catch(() => {});

  // ── Season: both seasons are layers of figure 2; switching slides their levels, never a cross-fade ────────────
  function setSeason(name) {
    season = name;
    for (const b of seasonBtns) b.setAttribute('aria-pressed', String(b.dataset.season === name));
    const [, text, credit] = CAPTIONS[name];
    seasonCap.querySelector('[data-cap-text]').textContent = text;
    seasonCap.querySelector('[data-cap-credit]').textContent = credit;
    const s = byName.kilns;
    for (const l of s.layers) {
      if (!l.season) continue;
      l.target = l.season === name ? 1 : 0;
      if (full) context.add(() => gsap.to(l, { develop: l.target, duration: SWAP, ease: 'power2.inOut', overwrite: true, onUpdate: wake }));
      else { gsap.killTweensOf(l); l.develop = l.target; }
    }
    syncClips();
    changed();
  }
  for (const b of seasonBtns) on(ctx, b, 'click', () => setSeason(b.dataset.season));

  // ── Theme: a page section's ground flips, so its ink and polarity flip with it. Swapping ink at the old levels
  // would flash a negative; instead the scene redevelops from no ink at its new levels (the white point sliding in),
  // as the incoming season does. The dark bands keep their ground, so they keep their picture.
  ctx.onTheme(() => {
    for (const s of scenes) {
      const pol = readColours(s);
      if (pol === s.pol) continue;
      s.pol = pol;
      if (full) context.add(() => gsap.fromTo(s, { wash: 0 }, { wash: 1, duration: SWAP, ease: 'power2.out', overwrite: 'auto', onUpdate: wake }));
    }
    changed(true);
  });

  // ── Pause: one page-level button stops every clip; with nothing changing, no scene redraws ────────────────────
  // It keeps its label; aria-pressed carries the state ("Pause footage, pressed").
  function setPaused(v) {
    paused = v;
    pauseBtn.setAttribute('aria-pressed', String(v));
    syncClips();
    wake();
  }
  on(ctx, pauseBtn, 'click', () => setPaused(!paused));
  // A hidden tab decodes nothing: the clips rest and pick up where they were.
  on(ctx, document, 'visibilitychange', () => {
    if (document.hidden) for (const c of Object.values(clips)) { c.running = false; c.video?.pause(); }
    else syncClips();
  });

  on(ctx, pool.canvas, 'webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    off?.();
    off = null;
    for (const c of Object.values(clips)) c.video?.pause();
    stillPage();
  });

  wake();
  report(true);

  return {
    update(next, changedIds) {
      cfg = { ...next };
      applyLook();
      if (changedIds.includes('ink')) for (const s of scenes) readColours(s);
      if (changedIds.includes('fps')) lastDraw = 0;
      changed(true);
      report(true);
      return true;
    },
    action(id) {
      if (id === 'season') {
        byName.kilns.fig.scrollIntoView({ behavior: full ? 'smooth' : 'auto', block: 'center' });
        setSeason(season === 'summer' ? 'winter' : 'summer');
      } else if (id === 'pause' && full && !lost) {
        setPaused(!paused);
      }
    },
  };
}
