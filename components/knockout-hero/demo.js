// Knockout wordmark — a festival name alone on the first screen, cut out as a window. The hero has no background:
// one SVG rect filled with the page colour and masked by the letters (white rect, black glyphs) paints it,
// overflowing the word's box while the hero clips it. Behind the page a fixed canvas at a sixth of the viewport draws
// four soft blobs on Lissajous paths plus light folds (the browser's upscale is the blur), so the colour shows only
// through the letters and stays put while they scroll past. The loop runs only while the hero is on screen; reduced
// motion: one still.
import './demo.css';
import { on, onFrame, whileVisible, html, readToken, content } from '../../src/demo-kit/index.js';

const SCALE = 1 / 6;  // backing store vs the viewport; the bilinear upscale supplies the softness
const STILL_T = 7.5;  // seconds: the composed frame the loop starts from and the reduced tier keeps
// base is [light theme, dark theme]: the ground must stay far from the page colour so the letters read at the edge.
// Blobs are the material tokens pushed toward full saturation (stage light, not paint) and screened over the base.
const PALETTES = {
  stage: { base: ['night', 'plum'], blobs: ['accent', 'plum', 'sky', 'sand'] },
  harbour: { base: ['night', 'moss'], blobs: ['sky', 'moss', 'sky', 'sand'] },
  ember: { base: ['plum', 'plum'], blobs: ['accent', 'clay', 'sand', 'accent'] },
};
// radius (× long side), x / y amplitude (× size), x / y angular speed (rad/s), phase
const PATHS = [
  [0.46, 0.34, 0.30, 0.50, 0.37, 0.0],
  [0.36, 0.38, 0.26, 0.35, 0.59, 2.1],
  [0.42, 0.30, 0.34, 0.66, 0.30, 4.0],
  [0.32, 0.36, 0.28, 0.43, 0.53, 5.3],
];

const rgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
// A token colour made vivid: same hue, saturation raised toward 1, lightness pulled to the middle.
const vivid = ([r, g, b]) => {
  const max = Math.max(r, g, b) / 255; const min = Math.min(r, g, b) / 255;
  let h = 0; const l = (max + min) / 2; const d = max - min;
  if (d) {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h *= 60;
  }
  const s = Math.min(1, (d ? d / (1 - Math.abs(2 * l - 1)) : 0) * 1.9 + 0.15);
  const L = 0.5 + (l - 0.5) * 0.45;
  const c = (1 - Math.abs(2 * L - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = L - c / 2;
  const [a1, b1, c1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [a1, b1, c1].map((v) => Math.round((v + m) * 255));
};

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  root.className = 'kh';
  root.innerHTML = html`
    <canvas class="kh__ground" aria-hidden="true" data-ground></canvas>
    <section class="kh__hero" aria-labelledby="kh-title" data-hero>
      <div class="ac-stage kh__screen">
        <h1 class="kh__mark" id="kh-title">
          <span class="sr-only" data-name></span>
          <svg class="kh__svg" aria-hidden="true" focusable="false" data-svg>
            <defs>
              <mask id="kh-mask" maskUnits="userSpaceOnUse" x="-6000" y="-6000" width="14000" height="14000">
                <rect x="-6000" y="-6000" width="14000" height="14000" fill="#fff"/>
                <text class="kh__glyphs" x="0" y="0" fill="#000" data-text></text>
              </mask>
            </defs>
            <rect class="kh__solid" x="-6000" y="-6000" width="14000" height="14000" mask="url(#kh-mask)"/>
          </svg>
        </h1>
        <p class="ac-stage__note"><span>${festival.name} · festival hero</span></p>
      </div>
    </section>`;

  const canvas = root.querySelector('[data-ground]');
  const g = canvas.getContext('2d', { alpha: false });
  const hero = root.querySelector('[data-hero]');
  const svg = root.querySelector('[data-svg]');
  const text = root.querySelector('[data-text]');
  const name = root.querySelector('[data-name]');

  // The word: SVG text in the page's own face, and a viewBox fitted to its ink so the grid places it like a block.
  const setWord = () => {
    const word = cfg.word.trim() || 'Signal';
    text.textContent = word;
    name.textContent = word;
    const cs = getComputedStyle(text);
    const m = document.createElement('canvas').getContext('2d');
    m.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('fontStretch' in m) m.fontStretch = 'expanded';
    if ('letterSpacing' in m) m.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const ink = m.measureText(word);
    let box = { x: -ink.actualBoundingBoxLeft, y: -ink.actualBoundingBoxAscent, w: ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight, h: ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent };
    if (!(box.w > 0 && box.h > 0)) { const b = text.getBBox(); box = { x: b.x, y: b.y, w: b.width, h: b.height }; }
    svg.setAttribute('viewBox', `${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.w.toFixed(1)} ${box.h.toFixed(1)}`);
  };

  // The ground.
  let colours = null;
  const readColours = () => {
    const p = PALETTES[cfg.palette] || PALETTES.stage;
    const dark = document.documentElement.dataset.theme === 'dark';
    // In the dark theme the base is its token half-way to night: dark enough for the screened blobs to glow,
    // still far enough from the page colour for the letters to read at their edges.
    const base = rgb(readToken(`--${p.base[dark ? 1 : 0]}`));
    const night = rgb(readToken('--night'));
    colours = { base: rgba(dark ? base.map((v, i) => Math.round(v * 0.5 + night[i] * 0.5)) : base, 1), blobs: p.blobs.map((t) => vivid(rgb(readToken(`--${t}`)))) };
  };
  const resize = () => {
    canvas.width = Math.max(1, Math.round(innerWidth * SCALE));
    canvas.height = Math.max(1, Math.round(innerHeight * SCALE));
  };
  let clock = STILL_T;
  const draw = (t) => {
    const { width: w, height: h } = canvas;
    const long = Math.max(w, h);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = colours.base;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'screen';
    PATHS.forEach(([r, ax, ay, wx, wy, p], i) => {
      const x = w * (0.5 + ax * Math.sin(t * wx + p));
      const y = h * (0.5 + ay * Math.cos(t * wy + p * 1.7));
      const grad = g.createRadialGradient(x, y, 0, x, y, r * long);
      grad.addColorStop(0, rgba(colours.blobs[i], 1));
      grad.addColorStop(1, rgba(colours.blobs[i], 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
    g.globalCompositeOperation = 'source-over';
    if (cfg.folds) {
      const folds = g.createLinearGradient(0, 0, w, h);
      for (let i = 0; i <= 16; i++) {
        const a = 0.16 * Math.sin((i / 16) * 3 * Math.PI * 2 - t * 0.9);
        folds.addColorStop(i / 16, a > 0 ? `rgba(255,255,255,${a.toFixed(3)})` : `rgba(0,0,30,${(-a).toFixed(3)})`);
      }
      g.fillStyle = folds;
      g.fillRect(0, 0, w, h);
    }
  };

  let off = null;
  let visible = false;
  const sync = () => {
    const run = ctx.motion === 'full' && cfg.speed > 0 && visible && !ctx.capture;
    if (run && !off) off = onFrame(ctx, (dt) => { clock += dt * cfg.speed; draw(clock); });
    if (!run && off) { off(); off = null; }
    if (!run) draw(clock);
  };

  readColours();
  resize();
  draw(clock);
  setWord();
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) setWord(); });
  whileVisible(ctx, hero, () => { visible = true; sync(); }, () => { visible = false; sync(); }, { rootMargin: '0px' });
  on(ctx, window, 'resize', () => { resize(); draw(clock); });
  ctx.onTheme(() => { readColours(); draw(clock); });

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('word')) setWord();
      if (changed.includes('palette')) readColours();
      sync();
      draw(clock);
    },
  };
}
