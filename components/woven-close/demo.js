// Woven footage close — the last screen of Meridian Observatory's site: tonight's shows and a ticket link beside
// footage woven into the section's own ink. Two clips graded on black (the whole Earth from a million miles out, an
// orbit horizon from the space station) and a generated star field are layers on one raw-WebGL canvas, one quad per
// layer sized to its slot. In every cell the layer's clip is read once at the centre; near-black is the key and drops
// the cell, so each clip lands as a cut-out. Every other cell becomes a vertical bar as wide as the cell is dark, or a
// glyph from an ASCII ramp sorted by measured ink. Each layer is a plain object (grid, levels, bar range, ground and
// ink opacity, develop) that GSAP tweens: the scroll develops every layer from blank while its slot enters. Clips
// upload once per decoded frame; the canvas renders on change at 30 fps at most and never off screen. Reduced motion
// and static: one developed still from the posters. No WebGL: the posters, masked and striped.
import './demo.css';
import { on, onFrame, observeIntersection, observeResize, whileVisible, html, videos, credit as creditMedia, content, webglAvailable, qualityTier, clamp, colour } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

// The clips, re-encoded small for the weave (480 px and 640 px, everything under about 4 % set to black): the
// weave throws most of the detail away, so a small clip looks the same as the 1080 px original at a tenth of the bytes.
const CLIPS = {
  earth: { src: new URL('./earth.webm', import.meta.url).href, media: 'video-earth-rotation' },
  orbit: { src: new URL('./orbit.webm', import.meta.url).href, media: 'video-earth-orbit' },
};
const FPS_CAP = 30;            // the compositor never renders faster than this
const STAR_FPS = 8;            // the star field twinkles at this rate
const DPR_CAP = 1.5;
const MIN_CELL = { bars: 5, glyphs: 9 };
const BAR_TALL = 1.2;          // bar cells are a little taller than wide
const GLYPH_WIDE = 0.6;        // a monospace cell is about 0.6 as wide as it is tall
const GLYPH_SCALE = 1.5;       // glyph cells are 1.5 bar cells wide
const DISC = 0.8;              // the Earth spans 80 % of its frame
const STAR_SHARE = 0.012;      // stars per cell

// The layers in drawing order. Levels are [black, white] in 0–255, one pair for a dark ink on a light ground and one
// for a light ink on a dark ground: a black point above the white point inverts the tone, which keeps the picture
// positive whichever way the section's tokens run. Stars always print bright as ink, like a star chart.
const LAYERS = [
  { name: 'stars', slot: 'pic', seed: 7, scale: 1, levels: { inkDark: [255, 0], inkLight: [255, 0] }, bar: [0.12, 0.62], groundAlpha: 0, inkAlpha: 1, keyEdge: false, key: 0.02 },
  { name: 'bandStars', slot: 'band', seed: 23, scale: 1, levels: { inkDark: [255, 0], inkLight: [255, 0] }, bar: [0.12, 0.62], groundAlpha: 0, inkAlpha: 1, keyEdge: false, key: 0.02 },
  // On a light ground white cloud at the limb would print as paper and fray the disc's edge, so there every Earth cell
  // keeps a hairline (14 % of the cell); on a dark ground the bright cloud carries the silhouette by itself.
  { name: 'earth', slot: 'pic', clip: 'earth', scale: 1, levels: { inkDark: [14, 148], inkLight: [160, 20] }, bar: [-0.02, 1.02], floorOnLight: 0.14, groundAlpha: 1, inkAlpha: 1, keyEdge: true, negatable: true },
  // The orbit's sky is blue-black rather than black (airglow), so it keys five points above the setting.
  { name: 'orbit', slot: 'band', clip: 'orbit', scale: 0.86, levels: { inkDark: [36, 226], inkLight: [226, 36] }, bar: [-0.02, 1.02], groundAlpha: 1, inkAlpha: 1, keyEdge: true, keyOffset: 0.05, negatable: true },
];

export default function mount(root, options, ctx) {
  const obs = content.observatory;
  let cfg = { ...options };
  const full = ctx.motion === 'full';
  const still = !full || ctx.capture;          // one developed still: reduced, static, and the frame capture
  const earthMedia = videos.find((v) => v.id === CLIPS.earth.media);
  const orbitMedia = videos.find((v) => v.id === CLIPS.orbit.media);
  creditMedia(earthMedia, orbitMedia);   // the folder's re-encoded clips are cut from these
  const shows = [...obs.shows].sort((a, b) => a.time.localeCompare(b.time));

  root.className = 'wc';
  root.innerHTML = html`
    <footer class="wc__close" aria-labelledby="wc-title" data-close>
      <canvas class="wc__gl" data-gl aria-hidden="true" hidden></canvas>
      <div class="wc__main ac-wrap">
        <div class="wc__copy">
          <h2 class="sr-only" id="wc-title">Today’s shows</h2>
          <ol class="wc__shows" role="list">
            ${shows.map((s) => html`<li><time class="wc__time" datetime="2026-10-28T${s.time}">${s.time}</time><span class="wc__show">${s.title}</span></li>`)}
          </ol>
          <a class="ac-btn ac-btn--accent ac-btn--lg wc__book" href="#tickets" data-book>Book seats for tonight</a>
        </div>
        <figure class="wc__stage">
          <div class="wc__pic" data-pic></div>
          <figcaption class="wc__cap">
            <p>The whole Earth from a million miles out, one day in eleven minutes.</p>
            <button class="ac-btn ac-btn--ghost ac-btn--sm wc__pause" type="button" aria-pressed="false" data-pause hidden>Pause footage</button>
          </figcaption>
        </figure>
      </div>
      <div class="wc__band" data-band></div>
      <p class="ac-stage__note"><span>${obs.name} · site footer</span></p>
    </footer>`;

  const close = root.querySelector('[data-close]');
  const canvas = root.querySelector('[data-gl]');
  const pic = root.querySelector('[data-pic]');
  const band = root.querySelector('[data-band]');
  const pauseBtn = root.querySelector('[data-pause]');

  on(ctx, root.querySelector('[data-book]'), 'click', (e) => e.preventDefault());

  const applyLook = () => {
    // A token name or a custom hex from the panel's colour picker.
    close.style.setProperty('--wc-ink', colour(cfg.ink, 'var(--ink)'));
    root.classList.toggle('wc--no-band', !cfg.band);
  };
  applyLook();

  // ---- The still without WebGL: the posters in the same slots, masked to the disc and striped like the weave. ----
  let stills = false;
  const showStills = () => {
    canvas.hidden = true;
    pauseBtn.hidden = true;
    root.classList.remove('is-gl');
    if (stills) return;
    stills = true;
    pic.innerHTML = html`<img class="wc__still wc__still--earth" src="${earthMedia?.poster || ''}" alt="${earthMedia?.alt || ''}" width="960" height="960" decoding="async">`;
    band.innerHTML = html`<img class="wc__still wc__still--orbit" src="${orbitMedia?.poster || ''}" alt="" width="1800" height="1013" decoding="async">`;
  };

  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  let weave = null;
  let layers = [];
  let dirty = true;
  let visible = false;
  let paused = false;
  let running = false;
  let lost = false;
  let clock = 6.2;               // the star field's clock; the still uses this moment
  let starAt = 0;
  let lastRender = 0;
  let raf = 0;
  let refreshTimer = 0;
  let off = null;                // the ticker subscription, held only while footage plays or a change waits to draw
  ctx.onCleanup(() => { cancelAnimationFrame(raf); clearTimeout(refreshTimer); });

  // Under the still tiers there is no clock: a render is requested on load, resize, theme and settings alone.
  const requestRender = () => {
    if (!weave || lost || raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (weave && !lost) { weave.render(); dirty = false; } });
  };
  // Under full motion the shared ticker wakes for a change while the close is on screen and sleeps again once it has
  // drawn, unless the footage is playing: paused, lost or at rest, nothing ticks.
  const wake = () => { if (!off && visible && weave && !lost) off = onFrame(ctx, frame); };
  const sleep = () => { off?.(); off = null; };
  const invalidate = () => { dirty = true; if (still) requestRender(); else wake(); };

  const setRunning = () => {
    const run = !still && visible && !paused && !lost;
    if (run !== running) {
      running = run;
      for (const l of layers) if (l.source?.kind === 'video') (run ? l.source.play() : l.source.pause());
    }
    if (running) wake();
  };

  const sourceFor = (def) => {
    if (!def.clip) return starField(def.seed);
    const media = def.clip === 'earth' ? earthMedia : orbitMedia;
    if (still) return imageSource(ctx, media?.poster, invalidate);
    return videoSource(ctx, CLIPS[def.clip].src, invalidate, () => {
      // A clip that cannot play here (codec, network) is replaced by its poster: the weave still draws.
      const l = layers.find((x) => x.name === def.name);
      if (l) { l.source = imageSource(ctx, media?.poster, invalidate); l.uploaded = -1; l.size = null; invalidate(); }
    });
  };

  // Layer boxes in device px, measured from the DOM slots: the Earth is a square centred in the picture slot, sized so
  // its disc nearly fills the slot's short side; the orbit runs full width in the band, cropped to the band's shape
  // (art-directed, not scaled) so a phone sees the middle of the frame larger.
  const place = () => {
    if (!weave) return;
    const box = close.getBoundingClientRect();
    const { dpr, W } = weave.size;
    const rel = (el) => { const r = el.getBoundingClientRect(); return [(r.left - box.left) * dpr, (r.top - box.top) * dpr, (r.right - box.left) * dpr, (r.bottom - box.top) * dpr]; };
    const p = rel(pic);
    const b = rel(band);
    const side = Math.min(p[2] - p[0], p[3] - p[1]) / (DISC + 0.04);
    const cx = (p[0] + p[2]) / 2;
    const cy = (p[1] + p[3]) / 2;
    for (const l of layers) {
      const c = l.cfg;
      if (l.name === 'earth') c.rect = [cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2];
      else if (l.slot === 'pic') c.rect = p;
      else c.rect = [0, b[1], W, b[3]];
      if (l.name === 'orbit') c.crop = bandCrop(W, b[3] - b[1]);
      c.hidden = l.slot === 'band' && !cfg.band;
    }
  };

  const readColours = () => {
    if (!weave) return;
    const cs = getComputedStyle(close);
    weave.setColours({
      ground: parseColour(cs.getPropertyValue('--wc-ground')) ?? [0.93, 0.93, 0.9],
      ink: parseColour(cs.getPropertyValue('--wc-ink')) ?? [0.07, 0.07, 0.07],
    });
  };

  const applySettings = () => {
    if (!weave) return;
    weave.setMode(cfg.weave);
    weave.setCell(cfg.cell);
    weave.setKey(cfg.key / 100);
    weave.setNegative(cfg.negative);
  };

  const relayout = () => {
    if (!weave || lost) return;
    weave.resize();
    place();
    invalidate();
    if (!still) {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { if (!ctx.signal.aborted) ScrollTrigger.refresh(); }, 120);
    }
  };

  function frame(dt) {
    if (!weave || lost) { sleep(); return; }
    if (running) {
      clock += dt;
      if (clock - starAt >= 1 / STAR_FPS) {
        starAt = clock;
        for (const l of layers) if (!l.cfg.hidden) l.source.tick?.(clock);
      }
    }
    const now = performance.now();
    if (now - lastRender < 1000 / FPS_CAP - 2) return;     // deferred by the cap, not dropped: the ticker stays awake
    if (dirty || weave.pending()) {
      dirty = false;
      lastRender = now;
      weave.render();
    } else if (!running) sleep();
  }

  // The develop: each slot scrubs its layers from blank as it enters, from its top at 95 % of the viewport to its
  // bottom there (or the end of the page, whichever comes first), so every layer develops on screen.
  const developOnScroll = () => {
    const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
    const scrub = (slot, entries) => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: invalidate,
        scrollTrigger: {
          trigger: slot,
          start: 'top 95%',
          end: () => {
            const top = absTop(slot);
            const from = top - innerHeight * 0.95;
            return Math.max(from + 1, Math.min(ScrollTrigger.maxScroll(window), top + slot.offsetHeight - innerHeight * 0.95));
          },
          scrub: 0.5,
          invalidateOnRefresh: true,
        },
      });
      for (const [name, at, duration] of entries) tl.fromTo(layers.find((l) => l.name === name).cfg, { develop: 0 }, { develop: 1, duration }, at);
    };
    context.add(() => {
      scrub(pic, [['stars', 0, 0.6], ['earth', 0.12, 0.88]]);
      scrub(band, [['bandStars', 0, 0.55], ['orbit', 0.1, 0.9]]);
    });
  };

  function init() {
    try { weave = createWeave(canvas, { dprCap: Math.min(DPR_CAP, qualityTier().dpr) }); } catch (error) { console.warn('woven-close: falling back to the poster still', error); weave = null; }
    if (!weave) { showStills(); return; }
    canvas.hidden = false;
    root.classList.add('is-gl');
    ctx.onCleanup(() => { weave?.destroy(); weave = null; });
    layers = LAYERS.map((def) => ({ name: def.name, slot: def.slot, cfg: { ...def, develop: still ? 1 : 0, reveal: 1, hidden: false, rect: null, crop: [0, 0, 1, 1] }, source: sourceFor(def) }));
    weave.setLayers(layers);
    ctx.onCleanup(() => { for (const l of layers) l.source?.release?.(); });
    applySettings();
    readColours();
    weave.resize();
    place();

    on(ctx, canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      lost = true;
      setRunning();
      sleep();
      showStills();
    });
    observeResize(ctx, [close, pic], relayout);
    ctx.onTheme(() => { readColours(); invalidate(); });
    // The glyph ramp is measured in the mono face, so it is measured again once the web font is in.
    document.fonts?.ready.then(() => { if (!ctx.signal.aborted && weave && !lost) { weave.buildGlyphs(); relayout(); } });

    if (still) {
      for (const l of layers) l.source.tick?.(clock);
      requestRender();
      return;
    }
    // Moving footage that plays for more than five seconds needs a way to stop it (WCAG 2.2.2).
    pauseBtn.hidden = false;
    developOnScroll();
    whileVisible(ctx, close, () => { visible = true; invalidate(); setRunning(); }, () => { visible = false; sleep(); setRunning(); }, { rootMargin: '0px' });
  }

  const togglePause = () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    setRunning();
  };
  on(ctx, pauseBtn, 'click', togglePause);

  // Nothing is allocated until the close is within 60 % of a viewport of the screen.
  if (!webglAvailable()) showStills();
  else {
    let started = false;
    const near = observeIntersection(ctx, close, ([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      near.disconnect();
      init();
    }, { rootMargin: '60% 0px' });
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.some((k) => k === 'ink' || k === 'band')) applyLook();
      if (!weave) return undefined;
      applySettings();
      if (changed.includes('ink')) readColours();
      if (changed.includes('band')) relayout();
      invalidate();
      return undefined;
    },
    action(id) {
      if (id === 'pause') { if (!pauseBtn.hidden) togglePause(); return; }
      if (id !== 'replay' || !weave || still || lost) return;
      // Jump to the close and develop every layer again from blank, staggered, independent of the scroll.
      window.scrollTo(0, ScrollTrigger.maxScroll(window));
      context.add(() => {
        gsap.fromTo(layers.map((l) => l.cfg), { reveal: 0 }, { reveal: 1, duration: 1.8, ease: 'power1.inOut', stagger: 0.22, overwrite: 'auto', onUpdate: invalidate });
      });
    },
  };
}

// The orbit band's sub-rect of its clip (u0, v0, u1, v1): full width on a wide band, the middle 70 % on a narrow one,
// and as much height as the band's shape allows, with the horizon's crest about a fifth of the way down.
function bandCrop(w, h) {
  const aspect = w / Math.max(1, h);
  const zw = aspect >= 5 ? 1 : 0.7;
  const vh = Math.min(1, (zw * 16) / 9 / aspect);
  const u0 = clamp(0.56 - zw / 2, 0, 1 - zw);
  const v0 = clamp(0.37 - vh * 0.2, 0, 1 - vh);
  return [u0, v0, u0 + zw, v0 + vh];
}

// ---- Sources: a clip as <video>, a poster as <img>, the star field as a canvas. Each says when its frame changed. ----

function videoSource(ctx, src, onChange, onFail) {
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.loop = true;
  video.preload = 'auto';
  video.src = src;
  // One version per decoded frame, so each frame uploads once; currentTime stands in where the callback never fires.
  // Each new frame (and the first data, which arrives even when autoplay is refused) asks the compositor to draw.
  let frames = 0;
  const tick = () => { frames++; if (ctx.signal.aborted) return; onChange(); video.requestVideoFrameCallback(tick); };
  if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(tick);
  on(ctx, video, 'loadeddata', onChange);
  let failed = false;
  on(ctx, video, 'error', () => { if (!failed) { failed = true; onFail(); } });
  let wantPlay = false;
  return {
    el: video,
    kind: 'video',
    ready: () => video.readyState >= 2,
    version: () => (frames > 0 ? frames : video.currentTime),
    play() { wantPlay = true; video.play().catch(() => {}); },
    pause() { wantPlay = false; video.pause(); },
    release() { video.pause(); video.removeAttribute('src'); video.load(); },
    get playing() { return wantPlay; },
  };
}

function imageSource(ctx, src, onLoad) {
  const img = new Image();
  img.decoding = 'async';
  on(ctx, img, 'load', onLoad);
  img.src = src || '';
  return { el: img, kind: 'image', ready: () => img.complete && img.naturalWidth > 0, version: () => 1 };
}

// A generated layer, drawn at one texel per cell so every star lands exactly on a cell centre. Black is the key, like
// the footage; brightness twinkles slowly, and a resized grid re-seeds the field.
function starField(seed) {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d', { willReadFrequently: true });
  let cols = 0;
  let rows = 0;
  let img = null;
  let stars = [];
  let version = 0;
  let t = 0;
  const draw = () => {
    if (!img) return;
    const d = img.data;
    d.fill(0);
    for (const s of stars) {
      const b = s.base * (1 - s.twinkle + s.twinkle * Math.sin(t * s.rate + s.phase));
      const v = Math.round(clamp(b, 0, 1) * 255);
      const i = s.at * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    version++;
  };
  return {
    el: canvas,
    kind: 'canvas',
    ready: () => cols > 0,
    version: () => version,
    fit(c, r) {
      if (c === cols && r === rows) return;
      cols = c;
      rows = r;
      canvas.width = c;
      canvas.height = r;
      img = g.createImageData(c, r);
      let s = seed * 7919;
      const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      stars = Array.from({ length: Math.max(3, Math.round(c * r * STAR_SHARE)) }, () => ({
        at: Math.floor(rand() * c * r),
        base: 0.3 + 0.7 * rand() ** 3,
        rate: 0.6 + rand() * 1.6,
        phase: rand() * Math.PI * 2,
        twinkle: rand() < 0.4 ? 0.32 : 0.1,
      }));
      draw();
    },
    tick(time) { t = time; draw(); },
  };
}

// ---- Colours: the section's tokens as the shader gets them. Hex is read directly; any other CSS colour is painted
// into one pixel and read back. ----
let swatch = null;
function parseColour(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  swatch ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  swatch.fillStyle = '#000';
  swatch.fillStyle = s;
  const a = swatch.fillStyle;
  swatch.fillStyle = '#fff';
  swatch.fillStyle = s;
  if (swatch.fillStyle !== a) return null;
  swatch.clearRect(0, 0, 1, 1);
  swatch.fillRect(0, 0, 1, 1);
  const d = swatch.getImageData(0, 0, 1, 1).data;
  return d[3] ? [d[0] / 255, d[1] / 255, d[2] / 255] : null;
}
const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// ---- The compositor: one WebGL1 context, one program, one quad per layer. ----

const VERT = /* glsl */ `
attribute vec2 a_unit;
uniform vec4 u_rect;        // layer box in device px, y down: x0, y0, x1, y1
uniform vec2 u_canvas;
varying vec2 v_uv;          // 0..1 across the layer, y down (textures are uploaded top row first)
void main() {
  vec2 px = mix(u_rect.xy, u_rect.zw, a_unit);
  gl_Position = vec4(px.x / u_canvas.x * 2.0 - 1.0, 1.0 - px.y / u_canvas.y * 2.0, 0.0, 1.0);
  v_uv = a_unit;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D u_tex;
uniform sampler2D u_glyphs;
uniform vec4 u_crop;        // the part of the clip this layer shows: u0, v0, u1, v1
uniform vec2 u_grid;        // columns, rows
uniform vec2 u_cellPx;      // one cell in device px
uniform vec4 u_levels;      // black point, white point (black above white inverts), gamma, threshold
uniform vec2 u_bar;         // bar width at no ink and at full ink, as a share of the cell (may pass 0 and 1)
uniform vec2 u_alpha;       // ground opacity, ink opacity
uniform vec3 u_ground;
uniform vec3 u_ink;
uniform float u_key;        // a sample at or below this counts as the key
uniform float u_keyEdge;    // 1: also test four points inside the cell; 0: the centre alone (keeps single-texel stars)
uniform float u_develop;    // 0: no ink anywhere; 1: the authored levels
uniform float u_mode;       // 0 bars, 1 glyphs
uniform float u_glyphCount;
varying vec2 v_uv;

vec2 clip(vec2 p) { return mix(u_crop.xy, u_crop.zw, p); }
bool keyed(vec2 p) {
  vec4 t = texture2D(u_tex, clip(p));
  return t.a < 0.01 || max(t.r, max(t.g, t.b)) <= u_key;
}

void main() {
  vec2 cell = floor(v_uv * u_grid);
  vec2 c = (cell + 0.5) / u_grid;
  // The key at the centre and four points inside the cell: silhouettes end on whole cells, not on a fringe.
  vec2 q = 0.35 / u_grid;
  if (keyed(c)) discard;
  if (u_keyEdge > 0.5 && (keyed(c - q) || keyed(c + q) || keyed(c + vec2(q.x, -q.y)) || keyed(c + vec2(-q.x, q.y)))) discard;

  vec3 rgb = pow(texture2D(u_tex, clip(c)).rgb, vec3(u_levels.z));
  float tone = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  tone = clamp((tone - u_levels.x) / (u_levels.y - u_levels.x), 0.0, 1.0);
  tone = mix(1.0, tone, u_develop);
  float ink = tone > u_levels.w ? 0.0 : 1.0 - tone;

  vec2 f = fract(v_uv * u_grid);
  float cover;
  if (u_mode < 0.5) {
    // Coverage box-filtered over one device pixel: edges ramp, a bar thinner than a pixel draws at its share of one,
    // and a bar of zero or negative width draws nothing.
    float halfW = 0.5 * mix(u_bar.x, u_bar.y, ink);
    float px = 1.0 / u_cellPx.x;
    cover = clamp((halfW - abs(f.x - 0.5)) / px + 0.5, 0.0, 1.0) * clamp(2.0 * halfW / px, 0.0, 1.0);
  } else {
    float index = floor(ink * (u_glyphCount - 1.0) + 0.5);
    cover = texture2D(u_glyphs, vec2((index + f.x) / u_glyphCount, f.y)).a;
  }
  // Premultiplied: a part-covered pixel over a clear ground takes ink by its cover and no ground colour.
  gl_FragColor = mix(vec4(u_ground * u_alpha.x, u_alpha.x), vec4(u_ink * u_alpha.y, u_alpha.y), cover);
}`;

const GLYPHS = [' ', '.', ':', '-', '=', '+', '*', '%', '#', '@'];
const GLYPH_CELL = { w: 36, h: 60 };
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

// The ramp's order is measured, not trusted: each glyph's ink is counted in the mono face and the ramp sorted from
// light to heavy before upload.
function glyphAtlas() {
  const draw = (ramp) => {
    const c = Object.assign(document.createElement('canvas'), { width: GLYPH_CELL.w * ramp.length, height: GLYPH_CELL.h });
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${Math.round(GLYPH_CELL.h * 0.78)}px ${MONO}`;
    ramp.forEach((ch, i) => g.fillText(ch, GLYPH_CELL.w * (i + 0.5), GLYPH_CELL.h * 0.54));
    return { c, g };
  };
  const { g } = draw(GLYPHS);
  const ramp = GLYPHS.map((ch, i) => {
    const d = g.getImageData(i * GLYPH_CELL.w, 0, GLYPH_CELL.w, GLYPH_CELL.h).data;
    let a = 0;
    for (let k = 3; k < d.length; k += 4) a += d[k];
    return { ch, ink: a };
  }).sort((p, q) => p.ink - q.ink).map((x) => x.ch);
  return { canvas: draw(ramp).c, ramp };
}

function createWeave(canvas, { dprCap }) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(program) || 'link failed');
  gl.useProgram(program);
  const u = {};
  for (const name of ['u_rect', 'u_canvas', 'u_tex', 'u_glyphs', 'u_crop', 'u_grid', 'u_cellPx', 'u_levels', 'u_bar', 'u_alpha', 'u_ground', 'u_ink', 'u_key', 'u_keyEdge', 'u_develop', 'u_mode', 'u_glyphCount']) u[name] = gl.getUniformLocation(program, name);

  const unit = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, unit);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const aUnit = gl.getAttribLocation(program, 'a_unit');
  gl.enableVertexAttribArray(aUnit);
  gl.vertexAttribPointer(aUnit, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  const texture = (filter = gl.LINEAR) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    return t;
  };
  const glyphTex = texture();
  let ramp = GLYPHS;
  const buildGlyphs = () => {
    const atlas = glyphAtlas();
    ramp = atlas.ramp;
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    gl.useProgram(program);
    gl.uniform1f(u.u_glyphCount, ramp.length);
  };
  buildGlyphs();
  gl.uniform1i(u.u_tex, 0);
  gl.uniform1i(u.u_glyphs, 1);

  const stats = { renders: 0, uploads: 0 };
  let layers = [];
  let colours = { ground: [1, 1, 1], ink: [0, 0, 0] };
  let inkLight = false;
  let mode = 'bars';
  let cell = 7;
  let key = 0.04;
  let negative = false;
  let W = 1;
  let H = 1;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    W = Math.max(1, Math.round(canvas.clientWidth * dpr));
    H = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }

  // Columns and rows for a layer's box: cells keep their CSS size, so a phone coarsens instead of drawing
  // sub-pixel bars, and glyph cells are wider and about 0.6 as wide as tall.
  function grid(c) {
    const r = c.rect;
    const wCss = (r[2] - r[0]) / dpr;
    const hCss = (r[3] - r[1]) / dpr;
    const glyphs = mode === 'glyphs';
    const size = glyphs ? Math.max(MIN_CELL.glyphs, cell * GLYPH_SCALE * c.scale) : Math.max(MIN_CELL.bars, cell * c.scale);
    const cols = Math.max(1, Math.floor(wCss / size));
    const cw = wCss / cols;
    const rows = Math.max(1, Math.round(hCss / (glyphs ? cw / GLYPH_WIDE : cw * BAR_TALL)));
    return [cols, rows];
  }

  function upload(l) {
    const s = l.source;
    if (!s.ready()) return;
    const v = s.version();
    if (v === l.uploaded) return;
    const el = s.el;
    const w = el.videoWidth || el.naturalWidth || el.width;
    const h = el.videoHeight || el.naturalHeight || el.height;
    if (!w || !h) return;
    gl.bindTexture(gl.TEXTURE_2D, l.tex);
    if (l.size && l.size[0] === w && l.size[1] === h) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, el);
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el); l.size = [w, h]; }
    l.uploaded = v;
    stats.uploads++;
  }

  function render() {
    if (gl.isContextLost()) return;
    gl.viewport(0, 0, W, H);
    gl.useProgram(program);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.u_canvas, W, H);
    gl.uniform3fv(u.u_ink, colours.ink);
    gl.uniform1f(u.u_mode, mode === 'glyphs' ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.activeTexture(gl.TEXTURE0);
    for (const l of layers) {
      const c = l.cfg;
      if (c.hidden || !c.rect || !l.source) continue;
      const r = c.rect;
      if (r[2] <= 0 || r[0] >= W || r[3] <= 0 || r[1] >= H || r[2] - r[0] < 1 || r[3] - r[1] < 1) continue;
      const [cols, rows] = grid(c);
      l.source.fit?.(cols, rows);
      upload(l);
      const develop = clamp(c.develop * c.reveal, 0, 1);
      if (!l.size || develop <= 0.001) continue;
      gl.bindTexture(gl.TEXTURE_2D, l.tex);
      gl.uniform4f(u.u_rect, r[0], r[1], r[2], r[3]);
      gl.uniform4f(u.u_crop, c.crop[0], c.crop[1], c.crop[2], c.crop[3]);
      gl.uniform2f(u.u_grid, cols, rows);
      gl.uniform2f(u.u_cellPx, (r[2] - r[0]) / cols, (r[3] - r[1]) / rows);
      // Levels for this ground: keep the range away from zero, since equal points would divide by zero.
      const [b, w] = inkLight ? c.levels.inkLight : c.levels.inkDark;
      let black = b / 255;
      let white = w / 255;
      if (Math.abs(white - black) < 1 / 255) white = black + (white >= black ? 1 : -1) / 255;
      gl.uniform4f(u.u_levels, black, white, c.gamma ?? 1, 1);
      // The light-ground hairline floor develops with the levels, so the layer still rises from blank.
      const floor = !inkLight && c.floorOnLight != null ? c.bar[0] + (c.floorOnLight - c.bar[0]) * develop : c.bar[0];
      gl.uniform2f(u.u_bar, floor, c.bar[1]);
      // Negative weave: the ground becomes a plate in the ink colour and the bars are cut out of it; its opacity
      // develops with the levels, so the plate also rises from blank.
      const neg = negative && c.negatable;
      gl.uniform3fv(u.u_ground, neg ? colours.ink : colours.ground);
      gl.uniform2f(u.u_alpha, neg ? c.groundAlpha * develop : c.groundAlpha, neg ? 0 : c.inkAlpha);
      gl.uniform1f(u.u_key, c.key ?? key + (c.keyOffset || 0));
      gl.uniform1f(u.u_keyEdge, c.keyEdge ? 1 : 0);
      gl.uniform1f(u.u_develop, develop);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    stats.renders++;
  }

  function destroy() {
    for (const l of layers) gl.deleteTexture(l.tex);
    gl.deleteTexture(glyphTex);
    gl.deleteBuffer(unit);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  resize();
  return {
    stats, resize, render, destroy, buildGlyphs,
    get size() { return { W, H, dpr }; },
    // Each layer gets its own texture; the record is shared with the demo, so a swapped source re-uploads.
    setLayers(list) {
      for (const l of list) Object.assign(l, { tex: texture(l.source?.fit ? gl.NEAREST : gl.LINEAR), uploaded: -1, size: null });
      layers = list;
    },
    // True when any visible layer has a frame it has not uploaded yet.
    pending: () => layers.some((l) => !l.cfg.hidden && l.source?.ready() && l.source.version() !== l.uploaded),
    setColours(c) { colours = c; inkLight = luminance(c.ink) > luminance(c.ground); },
    setMode(m) { mode = m === 'glyphs' ? 'glyphs' : 'bars'; },
    setCell(px) { cell = px; },
    setKey(k) { key = k; },
    setNegative(v) { negative = !!v; },
  };
}
