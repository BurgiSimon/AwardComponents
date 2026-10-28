// A small history router. Pages are functions ({ params, query, url }) → { node, title, layout, destroy? };
// the shell swaps <main> and keeps the header and the sidebar. Internal links are plain <a href> elements:
// clicks are intercepted unless modified, external, a download or target=_blank.
import { BASE, reducedMotion, debounce } from './dom.js';

let table = [];
let onRender = () => {};
let current = null;
let token = 0;
// path + search of what is on screen; setQuery keeps it current, so fragment steps are not re-renders.
let renderedKey = '';

export function strip(pathname) {
  const p = pathname.startsWith(BASE) ? `/${pathname.slice(BASE.length)}` : pathname;
  return p.replace(/\/index\.html$/, '/').replace(/\/{2,}/g, '/') || '/';
}

const keyOf = (url) => strip(url.pathname) + url.search;
const scrollToHash = (hash) => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();

export function startRouter(routes, render) {
  table = routes;
  onRender = render;
  history.scrollRestoration = 'manual';
  document.addEventListener('click', onClick);
  window.addEventListener('popstate', (e) => {
    const url = new URL(location.href);
    // A same-page #fragment link (or Back over one) changes only the hash: scroll, never re-render.
    if (keyOf(url) === renderedKey) {
      if (url.hash) scrollToHash(url.hash);
      else window.scrollTo(0, e.state?.scroll ?? 0);
      return;
    }
    go(location.href, { pop: true, scroll: e.state?.scroll ?? 0 });
  });
  // Keep the current entry's scroll position, so Back, Forward and reload return to it.
  // Debounced: Safari rate-limits replaceState.
  window.addEventListener('scroll', debounce(() => {
    history.replaceState({ ...(history.state || {}), scroll: window.scrollY }, '');
  }, 150), { passive: true });
  go(location.href, { initial: true, scroll: history.state?.scroll ?? 0 });
}

export function navigate(url, { replace = false } = {}) {
  const target = new URL(url, location.href);
  if (target.href === location.href && !target.hash) return;
  history.replaceState({ ...(history.state || {}), scroll: window.scrollY }, '');
  history[replace ? 'replaceState' : 'pushState']({ scroll: 0 }, '', target.href);
  go(target.href, {});
}

// Update the query string without a render (control values, filters). `path`, when given, is the page that
// asked: a late call from a page already left does nothing.
export function setQuery(params, { replace = true, path } = {}) {
  const url = new URL(location.href);
  if (path && strip(url.pathname) !== path) return;
  url.search = params.toString();
  history[replace ? 'replaceState' : 'pushState']({ ...(history.state || {}) }, '', url.href);
  renderedKey = keyOf(url);
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
  let result;
  try {
    result = await hit.page({ params: hit.params, query: url.searchParams, url });
  } catch (error) {
    // A chunk that no longer exists after a deploy, or a network error: load the URL for real, which fetches
    // fresh files. On the first load there is nothing to fall back to, so show the not-found page.
    console.error(error);
    if (my !== token) return;
    if (!initial) { location.assign(href); return; }
    const nf = match('/404');
    result = await nf.page({ params: [], query: url.searchParams, url });
  }
  if (my !== token) { result.destroy?.(); return; }
  const previous = current;
  current = result;
  const swap = () => {
    previous?.destroy?.();
    onRender(result, { initial, path });
    renderedKey = keyOf(new URL(location.href));
    if (url.hash) requestAnimationFrame(() => scrollToHash(url.hash));
    else if (pop || initial) window.scrollTo(0, scroll);
    else window.scrollTo(0, 0);
  };
  if (!initial && document.startViewTransition && !reducedMotion()) {
    // Name <main> only when the page is at the top: from a scrolled page its group would swoop in from far
    // above, so a scrolled page gets the plain cross-fade instead.
    document.documentElement.classList.toggle('route-swap', window.scrollY < 1);
    const vt = document.startViewTransition(swap);
    vt.ready.catch(() => {});
    vt.finished.catch(() => {}).finally(() => document.documentElement.classList.remove('route-swap'));
  } else swap();
}
