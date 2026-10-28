// Extruded logo — a festival's identity page, its mark given a body. The mark (a dot and three arcs each side) is a
// 2D signed distance; one fullscreen triangle of raw WebGL 2 extrudes it with a depth and a rounded bevel and
// raymarches it inside its bounding box with a fixed step budget. Shading is reflection only: a procedural studio
// environment (dark ahead, a bright ring at grazing angles, one soft key), four-tap normals and occlusion, a Schlick
// tint, inline ACES and gamma. Intro: depth grows out of the flat mark while the yaw settles, then a slow sway.
// Reduced motion, static, no WebGL 2 and a lost context all keep an SVG stroke still of the same mark.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, html, raw, readToken, content } from '../../src/demo-kit/index.js';

// The recipe's own values; depth, bevel, finish and sway come from the controls. Units: the outer arc's radius is .74.
const P = { steps: 80, hit: 5e-4, exposure: 1.15, camDist: 3.2, focal: 2.6, introDepth: 0.9, introTurn: 1.6, swayRate: 0.55, dprCap: 2, budget: 2e6 };
const MARK = { dot: 0.14, radii: [0.3, 0.52, 0.74], half: 0.07, aperture: (48 * Math.PI) / 180 };

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); // one big triangle
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_yaw, u_depth, u_bevel, u_exposure;
uniform vec3 u_tint;
out vec4 color;

// The 2D mark: a dot and three arcs, each folded to both sides. Any 2D SDF can go here, a baked texture included.
float sdArc(vec2 p, vec2 sc, float ra, float rb) { // arc around +y, half-aperture given as (sin, cos), round caps
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}
float mark(vec2 p) {
  vec2 q = vec2(p.y, abs(p.x)); // arcs open along ±x
  vec2 sc = vec2(${Math.sin(MARK.aperture).toFixed(5)}, ${Math.cos(MARK.aperture).toFixed(5)});
  float d = length(p) - ${MARK.dot.toFixed(3)};
  ${MARK.radii.map((r) => `d = min(d, sdArc(q, sc, ${r.toFixed(3)}, ${MARK.half.toFixed(3)}));`).join('\n  ')}
  return d;
}
// Extrude, then round: shrink the profile and the depth by the bevel, subtract it after.
float map(vec3 p) {
  vec2 w = vec2(mark(p.xy) + u_bevel, abs(p.z) - (u_depth - u_bevel));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - u_bevel;
}
vec3 normalAt(vec3 p) { // tetrahedron: four taps
  const vec2 k = vec2(1.0, -1.0);
  const float h = 5e-4;
  return normalize(k.xyy * map(p + k.xyy * h) + k.yyx * map(p + k.yyx * h) + k.yxy * map(p + k.yxy * h) + k.xxx * map(p + k.xxx * h));
}
float ambientOcclusion(vec3 p, vec3 n) { // four taps along the normal
  float occ = 0.0, wgt = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.02 + 0.05 * float(i);
    occ += (h - map(p + n * h)) * wgt;
    wgt *= 0.6;
  }
  return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}
// Studio environment: dark straight ahead, a bright ring at grazing angles, brighter overhead, one soft key.
vec3 env(vec3 r) {
  float ring = smoothstep(0.25, 0.85, 1.0 - abs(r.z));
  float sky = 0.55 + 0.45 * r.y;
  vec3 key = normalize(vec3(-0.45, 0.56, 0.7));
  // A broad softbox above and in front: the faces carry a gradient that moves as the mark sways.
  float box = smoothstep(0.35, 0.95, dot(r, normalize(vec3(0.25, 0.8, 0.55))));
  return vec3(0.025) + vec3(0.62, 0.62, 0.64) * box + vec3(1.0, 0.98, 0.95) * ring * sky * 1.6 + vec3(2.5) * pow(max(dot(r, key), 0.0), 60.0);
}
vec3 aces(vec3 x) { return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / (0.5 * min(u_res.x, u_res.y));
  float c = cos(u_yaw), s = sin(u_yaw);
  mat3 rot = mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); // yaw about Y
  vec3 ro = rot * vec3(0.0, 0.0, ${P.camDist.toFixed(2)});
  vec3 rd = rot * normalize(vec3(uv, -${P.focal.toFixed(2)}));

  // Clip the ray to the mark's box: pixels that miss it never march.
  vec3 bmax = vec3(0.84, 0.62, u_depth + 0.01);
  vec3 inv = 1.0 / rd, t0 = (-bmax - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tn > tf || tf < 0.0) { color = vec4(0.0); return; }

  float t = max(tn, 0.0);
  bool hit = false;
  for (int i = 0; i < ${P.steps}; i++) {
    float d = map(ro + rd * t);
    if (d < ${P.hit}) { hit = true; break; }
    t += d;
    if (t > tf) break;
  }
  if (!hit) { color = vec4(0.0); return; }

  vec3 p = ro + rd * t, n = normalAt(p);
  vec3 r = reflect(rd, n);
  float cosv = clamp(dot(n, -rd), 0.0, 1.0);
  vec3 F = u_tint + (1.0 - u_tint) * pow(1.0 - cosv, 5.0); // Schlick on the tint
  vec3 lin = env(r) * F * ambientOcclusion(p, n);
  vec3 srgb = pow(aces(lin * u_exposure), vec3(1.0 / 2.2)); // inline tone map and gamma: no render target
  color = vec4(srgb, 1.0);
}`;

// The same mark as SVG strokes: the still for every path without a running context.
function markSVG() {
  const a = MARK.aperture;
  const arcs = MARK.radii.map((r) => {
    const x = (r * Math.cos(a)).toFixed(3);
    const y = (r * Math.sin(a)).toFixed(3);
    return `<path d="M${x},${-y} A${r},${r} 0 0 1 ${x},${y}"/><path d="M${-x},${-y} A${r},${r} 0 0 0 ${-x},${y}"/>`;
  }).join('');
  return (cls, width) => `<g class="${cls}" stroke-width="${width}"><circle r="${MARK.dot / 2}" stroke-width="${MARK.dot}"/>${arcs}</g>`;
}
const STROKES = markSVG();
const FLAT = `<svg viewBox="-0.9 -0.9 1.8 1.8" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round">${STROKES('', MARK.half * 2)}</svg>`;

// Finishes as Schlick F0 tints, from the palette: chrome is near-neutral, brass leans on sand, vermilion on the accent.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexLinear = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [n >> 16, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
};
const FINISH = {
  chrome: () => [0.93, 0.94, 0.96],
  brass: () => hexLinear(readToken('--sand')).map((v, i) => Math.min(1, v * [1.25, 1.12, 0.78][i])),
  vermilion: () => hexLinear(readToken('--accent')).map((v) => 0.12 + v * 0.85),
};
const easeOut = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  root.className = 'sl';
  root.innerHTML = html`
    <header class="ac-bar sl__bar">
      <a class="ac-brand sl__brand" href="#top"><span class="sl__mini">${raw(FLAT)}</span>${festival.name}</a>
      <nav aria-label="Festival"><a href="#top">Line-up</a><a href="#top">Tickets</a><a href="#top" aria-current="page">Press</a></nav>
    </header>
    <main class="sl__main ac-wrap">
      <section class="sl__copy" aria-labelledby="sl-title">
        <p class="ac-label">${festival.edition} · Identity</p>
        <h1 class="ac-display" id="sl-title">One dot, three arcs.</h1>
        <p class="ac-lede">The mark is a transmitter: a point and the signal leaving it. It holds at sixteen pixels, cuts cleanly from steel for the gate signs and turns up on every wristband.</p>
        <ul class="sl__uses" role="list" aria-label="The flat mark">
          <li><span class="sl__tile">${raw(FLAT)}</span><span class="ac-label">Positive</span></li>
          <li><span class="sl__tile sl__tile--rev">${raw(FLAT)}</span><span class="ac-label">Reversed</span></li>
          <li><span class="sl__tile sl__tile--small">${raw(FLAT)}</span><span class="ac-label">16 px</span></li>
        </ul>
        <div class="sl__buy">
          <a class="ac-btn" href="#download">Download the mark</a>
          <a class="ac-link sl__more" href="#guide">Brand guidelines, 24 pages</a>
        </div>
      </section>
      <div class="sl__stage" role="img" aria-label="The Signal mark, a dot with three arcs on each side, rendered as polished metal" data-stage>
        <svg class="sl__still" viewBox="-1 -1 2 2" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round">${raw(STROKES('sl__edge', MARK.half * 2 + 0.06))}${raw(STROKES('sl__face', MARK.half * 2))}</svg>
        <canvas class="sl__gl" aria-hidden="true"></canvas>
      </div>
    </main>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const stage = root.querySelector('[data-stage]');
  const canvas = stage.querySelector('canvas');
  // Reduced and static keep the SVG still: no context is created at all.
  if (ctx.motion !== 'full') return { update(next) { cfg = { ...next }; } };
  let gl = null;
  try { gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true }); } catch { gl = null; }
  if (!gl) return { update(next) { cfg = { ...next }; } };

  let prog;
  try {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn('extruded logo: keeping the SVG still', e);
    return { update(next) { cfg = { ...next }; } };
  }
  gl.useProgram(prog);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const loc = (n) => gl.getUniformLocation(prog, n);
  const U = { yaw: loc('u_yaw'), depth: loc('u_depth'), bevel: loc('u_bevel'), res: loc('u_res'), tint: loc('u_tint') };
  gl.uniform1f(loc('u_exposure'), P.exposure);
  let live = true;
  ctx.onCleanup(() => {
    live = false;
    gl.deleteProgram(prog);
    gl.deleteVertexArray(vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });
  // Any context loss falls back to the SVG still for good.
  on(ctx, canvas, 'webglcontextlost', (e) => { e.preventDefault(); live = false; stage.classList.remove('sl--gl'); });

  let time = 0;
  // Intro: depth grows out of the flat mark, yaw settles from −90°, then a slow sway.
  const pose = (t) => {
    const d = easeOut(t / P.introDepth);
    const turn = easeOut(t / P.introTurn);
    const sway = (cfg.sway * Math.PI) / 180;
    return { yaw: (-Math.PI / 2) * (1 - turn) + sway * turn * Math.sin(Math.max(0, t - P.introTurn) * P.swayRate), depth: d };
  };
  const draw = () => {
    if (!live) return;
    const { yaw, depth } = pose(time);
    const bevel = Math.min(cfg.bevel, cfg.depth - 0.004, MARK.half - 0.004);
    const minDepth = bevel + 0.004; // the rounding needs depth > bevel
    gl.uniform1f(U.yaw, yaw);
    gl.uniform1f(U.depth, minDepth + (cfg.depth - minDepth) * depth);
    gl.uniform1f(U.bevel, Math.max(0, bevel));
    gl.uniform3fv(U.tint, FINISH[cfg.finish]());
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const resize = () => {
    if (!live) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, P.dprCap, Math.sqrt(P.budget / Math.max(1, cw * ch)));
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    draw();
  };
  stage.classList.add('sl--gl'); // the canvas takes over from the still once a context exists
  resize();
  observeResize(ctx, canvas, resize);
  ctx.onTheme(draw);

  // Run on the shared ticker while the stage is on screen (the ticker itself sleeps on hidden tabs).
  let off = null;
  whileVisible(ctx, stage, () => { off = onFrame(ctx, (dt) => { time += dt; draw(); }); }, () => { off?.(); off = null; });

  return {
    update(next) { cfg = { ...next }; draw(); return true; },
    action(id) { if (id === 'replay') { time = 0; draw(); } },
  };
}
