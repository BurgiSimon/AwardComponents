// Captured preview frames: public/frames/<id>-<theme>.webp (960 px) and <id>-<theme>-sm.webp (480 px), made by
// scripts/frames.mjs. Images carry data-frame so a theme change swaps every visible frame in place.
import { href } from './dom.js';
import { currentTheme, onThemeChange } from './theme.js';
import { byId } from '../registry/index.js';

export function frameSrc(id, { size = 'md', theme = currentTheme() } = {}) {
  const c = byId.get(id);
  const t = c?.theme === 'dark' || c?.theme === 'light' ? c.theme : theme;
  return href(`frames/${id}-${t}${size === 'sm' ? '-sm' : ''}.webp`);
}

// <img> markup for a frame. Missing frames fall back to a drawn placeholder through the onerror handler in main.js.
export function frameImg(id, { size = 'md', eager = false, alt = '', sizes = '' } = {}) {
  const sm = frameSrc(id, { size: 'sm' });
  const md = frameSrc(id, { size: 'md' });
  const srcset = `${sm} 480w, ${md} 960w`;
  return `<img class="frame-img" data-frame="${id}" src="${size === 'sm' ? sm : md}" srcset="${srcset}" sizes="${sizes || (size === 'sm' ? '240px' : '(max-width: 700px) 92vw, 380px')}" alt="${alt}" width="960" height="600" decoding="async"${eager ? ' fetchpriority="high"' : ' loading="lazy"'}>`;
}

export function initFrameSwap() {
  onThemeChange(() => {
    for (const img of document.querySelectorAll('img[data-frame]')) {
      const id = img.dataset.frame;
      img.srcset = `${frameSrc(id, { size: 'sm' })} 480w, ${frameSrc(id)} 960w`;
      img.src = img.src.includes('-sm.webp') ? frameSrc(id, { size: 'sm' }) : frameSrc(id);
    }
  });
  // A frame that has not been captured yet shows a quiet placeholder instead of a broken image.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.frame || img.src.startsWith('data:')) return;
    img.removeAttribute('srcset');
    img.src = placeholder(img.dataset.frame);
  }, true);
}

export function placeholder(id) {
  const c = byId.get(id);
  const title = (c?.title || id).replace(/[<&>]/g, '');
  const dark = currentTheme() === 'dark';
  const bg = dark ? '#151516' : '#ecece7';
  const ink = dark ? '#5f5f59' : '#a3a39b';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><rect width="960" height="600" fill="${bg}"/><text x="48" y="552" font-family="sans-serif" font-size="34" font-weight="600" fill="${ink}">${title}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
