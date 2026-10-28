// One clock per demo frame, plus framerate-independent damping. Same contract as the awards recipes' _shared/raf.js:
// add(fn) subscribes fn(dt, t) and returns an unsubscribe; the loop sleeps when nothing is subscribed or the tab hides.
const subscribers = new Set();
let running = false;
let last = 0;
let raf = 0;

function frame(t) {
  raf = 0;
  if (!running) return;
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
  last = t;
  for (const fn of subscribers) fn(dt, t);
  if (running && !raf && subscribers.size) raf = requestAnimationFrame(frame);
}

export const ticker = {
  add(fn) {
    subscribers.add(fn);
    ticker.resume();
    return () => ticker.remove(fn);
  },
  remove(fn) {
    subscribers.delete(fn);
    if (!subscribers.size) ticker.pause();
  },
  pause() { running = false; last = 0; cancelAnimationFrame(raf); raf = 0; },
  resume() {
    if (!running && subscribers.size && !document.hidden) { running = true; raf = requestAnimationFrame(frame); }
  },
  get size() { return subscribers.size; },
};

document.addEventListener('visibilitychange', () => (document.hidden ? ticker.pause() : ticker.resume()));

export const lerp = (a, b, t) => a + (b - a) * t;
// Exponential damping: the same feel at 60 Hz and 144 Hz. k ≈ 6–10 feels like a 0.1 lerp at 60 fps.
export const damp = (current, target, k, dt) => lerp(current, target, 1 - Math.exp(-k * dt));
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const mapRange = (v, inMin, inMax, outMin, outMax) => outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
export const smoothstep = (t) => t * t * (3 - 2 * t);
