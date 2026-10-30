// Sound toggle — a studio site's opt-in sound switch, alone with the header links it sounds. Three states (off,
// armed, on); only "on" has ever touched an AudioContext, because the context is built inside the click. The bed is
// synthesised (two detuned sines through a swept lowpass, under band-passed noise, ambient .375), the cues are
// triangle blips (.35), and the icon is an AnalyserNode drawn into a canvas inside the button, on the ticker only
// while sound is on in the full tier. A stored yes comes back armed: the first gesture anywhere starts it. Hidden
// tabs suspend it.
import './demo.css';
import { on, ticker, readToken, finePointer, html, content } from '../../src/demo-kit/index.js';

const KEY = 'halden:sound';
const SFX = 0.35;
const NOTES = [523.25, 587.33, 659.25, 783.99]; // one pentatonic step per menu item
const BINS = [2, 3, 4, 6, 9, 13, 19]; // FFT bins (47 Hz each) from the tones up to the noise band
const ICON = 2; // the equaliser drawn at twice the header size, so it reads on its own
const store = {
  read() { try { return localStorage.getItem(KEY); } catch { return null; } },
  write(v) { try { localStorage.setItem(KEY, v); } catch { /* the toggle still works, it just forgets */ } },
};

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  root.className = 'sn';
  root.innerHTML = html`
    <section class="ac-stage sn__stage" aria-label="${studio.name} site header">
      <button class="sn__toggle" type="button" aria-pressed="false" data-sound>
        <canvas class="sn__meter" aria-hidden="true" data-meter></canvas>
        <span data-label>Sound off</span>
      </button>
      <nav class="sn__links" aria-label="Studio">${studio.nav.map((n, i) => html`<a href="#top" data-note="${i}">${n}</a>`)}</nav>
      <p class="ac-stage__note"><span>${studio.name} · site header</span></p>
    </section>`;
  root.querySelectorAll('a[href="#top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const $ = (s) => root.querySelector(s);
  const button = $('[data-sound]');
  const label = $('[data-label]');
  const meter = $('[data-meter]');
  const g = meter.getContext('2d');

  // 1. The graph, built on the first press only.
  let audio = null;
  let master = null;
  let bed = null;
  let analyser = null;
  let bins = null;
  const state = { sound: store.read() === 'on' ? 'armed' : 'off' };
  const build = () => {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    analyser = ac.createAnalyser();
    analyser.fftSize = 1024; // long enough for the wave view to hold two cycles of the 110 Hz tone
    analyser.smoothingTimeConstant = 0.75;
    bins = new Uint8Array(analyser.fftSize);
    master.connect(analyser).connect(ac.destination);
    bed = ac.createGain();
    bed.gain.value = cfg.volume;
    bed.connect(master);
    const lowpass = ac.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 420;
    lowpass.Q.value = 6;
    lowpass.connect(bed);
    for (const [hz, cents] of [[110, -6], [165, 5]]) {
      const osc = ac.createOscillator();
      osc.frequency.value = hz;
      osc.detune.value = cents;
      const level = ac.createGain();
      level.gain.value = 0.5;
      osc.connect(level).connect(lowpass);
      osc.start();
    }
    const noise = ac.createBufferSource();
    const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    noise.buffer = buffer;
    noise.loop = true;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.8;
    const air = ac.createGain();
    air.gain.value = 0.08;
    noise.connect(band).connect(air).connect(bed);
    noise.start();
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = ac.createGain();
    depth.gain.value = 180;
    lfo.connect(depth).connect(lowpass.frequency);
    lfo.start();
    return ac;
  };
  const blip = (hz, len = 0.12, level = SFX) => {
    if (!audio || audio.state !== 'running') return;
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    env.gain.setValueAtTime(level, audio.currentTime);
    env.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + len);
    osc.connect(env).connect(master);
    osc.start();
    osc.stop(audio.currentTime + len + 0.02);
  };
  ctx.onCleanup(() => { audio?.close().catch(() => {}); audio = null; });

  // 2. The icon: bars from frequency data, or a line from the waveform. Static poses when off or not animating.
  let looping = false;
  const paint = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cfg.style === 'wave' ? 30 : 4 + cfg.bars * 5;
    const h = 22;
    const k = dpr * ICON;
    if (meter.width !== Math.round(w * k) || meter.height !== Math.round(h * k)) {
      meter.width = Math.round(w * k); meter.height = Math.round(h * k);
      meter.style.width = `${w * ICON}px`; meter.style.height = `${h * ICON}px`;
    }
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, w, h);
    const live = state.sound === 'on' && audio?.state === 'running';
    const moving = live && ctx.motion === 'full';
    g.fillStyle = g.strokeStyle = live ? readToken('--accent') : readToken('--ink');
    g.globalAlpha = live ? 1 : 0.4;
    if (cfg.style === 'wave') {
      if (moving) analyser.getByteTimeDomainData(bins);
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i <= 24; i++) {
        const v = moving ? (bins[Math.round((i / 24) * (bins.length - 1))] - 128) / 128 : Math.sin(i / 2.4) * (live ? 0.45 : 0.12);
        const x = 3 + (i / 24) * (w - 6);
        const y = h / 2 - v * (h / 2 - 3) * 1.6;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    } else {
      if (moving) analyser.getByteFrequencyData(bins);
      const pose = [0.5, 0.85, 0.35, 0.7, 0.45, 0.9, 0.3];
      const rest = [0.22, 0.34, 0.18, 0.3, 0.2, 0.36, 0.16];
      for (let i = 0; i < cfg.bars; i++) {
        const bin = BINS[Math.round((i * (BINS.length - 1)) / Math.max(1, cfg.bars - 1))];
        const level = moving ? Math.min(1, (bins[bin] / 255) * (0.9 + i * 0.1)) : live ? pose[i] : rest[i];
        const bh = Math.max(2, Math.round(level * (h - 4)));
        g.beginPath();
        g.roundRect(2 + i * 5, h - 2 - bh, 3, bh, 1.5);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  };
  const reflect = () => {
    button.setAttribute('aria-pressed', String(state.sound !== 'off'));
    label.textContent = state.sound === 'on' ? 'Sound on' : state.sound === 'armed' ? 'Sound on · press anywhere' : 'Sound off';
    const want = state.sound === 'on' && ctx.motion === 'full';
    if (want && !looping) { looping = true; ticker.add(paint); }
    if (!want && looping) { looping = false; ticker.remove(paint); }
    paint();
  };
  ctx.onCleanup(() => { if (looping) ticker.remove(paint); });

  // 3. The states. Suspended, not closed, when off: turning it back on costs no rebuild.
  const turnOn = async () => {
    if (!audio) audio = build();
    await audio.resume().catch(() => {});
    if (ctx.signal.aborted) return;
    state.sound = 'on';
    store.write('on');
    blip(660);
    reflect();
  };
  const turnOff = () => {
    state.sound = 'off';
    store.write('off');
    if (audio) {
      blip(330);
      setTimeout(() => { if (state.sound === 'off' && audio) audio.suspend().then(paint).catch(() => {}); }, 160);
    }
    reflect();
  };
  const toggle = () => (state.sound === 'on' ? turnOff() : turnOn());
  on(ctx, button, 'click', toggle);

  // A remembered yes waits for a gesture: the first press or key anywhere (except on the switch itself) starts it.
  const armed = (e) => {
    if (state.sound !== 'armed' || button.contains(e.target)) return;
    turnOn();
  };
  on(ctx, window, 'pointerdown', armed, { capture: true });
  on(ctx, window, 'keydown', armed, { capture: true });
  on(ctx, document, 'visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) audio.suspend().then(paint).catch(() => {});
    else if (state.sound === 'on') audio.resume().then(paint).catch(() => {});
  });

  // 4. Interface cues on the menu, only while sound is on: hover with a fine pointer, and press.
  let lastCue = 0;
  const cue = (i, level) => {
    if (!cfg.cues || state.sound !== 'on') return;
    const now = performance.now();
    if (now - lastCue < 70) return;
    lastCue = now;
    blip(NOTES[i % NOTES.length], 0.09, level);
  };
  root.querySelectorAll('[data-note]').forEach((a) => {
    const i = Number(a.dataset.note);
    if (finePointer()) on(ctx, a, 'pointerenter', () => cue(i, SFX * 0.55));
    on(ctx, a, 'pointerdown', () => cue(i, SFX));
  });

  ctx.onTheme(paint);
  reflect();

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('volume') && bed && audio) bed.gain.setTargetAtTime(cfg.volume, audio.currentTime, 0.08);
      paint();
    },
    action(id) {
      if (id === 'toggle') toggle();
    },
  };
}
