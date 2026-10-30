// Arc-length reveal — Signal's route map and its list of four routes, drawn by one WebGL2 pass as the scroll passes
// a sticky chapter. At mount the four cubic Bézier routes are rasterised into an RGBA8 mask: R the
// route id, G and B a 16-bit arc length (0 at the origin, 1 at the island), A the distance from the centreline.
// One uniform array of per-route progress then draws every route up to its own head, staggered (route i runs over
// [0.2·i, 0.2·i + 0.4] of the chapter), with a feathered front bowed by edge² so the head rounds like a cap.
// The scroll sets a target; the shared ticker damps toward it (k = 9) and leaves once it arrives.
// Reduced and static: every route drawn complete. No WebGL2: the same routes as SVG strokes.
import './demo.css';
import { on, html, raw, clamp, damp, ticker, observeResize, readToken, content } from '../../src/demo-kit/index.js';

// Routes in a 0..1 map box (y down), each from its origin to the island.
const ISLAND = [0.75, 0.36];
const ROUTES = [
  { name: 'Harbour bus 991', from: 'Nyhavn', time: '12 min', pts: [[0.07, 0.62], [0.3, 0.68], [0.52, 0.5], ISLAND], tint: '--accent', label: [0.07, 0.62] },
  { name: 'Metro M4 and shuttle', from: 'Kongens Nytorv', time: '18 min', pts: [[0.1, 0.93], [0.42, 0.92], [0.72, 0.74], ISLAND], tint: '--sky', label: [0.1, 0.93] },
  { name: 'Festival ferry', from: 'Nordhavn', time: '20 min', pts: [[0.3, 0.06], [0.46, 0.08], [0.66, 0.14], ISLAND], tint: '--moss', label: [0.3, 0.06] },
  { name: 'Bike route', from: 'Christianshavn', time: '15 min', pts: [[0.52, 0.95], [0.66, 0.86], [0.92, 0.66], ISLAND], tint: '--plum', label: [0.52, 0.95] },
];
const N = ROUTES.length;
const SEGMENTS = 96;      // polyline steps per route
const DPR_CAP = 1.5;
const PIXEL_BUDGET = 2_400_000;

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); // one big triangle
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const FRAG = `#version 300 es
precision highp float;
uniform highp sampler2D u_meta;
uniform float u_reveal[${N}];
uniform vec3 u_tint[${N}];
uniform float u_feather;
uniform float u_round;
out vec4 color;
void main() {
  ivec2 size = textureSize(u_meta, 0);
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 m = texelFetch(u_meta, ivec2(px.x, size.y - 1 - px.y), 0);
  int id = int(m.r * 255.0 + 0.5) - 1;
  if (id < 0) { color = vec4(0.0); return; }
  float arc = (floor(m.g * 255.0 + 0.5) * 256.0 + floor(m.b * 255.0 + 0.5)) / 65535.0; // 16-bit decode
  float edge = m.a * 255.0 / 200.0;   // 0 on the centreline, 1 at the stroke side
  float cover = 1.0 - smoothstep(0.86, 1.0, edge);
  float reveal = 0.0; vec3 tint = vec3(1.0);
  for (int i = 0; i < ${N}; i++) if (i == id) { reveal = u_reveal[i]; tint = u_tint[i]; }
  float front = arc + u_feather * u_round * edge * edge;   // the sides trail the centre: a rounded head
  float visible = 1.0 - smoothstep(reveal - u_feather, reveal, front);
  float shade = 0.78 + 0.22 * sqrt(max(0.0, 1.0 - edge * edge));   // a little tube shading from the edge field
  float a = cover * visible;
  color = vec4(tint * shade * a, a);
}`;

const bez = ([a, b, c, d], t) => {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1]];
};

// Sample each Bézier into a polyline with cumulative pixel arc length, normalised to 0..1.
function polylines(w, h) {
  return ROUTES.map(({ pts: p }) => {
    const out = [];
    let len = 0;
    for (let s = 0; s <= SEGMENTS; s++) {
      const [x0, y0] = bez(p, s / SEGMENTS);
      const x = x0 * w, y = y0 * h;
      if (out.length) len += Math.hypot(x - out.at(-1).x, y - out.at(-1).y);
      out.push({ x, y, s: len });
    }
    for (const q of out) q.s /= len;
    return out;
  });
}

// The mask: per texel, the nearest route segment within the stroke wins.
// R = route id + 1 (0 = empty), G/B = arc length × 65535 (high/low byte), A = distance / radius × 200.
function buildMask(w, h, lines, radius) {
  const data = new Uint8Array(w * h * 4);
  const best = new Float32Array(w * h).fill(Infinity);
  const r = radius * Math.min(w, h);
  const reach = r * 1.25;
  lines.forEach((pts, id) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const dx = q.x - p.x, dy = q.y - p.y, l2 = dx * dx + dy * dy || 1e-6;
      const x0 = Math.max(0, Math.floor(Math.min(p.x, q.x) - reach)), x1 = Math.min(w - 1, Math.ceil(Math.max(p.x, q.x) + reach));
      const y0 = Math.max(0, Math.floor(Math.min(p.y, q.y) - reach)), y1 = Math.min(h - 1, Math.ceil(Math.max(p.y, q.y) + reach));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const t = clamp(((px - p.x) * dx + (py - p.y) * dy) / l2, 0, 1);
          const d = Math.hypot(px - p.x - dx * t, py - p.y - dy * t);
          const k = y * w + x;
          if (d > reach || d >= best[k]) continue;
          best[k] = d;
          const arc = Math.round((p.s + (q.s - p.s) * t) * 65535);
          data[k * 4] = id + 1; data[k * 4 + 1] = arc >> 8; data[k * 4 + 2] = arc & 255; data[k * 4 + 3] = Math.min(255, Math.round((d / r) * 200));
        }
      }
    }
  });
  return data;
}

// A token's computed colour as linear-ish 0..1 RGB for a uniform (the canvas is sRGB; no conversion needed here).
function rgbOf(token) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = readToken(token) || '#888';
  c.fillRect(0, 0, 1, 1);
  return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => v / 255);
}
const svgPath = ({ pts: [a, b, c, d] }) => `M${a[0] * 100} ${a[1] * 100}C${b[0] * 100} ${b[1] * 100} ${c[0] * 100} ${c[1] * 100} ${d[0] * 100} ${d[1] * 100}`;

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  const live = ctx.motion === 'full';

  root.className = 'ar';
  root.innerHTML = html`
    <section class="ar__chapter" aria-labelledby="ar-routes" data-chapter>
      <div class="ar__stage ac-wrap">
        <h2 class="sr-only" id="ar-routes">Routes to ${festival.name}</h2>
        <ol class="ar__list" role="list">
          ${ROUTES.map((r, i) => html`<li class="ar__route" data-route="${i}" style="--tint: var(${r.tint})"><span class="ar__swatch" aria-hidden="true"><i></i></span><p class="ar__name">${r.name}<span class="sr-only">, from ${r.from},</span><span class="ar__time ac-label">${r.time}</span></p></li>`)}
        </ol>
        <figure class="ar__map" aria-hidden="true" data-map>
          <svg class="ar__ground" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path class="ar__water" d="M100 0H58C56 14 50 22 40 30C30 38 16 44 0 48V60C20 58 38 52 52 44C60 40 64 46 62 54C60 62 66 70 76 72C86 74 94 70 100 64Z"/>
            <ellipse class="ar__isle" cx="${ISLAND[0] * 100}" cy="${ISLAND[1] * 100}" rx="11" ry="9"/>
          </svg>
          <svg class="ar__fallback" viewBox="0 0 100 100" preserveAspectRatio="none" hidden>${raw(ROUTES.map((r) => `<path d="${svgPath(r)}" style="stroke: var(${r.tint})"/>`).join(''))}</svg>
          <div class="ar__gl" data-gl></div>
          ${ROUTES.map((r, i) => html`<span class="ar__stop" data-stop="${i}" style="left:${r.label[0] * 100}%; top:${r.label[1] * 100}%; --tint: var(${r.tint})"><i></i><b>${r.from}</b></span>`)}
          <span class="ar__dest" data-dest style="left:${ISLAND[0] * 100}%; top:${ISLAND[1] * 100}%"><i></i><b>${festival.name} · Refshaleøen</b></span>
        </figure>
      </div>
    </section>`;

  const chapter = root.querySelector('[data-chapter]');
  const map = root.querySelector('[data-map]');
  const host = root.querySelector('[data-gl]');
  const items = [...root.querySelectorAll('[data-route]')];
  const stops = [...root.querySelectorAll('[data-stop]')];
  const dest = root.querySelector('[data-dest]');
  const S = { progress: live ? 0 : 1, target: live ? 0 : 1 };

  // Global progress → per-route progress, scaled so the feathered head fully clears the end.
  const span = () => Math.max(0.1, 1 - (N - 1) * cfg.stagger);
  const routeReveal = (p) => ROUTES.map((_, i) => clamp((p - i * cfg.stagger) / span(), 0, 1));
  const chapterProgress = () => {
    const r = chapter.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
  };
  // The DOM follows the same numbers: each list item and origin lights as its route starts; the island at the end.
  const syncDom = (reveal) => {
    reveal.forEach((v, i) => {
      items[i].style.setProperty('--p', v.toFixed(3));
      items[i].classList.toggle('is-on', v > 0.001);
      stops[i].classList.toggle('is-on', v > 0.001);
    });
    dest.classList.toggle('is-on', reveal[N - 1] >= 0.98);
  };

  let gl = null;
  try { gl = startGL(); } catch (e) { console.warn('arc-reveal: falling back to SVG', e); gl = null; }
  if (!gl) {
    host.remove();
    root.querySelector('.ar__fallback').hidden = false;
    syncDom(routeReveal(1));
    root.classList.add('ar--still');
    return { update(next) { cfg = { ...next }; } };
  }

  function startGL() {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const g = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true });
    if (!g) return null;
    host.append(canvas);
    const sh = (type, src) => {
      const s = g.createShader(type);
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
      return s;
    };
    const prog = g.createProgram();
    g.attachShader(prog, sh(g.VERTEX_SHADER, VERT));
    g.attachShader(prog, sh(g.FRAGMENT_SHADER, FRAG));
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog));
    g.useProgram(prog);
    const vao = g.createVertexArray();
    g.bindVertexArray(vao);
    const loc = (n) => g.getUniformLocation(prog, n);
    g.uniform1i(loc('u_meta'), 0);
    const tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
    g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
    const uReveal = loc('u_reveal');
    const uTint = loc('u_tint');
    const uFeather = loc('u_feather');
    const uRound = loc('u_round');

    const tints = () => {
      const accent = rgbOf('--accent');
      const ink = rgbOf('--ink');
      // Transit: one material per line. Accent: one hue shaded toward ink, as the recipe draws its channels.
      const list = cfg.palette === 'accent'
        ? ROUTES.map((_, i) => accent.map((a, c) => a + (ink[c] - a) * (i / (N - 1)) * 0.6))
        : ROUTES.map((r) => rgbOf(r.tint));
      g.uniform3fv(uTint, list.flat());
    };
    const build = () => {
      const cw = host.clientWidth, ch = host.clientHeight;
      const dpr = Math.min(devicePixelRatio || 1, DPR_CAP, Math.sqrt(PIXEL_BUDGET / Math.max(1, cw * ch)));
      const w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
      canvas.width = w; canvas.height = h;
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, buildMask(w, h, polylines(w, h), cfg.width / 1000));
      g.viewport(0, 0, w, h);
    };
    const draw = () => {
      const reveal = routeReveal(S.progress);
      // Scale each route's progress so the feathered, rounded head clears the end (front max = 1 + feather · round).
      const f = cfg.feather;
      g.uniform1fv(uReveal, reveal.map((v) => v * (1 + f + f * cfg.round + 0.02)));
      g.uniform1f(uFeather, f);
      g.uniform1f(uRound, cfg.round);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.drawArrays(g.TRIANGLES, 0, 3);
      syncDom(reveal);
    };
    ctx.onCleanup(() => { g.deleteTexture(tex); g.deleteProgram(prog); g.deleteVertexArray(vao); g.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); });
    canvas.addEventListener('webglcontextlost', () => { root.querySelector('.ar__fallback').hidden = false; canvas.remove(); }, { signal: ctx.signal });
    tints();
    build();
    return { build, draw, tints };
  }

  // Resizing rebuilds the mask at the new size, once per frame at most.
  let queued = false;
  observeResize(ctx, host, () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; if (!ctx.signal.aborted) { gl.build(); gl.draw(); } });
  });
  ctx.onTheme(() => { gl.tints(); gl.draw(); });
  gl.draw();

  if (!live) {
    root.classList.add('ar--still');
    return { update(next, changed) { cfg = { ...next }; if (changed.includes('width')) gl.build(); gl.tints(); gl.draw(); } };
  }

  // The scroll sets a target; the shared ticker eases toward it and leaves once it arrives.
  let ticking = false;
  const step = (dt) => {
    S.progress = damp(S.progress, S.target, 9, dt);
    if (Math.abs(S.progress - S.target) < 1e-4) { S.progress = S.target; ticker.remove(step); ticking = false; }
    gl.draw();
  };
  const wake = () => {
    S.target = chapterProgress();
    if (!ticking && S.target !== S.progress) { ticking = true; ticker.add(step); }
  };
  ctx.onCleanup(() => ticker.remove(step));
  on(ctx, window, 'scroll', wake, { passive: true });
  on(ctx, window, 'resize', wake);
  wake();

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('width')) gl.build();
      if (changed.includes('palette')) gl.tints();
      gl.draw();
    },
  };
}
