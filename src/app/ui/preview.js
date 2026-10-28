// The live preview: a toolbar and one iframe running play.html?c=<id>. The captured frame sits under the iframe
// until the demo says ready, so the stage is never blank. Controls talk to the frame by postMessage; nothing is
// reloaded on a tweak. Leaving the page removes the iframe, which ends the demo and frees its WebGL context.
import { html, raw, href, reducedMotion } from '../dom.js';
import { icon } from '../icons.js';
import { frameSrc } from '../frames.js';
import { currentTheme, onThemeChange } from '../theme.js';
import { toParams } from '../../registry/options.js';
import { prefs } from '../prefs.js';

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', icon: 'desktop', width: 0 },
  { id: 'tablet', label: 'Tablet, 834 px', icon: 'tablet', width: 834 },
  { id: 'phone', label: 'Phone, 390 px', icon: 'phone', width: 390 },
];

export function playUrl(c, values, { embed = true, theme = currentTheme(), motion = '' } = {}) {
  const p = toParams(c, values);
  p.set('c', c.id);
  if (embed) p.set('embed', '1');
  if (!(c.theme === 'dark' || c.theme === 'light')) p.set('theme', theme);
  if (motion) p.set('motion', motion);
  // c first reads better in a shared link.
  const rest = [...p.entries()].filter(([k]) => k !== 'c');
  const q = new URLSearchParams([['c', c.id], ...rest]);
  return `${href('play.html')}?${q.toString()}`;
}

export function createPreview(c, getValues, { height, compact = false, onReady, onMessage } = {}) {
  let motion = '';
  let loadedMotion = '';
  // The motion button flips away from what the visitor's system asks for: reduced by default, full for those
  // whose system already reduces motion (else the button would do nothing for them).
  const osReduced = reducedMotion();
  const motionLabel = osReduced ? 'Preview with full motion' : 'Preview with reduced motion';
  const fullscreenOk = !compact && document.fullscreenEnabled;
  let viewport = prefs.get('viewport', 'desktop');
  if (compact) viewport = 'desktop';
  const h = height || c.preview.height || 600;
  const actions = c.actions || [];

  const root = document.createElement('div');
  root.className = `preview${compact ? ' preview--compact' : ''}`;
  root.style.setProperty('--stage-h', `${h}px`);
  root.innerHTML = html`
    <div class="preview__bar">
      ${compact ? '' : raw(html`
      <div class="seg seg--icons" role="radiogroup" aria-label="Viewport">
        ${VIEWPORTS.map((v) => raw(html`<button type="button" role="radio" aria-checked="${v.id === viewport}" tabindex="${v.id === viewport ? 0 : -1}" data-viewport="${v.id}" title="${v.label}" aria-label="${v.label}">${raw(icon(v.icon, { size: 16 }))}</button>`))}
      </div>`)}
      ${c.preview.scroll ? raw(`<span class="preview__hint">${icon('scrollHint', { size: 14 })}Scroll inside the preview</span>`) : ''}
      ${c.preview.hint ? raw(html`<span class="preview__hint">${raw(icon('hand', { size: 14 }))}${c.preview.hint}</span>`) : ''}
      <span class="preview__spacer"></span>
      ${actions.map((a) => raw(html`<button class="chip-btn" type="button" data-action="${a.id}">${raw(icon(a.icon || 'play', { size: 13 }))}<span>${a.label}</span></button>`))}
      <button class="icon-btn icon-btn--sm" type="button" data-motion aria-pressed="false" title="${motionLabel}" aria-label="${motionLabel}">${raw(icon('motion', { size: 16 }))}</button>
      <button class="icon-btn icon-btn--sm" type="button" data-replay title="Restart the demo" aria-label="Restart the demo">${raw(icon('refresh', { size: 16 }))}</button>
      ${compact ? '' : raw(html`
      <a class="icon-btn icon-btn--sm" href="${playUrl(c, getValues(), { embed: false })}" data-open target="_blank" rel="noopener" title="Open in a new tab" aria-label="Open the demo in a new tab" data-external>${raw(icon('arrowUpRight', { size: 16 }))}</a>
      ${fullscreenOk ? raw(html`<button class="icon-btn icon-btn--sm" type="button" data-full title="Fullscreen" aria-label="Show the preview fullscreen">${raw(icon('maximize', { size: 16 }))}</button>`) : ''}`)}
    </div>
    <div class="preview__stage" data-viewport="${viewport}">
      <div class="preview__device">
        <img class="preview__poster" src="${frameSrc(c.id)}" alt="" data-frame="${c.id}" decoding="async"${compact ? raw(' loading="lazy"') : ''}>
        <div class="preview__loading" aria-hidden="true"><span></span></div>
        <iframe title="${c.title} — live demo" loading="eager" allow="fullscreen; clipboard-write; autoplay"></iframe>
      </div>
    </div>`;

  const iframe = root.querySelector('iframe');
  const stage = root.querySelector('.preview__stage');
  const device = root.querySelector('.preview__device');
  const openLink = root.querySelector('[data-open]');
  let ready = false;
  let readyTimer = 0;
  let readyCallback = onReady;

  const post = (type, data = {}) => iframe.contentWindow?.postMessage({ type, ...data }, location.origin);

  const markReady = () => {
    ready = true;
    clearTimeout(readyTimer);
    root.classList.add('is-ready');
  };

  const load = () => {
    ready = false;
    root.classList.remove('is-ready');
    loadedMotion = motion;
    iframe.src = playUrl(c, getValues(), { motion });
    clearTimeout(readyTimer);
    readyTimer = setTimeout(markReady, 8000);
  };

  const onMsg = (e) => {
    if (e.origin !== location.origin || e.source !== iframe.contentWindow) return;
    const msg = e.data || {};
    if (msg.type === 'ac:ready') {
      // Anything sent while the frame was still loading was lost: send the current state once more. The runtime
      // ignores values that did not change.
      post('ac:options', { options: getValues() });
      post('ac:theme', { theme: currentTheme() });
      if (motion !== loadedMotion) post('ac:motion', { motion: motion || 'auto' });
      markReady();
      readyCallback?.(msg);
    }
    if (msg.type === 'ac:error') markReady();
    onMessage?.(msg);
  };
  window.addEventListener('message', onMsg);

  // Tablet and phone render at their true width (the demo's media queries see 834 or 390 px) and scale down to
  // fit when the stage is narrower; the scale shows in the button's title.
  const fit = () => {
    const v = VIEWPORTS.find((x) => x.id === viewport);
    const w = v?.width || 0;
    const room = stage.clientWidth;
    const s = w && room && w > room ? room / w : 1;
    device.style.width = w ? `${w}px` : '100%';
    device.style.transform = s < 1 ? `scale(${s.toFixed(4)})` : '';
    device.style.height = s < 1 ? `${100 / s}%` : '';
    const b = root.querySelector(`button[data-viewport="${viewport}"]`);
    if (b && v) b.title = s < 1 ? `${v.label} · ${Math.round(s * 100)} %` : v.label;
  };
  const setViewport = (id) => {
    viewport = id;
    stage.dataset.viewport = id;
    root.querySelectorAll('button[data-viewport]').forEach((b) => {
      const on = b.dataset.viewport === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    fit();
  };
  setViewport(viewport);
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  // Radio-group keys: arrows move and select, as the role promises.
  root.querySelector('.seg--icons')?.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = VIEWPORTS.findIndex((v) => v.id === viewport);
    const next = VIEWPORTS[(i + d + VIEWPORTS.length) % VIEWPORTS.length].id;
    setViewport(next);
    prefs.set('viewport', next);
    root.querySelector(`button[data-viewport="${next}"]`).focus();
  });

  root.addEventListener('click', (e) => {
    const vp = e.target.closest('button[data-viewport]');
    if (vp) { setViewport(vp.dataset.viewport); prefs.set('viewport', vp.dataset.viewport); return; }
    const act = e.target.closest('[data-action]');
    if (act) { post('ac:action', { action: act.dataset.action }); return; }
    if (e.target.closest('[data-replay]')) { post('ac:replay'); return; }
    const mo = e.target.closest('[data-motion]');
    if (mo) {
      motion = motion ? '' : osReduced ? 'full' : 'reduced';
      mo.setAttribute('aria-pressed', String(!!motion));
      post('ac:motion', { motion: motion || 'auto' });
      return;
    }
    if (e.target.closest('[data-full]')) {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen?.().catch(() => {});
    }
  });
  root.addEventListener('pointerenter', () => { if (openLink) openLink.href = playUrl(c, getValues(), { embed: false, motion }); });
  openLink?.addEventListener('focus', () => { openLink.href = playUrl(c, getValues(), { embed: false, motion }); });
  document.addEventListener('fullscreenchange', onFull);
  function onFull() {
    const full = document.fullscreenElement === root;
    root.classList.toggle('is-full', full);
    const b = root.querySelector('[data-full]');
    if (b) b.innerHTML = icon(full ? 'minimize' : 'maximize', { size: 16 });
  }

  const offTheme = onThemeChange((theme) => post('ac:theme', { theme }));

  // Lazy start: the iframe loads when the stage nears the viewport (the welcome page has one below the fold).
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { io.disconnect(); load(); }
  }, { rootMargin: '200px 0px' });
  io.observe(root);

  return {
    el: root,
    iframe,
    get ready() { return ready; },
    setValues(values) { post('ac:options', { options: values }); },
    action(id) { post('ac:action', { action: id }); },
    replay() { post('ac:replay'); },
    onReady(fn) { readyCallback = fn; },
    destroy() {
      io.disconnect();
      ro.disconnect();
      clearTimeout(readyTimer);
      window.removeEventListener('message', onMsg);
      document.removeEventListener('fullscreenchange', onFull);
      offTheme();
      iframe.src = 'about:blank';
      iframe.remove();
    },
  };
}
