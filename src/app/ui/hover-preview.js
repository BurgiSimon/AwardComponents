// Sidebar hover preview: a floating card beside the sidebar with the component's captured frame, its category,
// summary and labels. It follows the pointer from item to item (one card that glides, not one per item), keeps
// the previous frame until the next has decoded so it never flashes empty, and preloads the neighbours.
// Fine pointers only; keyboard focus in the sidebar shows it too. Nothing here runs a demo.
import { byId } from '../../registry/index.js';
import { frameSrc, placeholder } from '../frames.js';
import { labelChips } from '../layout.js';
import { finePointer } from '../dom.js';
import { onThemeChange } from '../theme.js';

const SHOW_DELAY = 90;
const HIDE_DELAY = 140;

export function initHoverPreview(side) {
  const card = document.createElement('div');
  card.className = 'hover-card';
  card.setAttribute('aria-hidden', 'true');
  card.innerHTML = `
    <div class="hover-card__media"><img alt="" decoding="async" class="is-on"><img alt="" decoding="async"></div>
    <div class="hover-card__body">
      <p class="hover-card__cat"></p>
      <p class="hover-card__title"></p>
      <p class="hover-card__sum"></p>
      <div class="hover-card__labels"></div>
    </div>`;
  document.body.append(card);
  const imgs = [...card.querySelectorAll('img')];
  const cat = card.querySelector('.hover-card__cat');
  const title = card.querySelector('.hover-card__title');
  const sum = card.querySelector('.hover-card__sum');
  const labels = card.querySelector('.hover-card__labels');

  let showTimer = 0;
  let hideTimer = 0;
  let currentId = null;
  let visible = false;
  let front = 0;
  const preloaded = new Set();

  const preload = (id) => {
    if (!id || preloaded.has(id)) return;
    preloaded.add(id);
    const i = new Image();
    i.decoding = 'async';
    i.src = frameSrc(id);
  };

  const place = (item) => {
    const s = side.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    const h = card.offsetHeight || 300;
    const top = Math.min(Math.max(72, r.top + r.height / 2 - h * 0.32), window.innerHeight - h - 12);
    card.style.setProperty('--x', `${Math.round(s.right + 14)}px`);
    card.style.setProperty('--y', `${Math.round(top)}px`);
    card.style.setProperty('--arrow', `${Math.round(Math.min(Math.max(r.top + r.height / 2 - top, 18), h - 18))}px`);
  };

  const setFrame = (id) => {
    const src = frameSrc(id);
    const back = imgs[1 - front];
    const swap = () => {
      if (currentId !== id) return;
      back.classList.add('is-on');
      imgs[front].classList.remove('is-on');
      front = 1 - front;
    };
    back.onload = null;
    back.onerror = null;
    if (back.src.endsWith(src) && back.complete) { swap(); return; }
    back.onload = swap;
    back.onerror = () => { back.onerror = null; back.src = placeholder(id); };
    back.src = src;
  };

  const show = (item) => {
    const id = item.dataset.id;
    const c = byId.get(id);
    if (!c) return;
    clearTimeout(hideTimer);
    if (id !== currentId) {
      currentId = id;
      cat.textContent = c.categoryTitle;
      title.textContent = c.title;
      sum.textContent = c.summary;
      labels.innerHTML = labelChips(c, { max: 3 });
      setFrame(id);
      const li = item.closest('li');
      preload(li?.previousElementSibling?.querySelector('.sb-item')?.dataset.id);
      preload(li?.nextElementSibling?.querySelector('.sb-item')?.dataset.id);
    }
    place(item);
    if (!visible) {
      card.classList.add('no-glide');
      // eslint-disable-next-line no-unused-expressions
      card.offsetWidth;
      card.classList.remove('no-glide');
      visible = true;
      card.classList.add('is-on');
    }
  };

  const hide = () => {
    clearTimeout(showTimer);
    visible = false;
    card.classList.remove('is-on');
  };

  side.addEventListener('pointerover', (e) => {
    if (!finePointer()) return;
    const item = e.target.closest('.sb-item');
    if (!item) return;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (visible) show(item);
    else showTimer = setTimeout(() => show(item), SHOW_DELAY);
  });
  side.addEventListener('pointerout', (e) => {
    if (e.relatedTarget && e.relatedTarget.closest?.('.sb-item')) return;
    clearTimeout(showTimer);
    hideTimer = setTimeout(hide, HIDE_DELAY);
  });
  side.addEventListener('focusin', (e) => {
    const item = e.target.closest('.sb-item');
    if (item && item.matches(':focus-visible') && window.innerWidth > 960) show(item);
  });
  side.addEventListener('focusout', (e) => { if (!e.relatedTarget?.closest?.('.sb-item')) hide(); });
  side.querySelector('.sidebar__in')?.addEventListener('scroll', hide, { passive: true });
  side.addEventListener('click', hide);
  window.addEventListener('resize', hide);
  onThemeChange(() => { if (currentId) { const id = currentId; currentId = null; preloaded.clear(); const item = side.querySelector(`.sb-item[data-id="${id}"]`); if (visible && item) show(item); } });
}
