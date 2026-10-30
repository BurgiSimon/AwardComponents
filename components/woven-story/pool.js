// The weave compositor: one raw-WebGL context on a detached canvas draws every woven picture on the page. A scene
// is drawn into the top-left slice of the shared buffer (viewport(0, H − h, w, h)) and copied with drawImage into the
// scene's own 2D canvas in the same task, while the drawing buffer is still valid without preserveDrawingBuffer. The
// buffer only grows, so scenes of different sizes never reallocate it. Clips are pooled: a clip three layers show is
// one texture, uploaded at most once per new frame of its source, however many scenes draw it.
// No imports: the demo hands it sources ({ el, version() }) and scene records, and reads `stats` back.

const VERT = `
attribute vec2 a_unit;
uniform vec4 u_rect;        // the layer's box in the scene, device px, y down
uniform vec2 u_size;        // the scene, device px
varying vec2 v_uv;
void main() {
  vec2 px = mix(u_rect.xy, u_rect.zw, a_unit);
  gl_Position = vec4(px.x / u_size.x * 2.0 - 1.0, 1.0 - px.y / u_size.y * 2.0, 0.0, 1.0);
  v_uv = a_unit;
}`;

const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform sampler2D u_glyphs;
uniform vec2 u_grid;        // cells across and down the layer
uniform vec2 u_cellPx;      // one cell in device px
uniform vec4 u_levels;      // black, white (0..1; black above white inverts), gamma, threshold
uniform vec2 u_alpha;       // ground, ink opacity
uniform vec3 u_ground;
uniform vec3 u_ink;
uniform float u_key;
uniform float u_keyEdge;
uniform float u_develop;
uniform float u_mode;       // 0 bars, 1 glyphs
uniform float u_glyphCount;
varying vec2 v_uv;
bool keyed(vec2 uv) { vec4 t = texture2D(u_tex, uv); return t.a < 0.01 || max(t.r, max(t.g, t.b)) <= u_key; }
void main() {
  vec2 cell = floor(v_uv * u_grid);
  vec2 c = (cell + 0.5) / u_grid;
  vec2 q = 0.3 / u_grid;
  // Black is the key: a cell whose centre (or, with keyEdge, any quarter point) is black draws nothing.
  if (keyed(c)) discard;
  if (u_keyEdge > 0.5 && (keyed(c - q) || keyed(c + q) || keyed(c + vec2(q.x, -q.y)) || keyed(c + vec2(-q.x, q.y)))) discard;
  // Four taps per cell: footage has more texels than the grid has cells, and one tap shimmers as it plays.
  vec3 rgb = (texture2D(u_tex, c - q).rgb + texture2D(u_tex, c + q).rgb + texture2D(u_tex, c + vec2(q.x, -q.y)).rgb + texture2D(u_tex, c + vec2(-q.x, q.y)).rgb) * 0.25;
  rgb = pow(rgb, vec3(u_levels.z));
  float tone = clamp((dot(rgb, vec3(0.2126, 0.7152, 0.0722)) - u_levels.x) / (u_levels.y - u_levels.x), 0.0, 1.0);
  tone = mix(1.0, tone, u_develop);
  float ink = tone > u_levels.w ? 0.0 : 1.0 - tone;
  vec2 f = fract(v_uv * u_grid);
  float cover;
  if (u_mode < 0.5) {
    // A bar whose width is the ink, box-filtered over one device pixel; zero width draws nothing.
    float half_w = 0.5 * mix(-0.02, 1.02, ink);
    float px = 1.0 / u_cellPx.x;
    cover = clamp((half_w - abs(f.x - 0.5)) / px + 0.5, 0.0, 1.0) * clamp(2.0 * half_w / px, 0.0, 1.0);
  } else {
    cover = texture2D(u_glyphs, vec2((floor(ink * (u_glyphCount - 1.0) + 0.5) + f.x) / u_glyphCount, f.y)).a;
  }
  // Premultiplied: a part-covered pixel on a clear ground is ink at part opacity, never ink mixed with the ground.
  gl_FragColor = mix(vec4(u_ground * u_alpha.x, u_alpha.x), vec4(u_ink * u_alpha.y, u_alpha.y), cover);
}`;

// Cells never get smaller than this many CSS px: under it the weave turns to grey noise.
export const MIN_CELL = { bars: 5, glyphs: 9 };
const GLYPH_ASPECT = 0.6;     // a glyph cell is 0.6 as wide as it is tall
const GLYPHS = [' ', '.', ':', '-', '=', '+', '*', '%', '#', '@'];
const GCELL = { w: 36, h: 60 };

// The ramp is sorted by each glyph's measured ink in the face the page actually has.
function glyphAtlas(family) {
  const draw = (ramp) => {
    const c = document.createElement('canvas');
    c.width = GCELL.w * ramp.length;
    c.height = GCELL.h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${Math.round(GCELL.h * 0.74)}px ${family}`;
    ramp.forEach((ch, i) => g.fillText(ch, GCELL.w * (i + 0.5), GCELL.h * 0.54));
    return { c, g };
  };
  const { g } = draw(GLYPHS);
  const ramp = GLYPHS.map((ch, i) => {
    const d = g.getImageData(i * GCELL.w, 0, GCELL.w, GCELL.h).data;
    let a = 0;
    for (let k = 3; k < d.length; k += 4) a += d[k];
    return [ch, a];
  }).sort((p, q) => p[1] - q[1]).map((x) => x[0]);
  return { canvas: draw(ramp).c, count: ramp.length };
}

// Any CSS colour → [r, g, b] in 0..1. Hex directly; anything else (rgb(), hsl(), oklch(), a name) through one
// painted pixel, with two sentinels so an invalid colour is rejected instead of read as the sentinel.
let swatch = null;
export function parseColour(value) {
  const s = String(value || '').trim();
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  if (!s) return null;
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

// Where a layer sits in its scene, in device px: object-fit (cover / contain) and object-position, plus a zoom.
export function layerRect(scene, layer, size) {
  const [cw, ch] = size;
  const s = (layer.fit === 'contain' ? Math.min(scene.W / cw, scene.H / ch) : Math.max(scene.W / cw, scene.H / ch)) * (layer.zoom ?? 1);
  const w = cw * s;
  const h = ch * s;
  const [ax, ay] = layer.align ?? [0.5, 0.5];
  const x = (scene.W - w) * ax;
  const y = (scene.H - h) * ay;
  return [x, y, x + w, y + h];
}

export function createPool({ font = 'ui-monospace, monospace' } = {}) {
  const canvas = document.createElement('canvas'); // detached: never in the DOM
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed');
    return sh;
  };
  let vs;
  let fs;
  let program;
  try {
    vs = compile(gl.VERTEX_SHADER, VERT);
    fs = compile(gl.FRAGMENT_SHADER, FRAG);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'program link failed');
  } catch (error) {
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // a pool that cannot draw gives its context back at once
    throw error;
  }
  gl.useProgram(program);
  const u = {};
  for (const n of ['u_rect', 'u_size', 'u_tex', 'u_glyphs', 'u_grid', 'u_cellPx', 'u_levels', 'u_alpha', 'u_ground', 'u_ink', 'u_key', 'u_keyEdge', 'u_develop', 'u_mode', 'u_glyphCount']) u[n] = gl.getUniformLocation(program, n);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, 'a_unit');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  const textures = [];
  const texture = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    textures.push(t);
    return t;
  };
  const glyphTex = texture();
  let glyphCount = GLYPHS.length;
  function setGlyphFont(family) {
    const atlas = glyphAtlas(family);
    glyphCount = atlas.count;
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
  }
  setGlyphFont(font);
  gl.uniform1i(u.u_tex, 0);
  gl.uniform1i(u.u_glyphs, 1);

  const stats = { uploads: 0, layers: 0, copies: 0 };
  const clips = new Map(); // name → { source, tex, uploaded, size, uploads }

  function addClip(name, source) { clips.set(name, { source, tex: texture(), uploaded: -1, size: null, uploads: 0 }); }
  // A new source (the poster giving way to the playing video) reallocates the texture on its first upload.
  function setSource(name, source) {
    const c = clips.get(name);
    if (!c) return;
    c.source = source;
    c.uploaded = -1;
    c.size = null;
  }
  const sourceSize = (el) => [el.videoWidth || el.naturalWidth || el.width || 0, el.videoHeight || el.naturalHeight || el.height || 0];
  // At most once per new frame of the source, however many layers read it. Returns 1 when it uploaded.
  function upload(c) {
    const v = c.source.version();
    if (v === c.uploaded) return 0;
    const el = c.source.el;
    // A video can know its size before it has a frame; uploading then leaves the texture undefined.
    if (el instanceof HTMLVideoElement && el.readyState < el.HAVE_CURRENT_DATA) return 0;
    if (el instanceof HTMLImageElement && !(el.complete && el.naturalWidth)) return 0;
    const [w, h] = sourceSize(el);
    if (!w || !h) return 0;
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    if (c.size && c.size[0] === w && c.size[1] === h) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, el);
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el); c.size = [w, h]; }
    c.uploaded = v;
    c.uploads++;
    stats.uploads++;
    return 1;
  }
  // The size a clip will draw at, before its first upload (for layout decisions the demo makes).
  const sizeOf = (name) => { const c = clips.get(name); return c?.size || (c ? sourceSize(c.source.el) : [0, 0]); };

  // The shared buffer grows to the largest scene seen and never shrinks.
  function ensure(w, h) {
    if (canvas.width < w || canvas.height < h) {
      canvas.width = Math.max(canvas.width, w);
      canvas.height = Math.max(canvas.height, h);
    }
  }

  // scene: { ctx (2D), W, H (device px), dpr, mode, cell (CSS px), ground, ink, develop, layers: [layer] }
  // layer: { clip, fit, align, zoom, levels: [black, white, gamma, threshold] (0..255), develop, key, keyEdge,
  //          groundAlpha, inkAlpha }
  // Returns { uploads, layers } for this draw.
  function draw(scene) {
    const { W, H } = scene;
    let uploads = 0;
    let drawn = 0;
    ensure(W, H);
    gl.viewport(0, canvas.height - H, W, H); // the top-left slice, which drawImage reads from (0, 0)
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, canvas.height - H, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(program);
    gl.uniform2f(u.u_size, W, H);
    gl.uniform3fv(u.u_ground, scene.ground);
    gl.uniform3fv(u.u_ink, scene.ink);
    gl.uniform1f(u.u_mode, scene.mode === 'glyphs' ? 1 : 0);
    gl.uniform1f(u.u_glyphCount, glyphCount);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.activeTexture(gl.TEXTURE0);
    for (const l of scene.layers) {
      const dev = (l.develop ?? 1) * (scene.develop ?? 1);
      if (dev <= 0.001) continue; // a layer with no ink draws nothing and needs no frame
      const c = clips.get(l.clip);
      if (!c) continue;
      uploads += upload(c);
      if (!c.size) continue;
      const [x0, y0, x1, y1] = layerRect(scene, l, c.size);
      if (x1 <= 0 || x0 >= W || y1 <= 0 || y0 >= H) continue;
      const w = x1 - x0;
      const h = y1 - y0;
      let cols;
      let rows;
      if (scene.mode === 'glyphs') {
        const cw = Math.max(MIN_CELL.glyphs, scene.cell * 1.6) * scene.dpr;
        cols = Math.max(1, Math.round(w / cw));
        rows = Math.max(1, Math.round(h / (cw / GLYPH_ASPECT)));
      } else {
        const cw = Math.max(MIN_CELL.bars, scene.cell) * scene.dpr;
        cols = Math.max(1, Math.round(w / cw));
        rows = Math.max(1, Math.round(h / cw));
      }
      let [black, white, gamma = 1, threshold = 255] = l.levels;
      black /= 255;
      white /= 255;
      if (Math.abs(white - black) < 1 / 255) white = black + (white >= black ? 1 : -1) / 255;
      gl.bindTexture(gl.TEXTURE_2D, c.tex);
      gl.uniform4f(u.u_rect, x0, y0, x1, y1);
      gl.uniform2f(u.u_grid, cols, rows);
      gl.uniform2f(u.u_cellPx, w / cols, h / rows);
      gl.uniform4f(u.u_levels, black, white, gamma, threshold / 255);
      gl.uniform2f(u.u_alpha, l.groundAlpha ?? 0, l.inkAlpha ?? 1);
      gl.uniform1f(u.u_key, l.key ?? 0.04);
      gl.uniform1f(u.u_keyEdge, l.keyEdge === false ? 0 : 1);
      gl.uniform1f(u.u_develop, dev);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      drawn++;
      stats.layers++;
    }
    // Same task as the draw: the drawing buffer is still valid without preserveDrawingBuffer.
    scene.ctx.clearRect(0, 0, W, H);
    scene.ctx.drawImage(canvas, 0, 0, W, H, 0, 0, W, H);
    stats.copies++;
    return { uploads, layers: drawn };
  }

  function dispose() {
    for (const t of textures) gl.deleteTexture(t);
    gl.deleteBuffer(quad);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.width = 1;
    canvas.height = 1;
  }

  return { canvas, gl, stats, clips, addClip, setSource, sizeOf, draw, setGlyphFont, dispose };
}
