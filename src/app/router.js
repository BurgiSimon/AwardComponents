// A small history router. Pages are functions ({ params, query, url }) → { node, title, layout, destroy? };
// the shell swaps <main> and keeps the header and the sidebar. Internal links are plain <a href> elements:
// clicks are intercepted unless modified, external, a download or target=_blank.
import { BASE, reducedMotion } from './dom.js';

let table = [];
let onRender = () => {};
let current = null;
let token = 0;

export function strip(pathname) {
  const p = pathname.startsWith(BASE) ? `/${pathname.slice(BASE.length)}` : pathname;
  return p.replace(/\/index\.html$/, '/').replace(/\/{2,}/g, '/') || '/';
}

export function startRouter(routes, render) {
  table = routes;
  onRender = render;
  history.scrollRestoration = 'manual';
  document.addEventListener('click', onClick);
  window.addEventListener('popstate', (e) => go(location.href, { pop: true, scroll: e.state?.scroll ?? 0 }));
  go(location.href, { initial: true });
}

export function navigate(url, { replace = false } = {}) {
  const target = new URL(url, location.href);
  if (target.href === location.href && !target.hash) return;
  history.replaceState({ ...(history.state || {}), scroll: window.scrollY }, '');
  history[replace ? 'replaceState' : 'pushState']({ scroll: 0 }, '', target.href);
  go(target.href, {});
}

// Update the query string without a render (control values, filters).
export function setQuery(params, { replace = true } = {}) {
  const url = new URL(location.href);
  url.search = params.toString();
  history[replace ? 'replaceState' : 'pushState']({ ...(history.state || {}) }, '', url.href);
}

function onClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.external !== undefined) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.endsWith('.html') && !url.pathname.endsWith('index.html')) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  e.preventDefault();
  navigate(url.href);
}

function match(pathname) {
  for (const [pattern, page] of table) {
    const m = pathname.match(pattern);
    if (m) return { page, params: m.slice(1) };
  }
  return null;
}

async function go(href, { initial = false, pop = false, scroll = 0 } = {}) {
  const my = ++token;
  const url = new URL(href);
  const path = strip(url.pathname);
  const hit = match(path) || match('/404');
  const result = await hit.page({ params: hit.params, query: url.searchParams, url });
  if (my !== token) { result.destroy?.(); return; }
  const previous = current;
  current = result;
  const swap = () => {
    previous?.destroy?.();
    onRender(result, { initial, path });
    if (pop) window.scrollTo(0, scroll);
    else if (url.hash) document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
    else if (!initial) window.scrollTo(0, 0);
  };
  if (!initial && document.startViewTransition && !reducedMotion()) {
    document.documentElement.classList.add('route-swap');
    const vt = document.startViewTransition(swap);
    vt.finished.finally(() => document.documentElement.classList.remove('route-swap'));
  } else swap();
}
