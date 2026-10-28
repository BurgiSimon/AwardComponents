// Wordmark to header — Ostra's home page. The giant name in the hero and the header logo are one link: it is laid
// out in the header slot (position: fixed) and a 2D transform draws it over a reference box in the hero. Over the
// first `dock` % of the hero the transform eases (cubic in-out) back to identity and the name docks. The nav
// underline eases both edges toward the chapter in view (1 − e^(−k·dt)) and snaps the last 0.05 px.
// Reduced/static: the link sits in the bar; an aria-hidden copy fills the hero and fades; the underline jumps.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, onFrame, observeResize, clamp, lerp, html, raw, photos, imageHTML, content, formatPrice } from '../../src/demo-kit/index.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const cubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const CHAPTERS = [
  { id: 'shop', label: 'Shop' },
  { id: 'process', label: 'Process' },
  { id: 'visit', label: 'Visit' },
];

export default function mount(root, options, ctx) {
  const { shop } = content;
  const lead = photos({ tags: ['ceramic'], count: 1, seed: 'ld-lead' })[0];
  const items = photos({ tags: ['object'], count: 4, seed: 'ld-shop' });
  const kiln = photos({ tags: ['interior'], count: 1, seed: 'ld-kiln' })[0];
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
      <div class="ld__ref" aria-hidden="true" data-ref><span class="ld__word ld__copy" data-copy></span></div>
      <div class="ld__intro">
        <figure class="ac-media ld__lead">${raw(imageHTML(lead, { sizes: '(max-width: 720px) 100vw, 60vw', alt: 'A stoneware vase in an oat glaze', eager: true }))}</figure>
        <div class="ld__say">
          <h1 class="ac-h2" id="ld-title">${shop.tagline} Stoneware and porcelain from a two-kiln studio on Os, south of Bergen.</h1>
          <p class="ld__cta"><a class="ac-btn" href="#shop">Shop the spring run</a><span class="ac-small">Free shipping from ${formatPrice(shop.freeShippingFrom)}</span></p>
        </div>
      </div>
    </section>

    <section class="ld__chapter ac-wrap" id="shop" data-chapter="shop" aria-labelledby="ld-shop">
      <div class="ld__head"><p class="ac-label">01 · Shop</p><h2 class="ac-h1" id="ld-shop">The spring run</h2></div>
      <ul class="ld__grid" role="list">
        ${shop.products.slice(0, 4).map((p, i) => html`<li><a class="ld__product" href="#shop"><span class="ac-media">${raw(imageHTML(items[i], { sizes: '25vw', alt: '' }))}</span><span class="ld__pname"><strong>${p.name}</strong><span class="ac-num">${formatPrice(p.price)}</span></span><span class="ac-small">${p.colour}</span></a></li>`)}
      </ul>
    </section>
    <section class="ld__chapter ac-wrap ld__split" id="process" data-chapter="process" aria-labelledby="ld-process">
      <div class="ld__head">
        <p class="ac-label">02 · Process</p>
        <h2 class="ac-h1" id="ld-process">Two kilns, fired forty times a year.</h2>
        <p class="ac-lede">Every piece is thrown by hand, dried for a week and fired twice: once to bisque, once to 1,280 °C in reduction. Glazes are mixed in the studio from ash, iron and local clay.</p>
      </div>
      <figure class="ac-media ld__kiln">${raw(imageHTML(kiln, { sizes: '45vw', alt: 'The glazing room' }))}</figure>
    </section>
    <section class="ld__chapter ac-wrap" id="visit" data-chapter="visit" aria-labelledby="ld-visit">
      <div class="ld__head"><p class="ac-label">03 · Visit</p><h2 class="ac-h1" id="ld-visit">The studio shop is open on Saturdays.</h2></div>
      <dl class="ld__facts">
        <div><dt class="ac-label">Where</dt><dd>Hatvikvegen 12, 5200 Os</dd></div>
        <div><dt class="ac-label">When</dt><dd>Saturdays 11–16, and by appointment</dd></div>
        <div><dt class="ac-label">Write</dt><dd><a class="ac-link" href="#visit">studio@ostra.no</a></dd></div>
      </dl>
    </section>
    <footer class="ld__foot ac-wrap"><span class="ac-small">${shop.name} · Os, Norway</span></footer>`;
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
