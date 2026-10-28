// The persistent shell: top bar, sidebar (library routes), main column and footer.
import { html, raw, el, $, $$, href, BASE } from './dom.js';
import { icon, mark } from './icons.js';
import { groups, components } from '../registry/index.js';
import { labelKinds } from '../registry/labels.js';
import { site } from '../registry/site.js';
import { prefs } from './prefs.js';
import { toggleTheme, currentTheme, onThemeChange } from './theme.js';
import { initHoverPreview } from './ui/hover-preview.js';
import { openPalette } from './ui/palette.js';

export function labelChips(c, { max = 3, only } = {}) {
  const kinds = (only ? c.labels.filter((k) => only.includes(k)) : c.labels).slice(0, max);
  return kinds.map((k) => `<span class="label label--${labelKinds[k].tone}" title="${labelKinds[k].title}">${labelKinds[k].text}</span>`).join('');
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function topbar() {
  return html`
  <header class="topbar">
    <div class="topbar__in">
      <button class="icon-btn topbar__menu" type="button" aria-label="Open the component list" aria-controls="sidebar" aria-expanded="false" data-menu>${raw(icon('menu', { size: 18 }))}</button>
      <a class="brand" href="${href('/')}" aria-label="${site.name} home">${raw(mark(22))}<span class="brand__word">Award<b>Components</b></span></a>
      <nav class="topnav" aria-label="Primary">
        <a href="${href('/components/')}" data-nav="components">Components</a>
        <a href="${href('/docs/')}" data-nav="docs">Docs</a>
        <a href="${href('/changelog/')}" data-nav="changelog">Changelog</a>
      </nav>
      <div class="topbar__end">
        <button class="search-trigger" type="button" data-palette aria-haspopup="dialog">
          ${raw(icon('search', { size: 15 }))}<span class="search-trigger__text">Search ${components.length} component${components.length === 1 ? '' : 's'}</span><kbd class="kbd">${isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <button class="icon-btn" type="button" data-palette aria-label="Search components" data-mobile-only>${raw(icon('search', { size: 18 }))}</button>
        <button class="icon-btn" type="button" data-theme-toggle aria-label="Switch to dark theme">${raw(icon('moon', { size: 18 }))}</button>
        <a class="icon-btn" href="${site.repo}" target="_blank" rel="noopener" aria-label="Source on GitHub" data-external>${raw(icon('github', { size: 18 }))}</a>
      </div>
    </div>
  </header>`;
}

function sidebar() {
  const collapsed = new Set(prefs.get('collapsed', []));
  const group = (g) => html`
    <section class="sb-group" data-group="${g.id}" ${collapsed.has(g.id) ? raw('data-collapsed') : ''}>
      <button class="sb-group__head" type="button" aria-expanded="${collapsed.has(g.id) ? 'false' : 'true'}" aria-controls="sbg-${g.id}">
        ${raw(icon(g.icon, { size: 15 }))}<span>${g.title}</span><span class="sb-count">${g.items.length}</span>${raw(icon('chevronDown', { size: 14, className: 'sb-chev' }))}
      </button>
      <ul class="sb-list" id="sbg-${g.id}" role="list">
        ${g.items.map((c) => raw(html`<li><a class="sb-item" href="${href(`/components/${c.id}/`)}" data-id="${c.id}"><span class="sb-item__t">${c.title}</span>${raw(c.labels.includes('new') ? '<span class="sb-new" title="New">New</span>' : '')}${raw(c.tech.includes('webgl') ? `<span class="sb-tech" title="WebGL">GL</span>` : '')}</a></li>`))}
      </ul>
    </section>`;
  return html`
  <aside class="sidebar" id="sidebar" aria-label="Components">
    <div class="sidebar__in">
      <div class="sb-filter">
        ${raw(icon('filter', { size: 15 }))}
        <input type="search" placeholder="Filter components" aria-label="Filter components" autocomplete="off" spellcheck="false" data-sb-filter>
        <kbd class="kbd" aria-hidden="true">/</kbd>
      </div>
      <nav class="sb-nav" aria-label="All components">
        <a class="sb-top" href="${href('/components/')}" data-nav="components-index">${raw(icon('grid', { size: 15 }))}<span>All components</span><span class="sb-count">${components.length}</span></a>
        ${groups.map((g) => raw(group(g)))}
        <p class="sb-empty" hidden>No component matches.</p>
      </nav>
    </div>
  </aside>
  <div class="sidebar-scrim" data-menu-close hidden></div>`;
}

function footer() {
  return html`
  <footer class="site-footer">
    <div class="site-footer__in">
      <div class="site-footer__brand">
        <a class="brand" href="${href('/')}">${raw(mark(20))}<span class="brand__word">Award<b>Components</b></span></a>
        <p>Every component is rebuilt from a verified recipe in the <a href="${site.awards.repo}" target="_blank" rel="noopener" data-external>awards plugin</a> and ships with a prompt that adapts it to your project.</p>
      </div>
      <nav class="site-footer__nav" aria-label="Footer">
        <div><h2>Library</h2><a href="${href('/components/')}">All components</a><a href="${href('/changelog/')}">Changelog</a><a href="${href('/docs/')}">Getting started</a></div>
        <div><h2>Source</h2><a href="${site.repo}" target="_blank" rel="noopener" data-external>GitHub</a><a href="${site.awards.repo}" target="_blank" rel="noopener" data-external>awards plugin</a><a href="${site.repo}/blob/main/CREDITS.md" target="_blank" rel="noopener" data-external>Picture credits</a></div>
      </nav>
      <p class="site-footer__fine">MIT licence. Pictures are public domain or CC0 and credited on each component page. Not affiliated with any award programme.</p>
    </div>
  </footer>`;
}

export function mountShell(root) {
  root.innerHTML = `${topbar()}<div class="shell" data-layout="wide">${sidebar()}<div class="main-col"><main id="main" class="main" tabindex="-1"></main>${footer()}</div></div>`;
  const shell = $('.shell', root);
  const side = $('#sidebar', root);
  const main = $('#main', root);

  // Theme toggle label and icon follow the theme.
  const themeBtn = $('[data-theme-toggle]', root);
  const syncThemeBtn = () => {
    const dark = currentTheme() === 'dark';
    themeBtn.innerHTML = icon(dark ? 'sun' : 'moon', { size: 18 });
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };
  syncThemeBtn();
  onThemeChange(syncThemeBtn);
  themeBtn.addEventListener('click', toggleTheme);

  $$('[data-palette]', root).forEach((b) => b.addEventListener('click', () => openPalette()));

  // Sidebar groups collapse, and remember it.
  side.addEventListener('click', (e) => {
    const head = e.target.closest('.sb-group__head');
    if (!head) return;
    const g = head.closest('.sb-group');
    const now = !g.hasAttribute('data-collapsed');
    g.toggleAttribute('data-collapsed', now);
    head.setAttribute('aria-expanded', String(!now));
    prefs.set('collapsed', $$('.sb-group[data-collapsed]', side).map((x) => x.dataset.group));
  });

  // Filter: hides items and empty groups; Enter opens the first match; Escape clears.
  const filter = $('[data-sb-filter]', side);
  filter.addEventListener('input', () => applyFilter(side, filter.value));
  filter.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { filter.value = ''; applyFilter(side, ''); filter.blur(); }
    if (e.key === 'Enter') { const first = $('.sb-item:not([hidden])', side); first?.click(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); $('.sb-item:not([hidden])', side)?.focus(); }
  });

  // Phone: the sidebar is a drawer.
  const menuBtn = $('[data-menu]', root);
  const scrim = $('[data-menu-close]', root);
  const setDrawer = (open) => {
    shell.toggleAttribute('data-drawer', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    scrim.hidden = !open;
    if (open) { side.removeAttribute('inert'); filter.focus({ preventScroll: true }); }
  };
  menuBtn.addEventListener('click', () => setDrawer(!shell.hasAttribute('data-drawer')));
  scrim.addEventListener('click', () => setDrawer(false));
  side.addEventListener('click', (e) => { if (e.target.closest('a.sb-item, a.sb-top')) setDrawer(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && shell.hasAttribute('data-drawer')) { setDrawer(false); menuBtn.focus(); } });

  // Global keys: ⌘K / Ctrl+K opens the palette; "/" focuses the sidebar filter (or the palette on wide pages).
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (shell.dataset.layout === 'library' && side.offsetParent) filter.focus();
      else openPalette();
    }
  });
  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data?.type === 'ac:key' && e.data.key === 'k') openPalette();
  });

  initHoverPreview(side);

  return {
    main,
    render(result, { path }) {
      shell.dataset.layout = result.layout || 'wide';
      document.title = result.title;
      main.replaceChildren(result.node);
      // Active states.
      $$('[data-nav]', root).forEach((a) => a.removeAttribute('aria-current'));
      const section = path.startsWith('/components') ? 'components' : path.startsWith('/docs') ? 'docs' : path.startsWith('/changelog') ? 'changelog' : '';
      if (section) $(`.topnav [data-nav="${section}"]`, root)?.setAttribute('aria-current', 'page');
      $$('.sb-item[aria-current]', side).forEach((a) => a.removeAttribute('aria-current'));
      if (/^\/components\/?$/.test(path)) $('[data-nav="components-index"]', side)?.setAttribute('aria-current', 'page');
      if (result.componentId) {
        const item = $(`.sb-item[data-id="${result.componentId}"]`, side);
        if (item) {
          item.setAttribute('aria-current', 'page');
          const g = item.closest('.sb-group');
          if (g?.hasAttribute('data-collapsed')) { g.removeAttribute('data-collapsed'); $('.sb-group__head', g).setAttribute('aria-expanded', 'true'); }
          revealInSidebar(item);
        }
      }
      setDrawer(false);
      result.mounted?.();
    },
  };
}

function revealInSidebar(item) {
  const box = item.closest('.sidebar__in');
  if (!box || !box.clientHeight) return;
  const r = item.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (r.top < b.top + 60 || r.bottom > b.bottom - 20) box.scrollTop += r.top - b.top - b.height / 3;
}

function applyFilter(side, value) {
  const q = value.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  let any = false;
  for (const g of $$('.sb-group', side)) {
    let shown = 0;
    for (const a of $$('.sb-item', g)) {
      const c = components.find((x) => x.id === a.dataset.id);
      const hit = !terms.length || terms.every((t) => c.search.includes(t));
      a.parentElement.hidden = !hit;
      a.hidden = !hit;
      if (hit) shown++;
    }
    g.hidden = shown === 0;
    g.toggleAttribute('data-filtering', !!terms.length);
    any ||= shown > 0;
  }
  $('.sb-empty', side).hidden = any;
}

export { BASE };
