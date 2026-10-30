// Dispersion card — a banking app's metal card, alone on the stage, its face a liquid-metal stripe field in one
// fullscreen triangle of raw WebGL2 (no library). The stripe phase is a rotated ramp bent by a radial bump and 2D simplex noise; red and
// blue read the same stripe at a shifted phase, so every edge splits into colour while the flats stay neutral. Edges
// are anti-aliased from the phase (fwidth re-threshold, guarded against zero); tone mapping, gamma and dither run
// inline. The card's chip, mark, number and name are DOM on top. Full motion: the phase drifts while the card is on
// screen. Reduced and static: one still frame. No WebGL 2: a CSS brushed-metal face.
import './demo.css';
import { on, onFrame, whileVisible, observeResize, html, raw, readToken, content, webgl2Available } from '../../src/demo-kit/index.js';

// The recipe's own values; stripe count, dispersion, drift and edge softness come from the controls.
const P = { angle: 0.35, bump: 0.22, distortion: 0.12, exposure: 1.1, radius: 0.075, stillTime: 1.5, dprCap: 2, budget: 4e6 };

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); // one big triangle
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res, u_shift;
uniform float u_time, u_rep, u_angle, u_bump, u_distort, u_blur, u_exposure, u_radius;
uniform vec3 u_light, u_dark; // linear
out vec4 color;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}
float simplex(vec2 p) {
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = a.x > a.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2, c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}
vec3 aces(vec3 x) { return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  float s = min(u_res.x, u_res.y);
  vec2 uv = (frag - 0.5 * u_res) / s; // centred, short side = 1

  // The card's silhouette: a rounded box the size of the canvas, one-pixel edge.
  vec2 q = abs(frag - 0.5 * u_res) - (0.5 * u_res - 1.0) + u_radius * s;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_radius * s;
  float shape = clamp(0.5 - d, 0.0, 1.0);

  // Phase: rotated ramp + radial bump + simplex bend, drifting with time.
  float ramp = cos(u_angle) * uv.x + sin(u_angle) * uv.y;
  float bend = u_bump * exp(-dot(uv, uv) * 4.0) + u_distort * simplex(uv * 1.6 + vec2(0.0, u_time * 0.4));
  float phase = (ramp + bend) * u_rep - u_time;
  vec3 ph = phase + vec3(u_shift.x, 0.0, -u_shift.y); // per-channel phase: the dispersion

  // Triangle wave per channel, coverage re-thresholded from the phase's own screen derivative.
  // max(…, 1e-5): where g is flat fwidth is exactly 0 and the division would blow the edge open.
  vec3 g = abs(fract(ph) - 0.5) * 2.0;
  vec3 w = max(fwidth(g) * u_blur, vec3(1e-5));
  vec3 cov = clamp((g - 0.5) / w + 0.5, 0.0, 1.0);

  vec3 lin = mix(u_dark, u_light, cov) * (0.8 + 0.3 * smoothstep(-0.5, 0.5, uv.y)); // light from above
  vec3 srgb = pow(aces(lin * u_exposure), vec3(1.0 / 2.2)); // inline tone map and gamma: no render target
  float ign = fract(52.9829189 * fract(dot(frag, vec2(0.06711056, 0.00583715)))); // interleaved gradient noise
  srgb += (ign - 0.5) / 255.0;
  color = vec4(srgb * shape, shape); // premultiplied
}`;

// A token, or a mix of two, in linear light for the shader: [token, other or 'white', share of the other].
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function hexLinear(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [n >> 16, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
}
const tone = ([a, b, t = 0]) => {
  const x = hexLinear(readToken(a));
  const y = b === 'white' ? [1, 1, 1] : b ? hexLinear(readToken(b)) : x;
  return x.map((v, i) => v + (y[i] - v) * t);
};
// Finishes: the metal's dark flats and bright stripes. Graphite takes light type, steel dark.
const FINISHES = {
  graphite: { dark: ['--night', '--sky', 0.03], light: ['--night', '--sky', 0.24] },
  steel: { dark: ['--night', 'white', 0.3], light: ['--sand', 'white', 0.78] },
};

const NETWORK = '<svg viewBox="0 0 40 24" aria-hidden="true"><circle cx="14" cy="12" r="10"/><circle cx="26" cy="12" r="10"/></svg>';
const WAVES = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7a7 7 0 0 1 0 10M12 4.5a11 11 0 0 1 0 15M16 2a14 14 0 0 1 0 20"/></svg>';

export default function mount(root, options, ctx) {
  const { app, people } = content;
  const plan = app.plans.find((p) => p.name === 'Practice');
  let cfg = { ...options };
  root.className = 'dc';
  root.innerHTML = html`
    <section class="ac-stage dc__stage" aria-label="${app.name} ${plan.name} card">
      <figure class="dc__figure">
        <div class="dc__card" data-card>
          <canvas class="dc__gl" aria-hidden="true"></canvas>
          <div class="dc__face" aria-hidden="true">
            <span class="dc__mark">${app.name}</span>
            <span class="dc__tier">${plan.name}</span>
            <span class="dc__chip"></span>
            <span class="dc__waves">${raw(WAVES)}</span>
            <span class="dc__number ac-num">•••• •••• •••• 4417</span>
            <span class="dc__name">${people[0].name.toUpperCase()}<small>HALDEN ARKITEKTER</small></span>
            <span class="dc__network">${raw(NETWORK)}</span>
          </div>
        </div>
        <figcaption class="sr-only">The ${plan.name} card: metal with a drifting stripe finish, the ${app.name} mark, a chip and the cardholder’s name.</figcaption>
      </figure>
      <p class="ac-stage__note"><span>${app.name} · practice plan</span></p>
    </section>`;

  const card = root.querySelector('[data-card]');
  const canvas = card.querySelector('canvas');
  const applyFinish = () => { card.dataset.finish = cfg.finish; };
  applyFinish();

  let gl = null;
  try { gl = webgl2Available() ? canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true }) : null; } catch { gl = null; }
  if (!gl) {
    card.classList.add('dc--still');
    return { update(next) { cfg = { ...next }; applyFinish(); } };
  }

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
    console.warn('dispersion card: falling back to CSS', e);
    card.classList.add('dc--still');
    return { update(next) { cfg = { ...next }; applyFinish(); } };
  }
  gl.useProgram(prog);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const loc = (n) => gl.getUniformLocation(prog, n);
  const U = { time: loc('u_time'), res: loc('u_res'), shift: loc('u_shift'), rep: loc('u_rep'), blur: loc('u_blur'), light: loc('u_light'), dark: loc('u_dark') };
  for (const [n, v] of [['u_angle', P.angle], ['u_bump', P.bump], ['u_distort', P.distortion], ['u_exposure', P.exposure], ['u_radius', P.radius]]) gl.uniform1f(loc(n), v);
  card.classList.add('dc--gl');
  ctx.onCleanup(() => {
    gl.deleteProgram(prog);
    gl.deleteVertexArray(vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });

  const setUniforms = () => {
    const f = FINISHES[cfg.finish];
    gl.uniform3fv(U.dark, tone(f.dark));
    gl.uniform3fv(U.light, tone(f.light));
    gl.uniform2f(U.shift, cfg.shift, cfg.shift * 0.83);
    gl.uniform1f(U.rep, cfg.stripes);
    gl.uniform1f(U.blur, cfg.blur);
  };
  let time = ctx.motion === 'full' ? 0 : P.stillTime;
  const draw = () => {
    gl.uniform1f(U.time, time * cfg.speed); // seconds → phase drift
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const resize = () => {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, P.dprCap, Math.sqrt(P.budget / Math.max(1, cw * ch)));
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    draw();
  };
  setUniforms();
  resize();
  observeResize(ctx, canvas, resize);
  on(ctx, canvas, 'webglcontextlost', () => { card.classList.remove('dc--gl'); card.classList.add('dc--still'); });
  ctx.onTheme(() => { setUniforms(); draw(); });

  // Full tier: drift on the shared ticker while the card is on screen (the ticker itself sleeps on hidden tabs).
  if (ctx.motion === 'full') {
    let off = null;
    whileVisible(ctx, card, () => { off = onFrame(ctx, (dt) => { time += dt; draw(); }); }, () => { off?.(); off = null; });
  }

  return {
    update(next) {
      cfg = { ...next };
      applyFinish();
      setUniforms();
      draw();
      return true;
    },
  };
}
