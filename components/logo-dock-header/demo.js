// Wordmark to header — Ostra's home page cut to the giant name, the header and three chapters (a title and a picture
// each). The giant name in the hero and the header logo are one link: it is laid out in the header slot (position:
// fixed) and a 2D transform draws it over a reference box in the hero. Over the first `dock` % of the hero the
// transform eases (cubic in-out) back to identity and the name docks. The nav underline eases both edges toward the
// chapter in view (1 − e^(−k·dt)) and snaps the last 0.05 px.
// Reduced/static: the link sits in the bar; an aria-hidden copy fills the hero and fades; the underline jumps.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, onFrame, observeResize, clamp, lerp, html, raw, photo, imageHTML, content } from '../../src/demo-kit/index.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const cubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const CHAPTERS = [
  { id: 'shop', label: 'Shop', title: 'The spring run', photo: 'obj-grueby-vase', alt: 'A tall vase in a matte leaf-green glaze, with raised leaves from foot to rim' },
  { id: 'process', label: 'Process', title: 'Two kilns, fired forty times a year.', photo: 'obj-celadon-vase', alt: 'A pale celadon bottle vase with a round body and a slender neck' },
  { id: 'visit', label: 'Visit', title: 'The studio shop is open on Saturdays.', photo: 'land-overcast-sea', alt: 'Surf around a low rocky islet off the coast at Os' },
];

export default function mount(root, options, ctx) {
  const { shop } = content;
  const lead = photo('obj-jian-tea-bowl', { fallbackTags: ['ceramic'] });
  const pics = CHAPTERS.map((c) => photo(c.photo));
  let cfg = { ...options };
  const full = ctx.motion === 'full';

  root.className = 'ld';
  root.innerHTML = html`
    <header class="ld__bar">
      <div class="ld__slot" aria-hidden="true"></div>
      <nav class="ld__nav" aria-label="Chapters">
        <ul role="list">${CHAPTERS.map((c) => html`<li><a href="#${c.id}" data-id="${c.id}">${c.label}</a></li>`)}</ul>
        <span class="ld__line" aria-hidden="true"></span>
      </nav>
      <a class="ld__bag" href="#shop">Bag <span class="ac-num">(0)</span></a>
    </header>
    <a class="ld__mark" href="#top" data-mark><span class="ld__word" data-word></span></a>

    <section class="ld__hero ac-wrap" aria-labelledby="ld-title" data-hero>
      <h1 class="sr-only" id="ld-title" data-title></h1>
      <div class="ld__ref" aria-hidden="true" data-ref><span class="ld__word ld__copy" data-copy></span></div>
      <figure class="ac-media ld__lead">${raw(imageHTML(lead, { sizes: '100vw', alt: 'A stoneware tea bowl in a dark streaked glaze', eager: true }))}</figure>
    </section>
    ${CHAPTERS.map((c, i) => html`
      <section class="ld__chapter ac-wrap" id="${c.id}" data-chapter="${c.id}" aria-labelledby="ld-${c.id}">
        <h2 class="ac-h1" id="ld-${c.id}">${c.title}</h2>
        <figure class="ac-media ld__pic">${raw(imageHTML(pics[i], { sizes: '100vw', alt: c.alt }))}</figure>
      </section>`)}`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const bar = root.querySelector('.ld__bar');
  const mark = root.querySelector('[data-mark]');
  const slot = root.querySelector('.ld__slot');
  const ref = root.querySelector('[data-ref]');
  const copy = root.querySelector('[data-copy]');
  const hero = root.querySelector('[data-hero]');
  const nav = root.querySelector('.ld__nav ul');
  const line = root.querySelector('.ld__line');
  const links = [...nav.querySelectorAll('a')];
  const chapters = [...root.querySelectorAll('[data-chapter]')];
  const lenis = useLenis(ctx);
  if (!full) root.classList.add('ld--still');

  // The word sets every size: the slot reserves the mark's own box (offsetWidth ignores the transform), and the
  // hero's reference box keeps the word's proportions, so a longer name scales down instead of overflowing.
  let geo = null;
  const measure = () => {
    const mw = mark.offsetWidth;
    const mh = mark.offsetHeight;
    if (!mw) return;
    slot.style.width = `${mw}px`;
    ref.style.height = `${((ref.clientWidth * mh) / mw).toFixed(2)}px`;
    const s = slot.getBoundingClientRect();
    const r = ref.getBoundingClientRect();
    geo = { sx: s.left, sy: s.top, sw: s.width, rx: r.left, ry: r.top + scrollY, rw: r.width, heroH: hero.offsetHeight };
    copy.style.setProperty('--big', (r.width / mw).toFixed(4));
    const n = nav.getBoundingClientRect();
    geo.items = links.map((a) => { const b = a.getBoundingClientRect(); return { left: b.left - n.left, width: b.width }; });
    geo.mw = mw;
    geo.mh = mh;
    geo.navLeft = n.left;
    geo.barH = bar.offsetHeight;
  };

  let lastTransform = '';
  const placeMark = () => {
    if (!geo) return;
    const y = scrollY;
    const raw_ = clamp(y / (geo.heroH * (cfg.dock / 100)), 0, 1);
    let transform = 'none';
    if (full) {
      const e = cubicInOut(raw_);
      const big = geo.rw / geo.sw;
      // At the top the mark sits on the hero's reference box and scrolls with it; at the hand-off it is in the slot.
      const tx = lerp(geo.rx - geo.sx, 0, e);
      const ty = lerp(geo.ry - y - geo.sy, 0, e);
      const sc = lerp(big, 1, e);
      transform = e >= 1 ? 'none' : `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`;
      // While the still-large name passes through the bar, the nav steps aside instead of being drawn over.
      const top = geo.sy + ty;
      const crossing = e < 1 && top < geo.barH && top + geo.mh * sc > 0 && geo.sx + tx + geo.mw * sc > geo.navLeft - 16;
      bar.classList.toggle('is-crossed', crossing);
    } else {
      copy.classList.toggle('is-gone', raw_ > 0.5);
    }
    if (transform !== lastTransform) { mark.style.transform = transform; lastTransform = transform; }
    bar.classList.toggle('is-docked', raw_ >= 1 || (!full && raw_ > 0.5));
  };

  // The underline: target = the link of the last chapter whose top is above the viewport's middle (none in the hero,
  // where it closes to nothing at the first link). Ticks only until it has landed.
  let active = '';
  let left = 0;
  let right = 0;
  let stopLine = null;
  const target = () => {
    const mid = innerHeight * 0.5;
    let id = '';
    for (const c of chapters) if (c.getBoundingClientRect().top <= mid) id = c.dataset.chapter;
    if (id !== active) {
      active = id;
      links.forEach((a) => (a.dataset.id === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }
    const i = links.findIndex((a) => a.dataset.id === id);
    const t = geo.items[Math.max(0, i)];
    return i < 0 ? { l: t.left, r: t.left } : { l: t.left, r: t.left + t.width };
  };
  const placeLine = (dt, snap = false) => {
    if (!geo) return true;
    const t = target();
    const k = snap || !full ? 1 : 1 - Math.exp(-cfg.stiffness * dt);
    const nl = lerp(left, t.l, k);
    const nr = lerp(right, t.r, k);
    const L = Math.abs(nl - t.l) < 0.05 ? t.l : nl;
    const R = Math.abs(nr - t.r) < 0.05 ? t.r : nr;
    if (L === left && R === right) return true;
    left = L;
    right = R;
    line.style.transform = `translate3d(${left.toFixed(2)}px, 0, 0)`;
    line.style.width = `${(right - left).toFixed(2)}px`;
    return false;
  };
  const wakeLine = () => {
    if (stopLine) return;
    stopLine = onFrame(ctx, (dt) => { if (placeLine(dt)) { stopLine?.(); stopLine = null; } });
  };

  const setWord = () => {
    const word = cfg.word.trim() || 'Ostra';
    root.querySelectorAll('[data-word], [data-copy]').forEach((el) => { el.textContent = word; });
    mark.setAttribute('aria-label', `${word}, back to the top`);
    root.querySelector('[data-title]').textContent = `${word}. ${shop.tagline}`;
    root.dataset.face = cfg.face;
  };
  const refresh = () => { measure(); lastTransform = ''; placeMark(); placeLine(0, true); };

  setWord();
  refresh();
  on(ctx, window, 'scroll', () => { placeMark(); wakeLine(); }, { passive: true });
  on(ctx, window, 'resize', refresh);
  observeResize(ctx, hero, refresh);
  document.fonts?.ready.then(refresh);
  if (lenis) on(ctx, mark, 'click', () => lenis.scrollTo(0));
  else on(ctx, mark, 'click', () => window.scrollTo({ top: 0 }));

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.includes('word') || changed.includes('face')) {
        setWord();
        // Fonts for the serif face may still be loading; measure now and again once they are in.
        refresh();
        document.fonts?.ready.then(refresh);
      } else placeMark();
    },
  };
}
