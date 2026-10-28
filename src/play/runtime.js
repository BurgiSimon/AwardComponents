// The play runtime: one page (play.html?c=<id>) that mounts one component demo. The shell shows it in an iframe;
// "Open in new tab" shows it alone. Isolation is the point: a demo may own window scroll, the cursor, the whole
// viewport or a WebGL context, and leaving the component page removes the iframe and everything with it.
//
// Demo contract (components/<id>/demo.js):
//   export default function mount(root, options, ctx) → instance | Promise<instance>
//     root     an empty <div> the demo renders into (it may also own window scroll)
//     options  resolved control values, keyed by control id
//     ctx      { id, meta, motion, theme, signal, onCleanup(fn), onTheme(fn), capture, embedded, emit(type, data) }
//   instance (all optional):
//     update(options, changedIds) → apply new values live; return false to ask for a re-mount instead
//     action(id)                  → run one of meta.actions (e.g. 'replay', 'open')
//     destroy()                   → extra teardown (prefer ctx.onCleanup / ctx.signal)
//
// Parent → frame messages: ac:options {options}, ac:theme {theme}, ac:motion {motion}, ac:replay, ac:action {id}
// Frame → parent messages: ac:ready {id}, ac:error {message}, ac:key {key, meta, ctrl, shift}
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../demo-kit/base.css';
import './play.css';
import { motionTier } from '../demo-kit/motion.js';
import { fromParams, resolve } from '../registry/options.js';

const metas = import.meta.glob('/components/*/meta.js', { import: 'default' });
const demos = import.meta.glob('/components/*/demo.js', { import: 'default' });

const params = new URLSearchParams(location.search);
const id = params.get('c') || '';
const root = document.getElementById('ac-root');
const html = document.documentElement;
const embedded = window.parent !== window;
const errors = [];

let meta = null;
let mountFn = null;
let instance = null;
let values = {};
let abort = null;
let cleanups = [];
let themeListeners = [];
let snapshot = null;
let remountTimer = 0;
let mounting = null;
let mountError = null;
let resolveReady;
const ready = new Promise((r) => (resolveReady = r));

const post = (type, data = {}) => {
  if (embedded) window.parent.postMessage({ type, id, ...data }, location.origin);
};

window.addEventListener('error', (e) => { errors.push(String(e.message || e.error)); });
window.addEventListener('unhandledrejection', (e) => { errors.push(String(e.reason?.message || e.reason)); });

// What a demo may have changed outside its root, put back on unmount: attributes and inline style on <html> and
// <body>, nodes appended to <body>, and window scroll.
function takeSnapshot() {
  const attrs = (el) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
  return { html: attrs(html), body: attrs(document.body), children: new Set(document.body.children) };
}
function restoreSnapshot(s) {
  if (!s) return;
  for (const [el, saved] of [[html, s.html], [document.body, s.body]]) {
    for (const a of [...el.attributes]) if (!(a.name in saved)) el.removeAttribute(a.name);
    for (const [k, v] of Object.entries(saved)) if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  }
  for (const child of [...document.body.children]) if (!s.children.has(child)) child.remove();
}

function currentTheme() {
  return html.dataset.theme === 'dark' ? 'dark' : 'light';
}

async function mount({ keepScroll = false } = {}) {
  const scrollY = keepScroll ? window.scrollY : 0;
  unmount();
  const tier = motionTier();
  html.dataset.motion = tier;
  snapshot = takeSnapshot();
  abort = new AbortController();
  cleanups = [];
  themeListeners = [];
  root.replaceChildren();
  root.removeAttribute('class');
  root.removeAttribute('style');
  const ctx = {
    id,
    meta,
    motion: tier,
    theme: currentTheme(),
    signal: abort.signal,
    capture: params.has('capture'),
    embedded,
    onCleanup(fn) { cleanups.push(fn); },
    onTheme(fn) { themeListeners.push(fn); },
    emit(type, data) { post(`ac:demo:${type}`, { data }); },
  };
  try {
    instance = (await mountFn(root, { ...values }, ctx)) || {};
  } catch (error) {
    console.error(error);
    mountError = error;
    showError(error);
    post('ac:error', { message: String(error?.message || error) });
    return;
  }
  mountError = null;
  if (scrollY) {
    requestAnimationFrame(() => {
      if (window.lenis) window.lenis.scrollTo(scrollY, { immediate: true, force: true });
      else window.scrollTo(0, scrollY);
    });
  }
}

function unmount() {
  if (!abort) return;
  abort.abort();
  try { instance?.destroy?.(); } catch (e) { console.error(e); }
  for (const fn of cleanups.reverse()) {
    try { fn(); } catch (e) { console.error(e); }
  }
  cleanups = [];
  themeListeners = [];
  instance = null;
  abort = null;
  root.replaceChildren();
  restoreSnapshot(snapshot);
  snapshot = null;
  window.scrollTo(0, 0);
}

function remount(opts) {
  clearTimeout(remountTimer);
  mounting = mount(opts);
  return mounting;
}

function scheduleRemount() {
  clearTimeout(remountTimer);
  remountTimer = setTimeout(() => remount({ keepScroll: true }), 140);
}

function applyOptions(next) {
  const resolved = resolve(meta, next);
  const changed = Object.keys(resolved).filter((k) => resolved[k] !== values[k]);
  if (!changed.length) return;
  values = resolved;
  if (instance?.update) {
    let result;
    try { result = instance.update({ ...values }, changed); } catch (e) { console.error(e); result = false; }
    if (result !== false) return;
  }
  scheduleRemount();
}

function setTheme(theme) {
  if (meta.theme === 'dark' || meta.theme === 'light') return;
  if (theme !== 'dark' && theme !== 'light') return;
  // Record the site's theme first: a demo may already have set the same value itself, and unmount restores this.
  if (snapshot) snapshot.html['data-theme'] = theme;
  if (theme === currentTheme()) return;
  html.dataset.theme = theme;
  if (meta.preview?.remountOnTheme) { remount({ keepScroll: true }); return; }
  for (const fn of themeListeners) {
    try { fn(theme); } catch (e) { console.error(e); }
  }
}

function setMotion(tier) {
  if (tier === 'full' || tier === 'reduced' || tier === 'static') html.dataset.motionForced = tier;
  else delete html.dataset.motionForced;
  if (snapshot) {
    if (html.dataset.motionForced) snapshot.html['data-motion-forced'] = html.dataset.motionForced;
    else delete snapshot.html['data-motion-forced'];
  }
  remount();
}

function showError(error) {
  const box = document.createElement('div');
  box.className = 'ac-error';
  const title = document.createElement('strong');
  title.textContent = 'This demo could not start.';
  const pre = document.createElement('pre');
  pre.textContent = String(error?.stack || error?.message || error);
  box.append(title, pre);
  root.replaceChildren(box);
}

function standaloneChip() {
  if (embedded || params.has('capture') || params.has('embed')) return;
  const a = document.createElement('a');
  a.className = 'ac-standalone';
  a.href = `${import.meta.env.BASE_URL}components/${encodeURIComponent(id)}${location.search.replace(/([?&])c=[^&]*&?/, '$1').replace(/[?&]$/, '')}`;
  a.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>';
  a.append(document.createTextNode(meta ? `${meta.title} · AwardComponents` : 'AwardComponents'));
  document.body.append(a);
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== window.parent) return;
  const msg = event.data;
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string' || !meta) return;
  switch (msg.type) {
    case 'ac:options': applyOptions(msg.options || {}); break;
    case 'ac:theme': setTheme(msg.theme); break;
    case 'ac:motion': setMotion(msg.motion); break;
    case 'ac:replay': remount(); break;
    case 'ac:action':
      try { instance?.action?.(msg.action); } catch (e) { console.error(e); }
      break;
    default:
  }
});

// Keyboard shortcuts the shell owns keep working while focus is inside the frame.
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    post('ac:key', { key: 'k', meta: e.metaKey, ctrl: e.ctrlKey });
  }
});

// The page-side contract for scripts/frames.mjs and scripts/smoke.mjs.
window.__ac = {
  id,
  ready,
  errors,
  get values() { return { ...values }; },
  get mounted() { return !!instance; },
  get error() { return mountError ? String(mountError.message || mountError) : null; },
  async setOptions(next) { applyOptions({ ...values, ...next }); await new Promise((r) => setTimeout(r, 220)); await mounting; },
  async remount() { await remount(); },
  action(name) { instance?.action?.(name); },
  async scrollTo(progress) {
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const y = Math.round(max * Math.min(1, Math.max(0, Number(progress) || 0)));
    if (window.lenis?.scrollTo) window.lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  },
};

async function boot() {
  const metaLoader = metas[`/components/${id}/meta.js`];
  const demoLoader = demos[`/components/${id}/demo.js`];
  if (!metaLoader || !demoLoader) {
    showError(new Error(`No component called “${id}”.`));
    post('ac:error', { message: `unknown component ${id}` });
    resolveReady(false);
    return;
  }
  [meta, mountFn] = await Promise.all([metaLoader(), demoLoader()]);
  document.title = `${meta.title} — AwardComponents preview`;
  if (meta.theme === 'dark' || meta.theme === 'light') html.dataset.theme = meta.theme;
  values = resolve(meta, fromParams(meta, params));
  await remount();
  // Fonts settle before the frame says ready, so captures and the shell's cross-fade show set type.
  await document.fonts?.ready;
  standaloneChip();
  if (mountError) { resolveReady(false); return; }
  post('ac:ready', { title: meta.title, media: [...(window.__acMedia || [])] });
  resolveReady(true);
}

boot().catch((error) => {
  console.error(error);
  showError(error);
  post('ac:error', { message: String(error?.message || error) });
  resolveReady(false);
});
