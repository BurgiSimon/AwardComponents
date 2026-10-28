// Lifecycle helpers so a demo cleans up after itself. The runtime re-mounts a demo in place when an option
// needs it, when the theme or motion tier changes and on Replay; anything a demo starts must stop on ctx's signal.
// Every helper takes the ctx passed to mount() and registers its own teardown.
import { ticker } from './ticker.js';

// Subscribe to the shared ticker for the life of the mount. The returned function unsubscribes early; loops that
// start and stop many times (whileVisible) share one cleanup per mount instead of piling one up per start.
const frameSets = new WeakMap();
export function onFrame(ctx, fn) {
  let set = frameSets.get(ctx);
  if (!set) {
    set = new Set();
    frameSets.set(ctx, set);
    ctx.onCleanup(() => { for (const f of set) ticker.remove(f); set.clear(); });
  }
  set.add(fn);
  ticker.add(fn);
  return () => { set.delete(fn); ticker.remove(fn); };
}

// addEventListener bound to the mount's AbortSignal.
export function on(ctx, target, type, fn, options = {}) {
  target.addEventListener(type, fn, { ...options, signal: ctx.signal });
}

// IntersectionObserver / ResizeObserver that disconnect on cleanup.
export function observeIntersection(ctx, elements, fn, options) {
  const io = new IntersectionObserver(fn, options);
  [].concat(elements).forEach((el) => el && io.observe(el));
  ctx.onCleanup(() => io.disconnect());
  return io;
}
export function observeResize(ctx, elements, fn) {
  const ro = new ResizeObserver(fn);
  [].concat(elements).forEach((el) => el && ro.observe(el));
  ctx.onCleanup(() => ro.disconnect());
  return ro;
}

// setTimeout / setInterval cleared on cleanup.
export function later(ctx, fn, ms) {
  const id = setTimeout(fn, ms);
  ctx.onCleanup(() => clearTimeout(id));
  return id;
}
export function every(ctx, fn, ms) {
  const id = setInterval(fn, ms);
  ctx.onCleanup(() => clearInterval(id));
  return id;
}

// Runs fn only while el is on screen (a demo that animates below the fold should not burn frames).
export function whileVisible(ctx, el, start, stop, options = { rootMargin: '10% 0px' }) {
  let on = false;
  observeIntersection(ctx, el, ([entry]) => {
    if (entry.isIntersecting && !on) { on = true; start(); }
    else if (!entry.isIntersecting && on) { on = false; stop(); }
  }, options);
  ctx.onCleanup(() => { if (on) stop(); });
}
