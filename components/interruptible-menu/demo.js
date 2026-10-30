// Interruptible mega menu — Ostra's shop header, alone with its mega menu. Open and close are one paused GSAP
// timeline: the open half, then addPause() at its end (the hinge I), then the close half. Close = tl.time() < I ?
// tl.reverse() : tl.play(), so a close mid-open rewinds from where it is and a close after the hinge plays the
// authored exit. Reopening inside the close half reverses back to the hinge. Reduced: the same hinge, opacity only.
// Static: pause(I) / pause(0).
import './demo.css';
import { on, html, raw, photos, imageHTML, content, formatPrice } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const COLUMNS = [
  { title: 'Ceramics', links: [['Vases', 14], ['Bowls', 22], ['Cups and mugs', 31], ['Plates and dishes', 18], ['Seconds', 9]] },
  { title: 'Home', links: [['Lamps', 4], ['Throws', 6], ['Candle holders', 7], ['Table linen', 12]] },
  { title: 'Collections', links: [['The spring run'], ['Iron glaze'], ['Celadon'], ['Gift cards']] },
];
const CHEVRON = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>';

export default function mount(root, options, ctx) {
  const { shop } = content;
  const vase = shop.products[0];
  const [featured] = photos({ tags: ['ceramic'], count: 1, seed: 'im-feat' });
  let cfg = { ...options };

  root.className = 'im';
  root.innerHTML = html`
    <section class="ac-stage im__stage" aria-label="${shop.name} shop header">
      <header class="im__bar">
        <div class="im__barin ac-wrap">
          <a class="ac-brand im__brand" href="#top">${shop.name}</a>
          <nav class="im__nav" aria-label="Main">
            <button type="button" class="im__shop" aria-expanded="false" aria-controls="im-panel">Shop<span class="im__chev">${raw(CHEVRON)}</span></button>
          </nav>
          <a href="#top" class="im__bag">Bag <span class="ac-num">(2)</span></a>
        </div>
        <div class="im__panel" id="im-panel" data-panel>
          <div class="im__panelin ac-wrap">
            ${COLUMNS.map((col, c) => html`
              <div class="im__col" data-col="${c}">
                <p class="im__mask"><span class="ac-label" data-item>${col.title}</span></p>
                <ul role="list">${col.links.map(([name, n]) => html`<li class="im__mask"><a href="#top" data-item><span>${name}</span>${n ? html`<span class="im__n ac-num">${n}</span>` : ''}</a></li>`)}</ul>
              </div>`)}
            <a class="im__feature" href="#top" data-col="3">
              <span class="ac-media im__fimg">${raw(imageHTML(featured, { sizes: '320px', alt: '' }))}</span>
              <span class="im__fcopy" data-item><span class="ac-label">New in the spring run</span><strong>${vase.name} — ${vase.colour}</strong><span class="ac-num">${formatPrice(vase.price)}</span></span>
            </a>
          </div>
          <p class="im__strip ac-wrap ac-small" data-item>Free shipping from ${formatPrice(shop.freeShippingFrom)} · Thrown and fired on Os, Norway</p>
        </div>
      </header>
      <p class="ac-stage__note"><span>${shop.name} · shop header</span></p>
    </section>
    <div class="im__scrim" data-scrim aria-hidden="true"></div>
    <div class="im__readout" aria-hidden="true" data-readout><span class="ac-label">Timeline</span><span class="im__track"><span class="im__hinge"></span><span class="im__head"></span></span><span class="ac-label ac-num" data-time>0.00 s</span></div>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const toggle = root.querySelector('.im__shop');
  const panel = root.querySelector('[data-panel]');
  const scrim = root.querySelector('[data-scrim]');
  const chev = root.querySelector('.im__chev');
  const fimg = root.querySelector('.im__fimg img');
  const cols = [...root.querySelectorAll('[data-col]')].map((col) => [...col.querySelectorAll('[data-item]')]);
  const strip = root.querySelector('.im__strip');
  const items = [...cols.flat(), strip];
  const readout = root.querySelector('[data-readout]');
  const head = readout.querySelector('.im__head');
  const hingeMark = readout.querySelector('.im__hinge');
  const timeEl = readout.querySelector('[data-time]');
  const tier = ctx.motion;
  const { gsap, context } = useGsap(ctx, root);

  let tl = null;
  let hinge = 0;
  let wantOpen = false;

  // The playhead readout: where the timeline is, against the hinge. A demo aid; hidden from assistive tech.
  const draw = () => {
    const total = tl.duration() || 1;
    head.style.left = `${((tl.time() / total) * 100).toFixed(2)}%`;
    timeEl.textContent = `${tl.time().toFixed(2)} s`;
  };

  // One paused timeline: open half → addPause() at I → close half. Both directions live in one object.
  const build = () => {
    const t = gsap.timeline({ paused: true, onComplete: () => t.pause(0), onUpdate: () => draw() });
    if (tier === 'full') {
      const D = cfg.openDur;
      t.set(panel, { autoAlpha: 1 }, 0.001) // not at 0: a set at 0 stays applied when pause(0) lands on it
        .fromTo(panel, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D, ease: 'expo.inOut' }, 0)
        .fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: D * 0.8, ease: 'power2.out' }, 0)
        .to(chev, { rotation: 180, duration: 0.45, ease: 'power3.out' }, 0.05)
        .fromTo(fimg, { scale: 1.14 }, { scale: 1, duration: D + 0.3, ease: 'expo.out' }, 0.06);
      // Each column rises out of its masks a beat after the one before it.
      cols.forEach((list, c) => t.fromTo(list, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', stagger: 0.035 }, D * 0.17 + c * 0.05));
      t.fromTo(strip, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'none' }, D * 0.5);
      hinge = t.duration();
      t.addPause(hinge)
        .to(items, { yPercent: -40, autoAlpha: 0, duration: 0.28, ease: 'power2.in', stagger: { each: 0.012, from: 'end' } }, hinge)
        .to(chev, { rotation: 0, duration: 0.35, ease: 'power2.inOut' }, '<')
        .to(panel, { clipPath: 'inset(0% 0% 100% 0%)', duration: cfg.closeDur, ease: 'power3.inOut' }, '<0.08')
        .to(scrim, { autoAlpha: 0, duration: cfg.closeDur, ease: 'power2.inOut' }, '<')
        .set(panel, { autoAlpha: 0 });
    } else {
      // Reduced and static: the same hinge, opacity only.
      t.set(panel, { clipPath: 'inset(0% 0% 0% 0%)' }, 0)
        .fromTo(panel, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none' }, 0)
        .fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none' }, 0)
        .set(chev, { rotation: 180 }, 0)
        .fromTo(items, { yPercent: 0, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none', stagger: 0.01 }, 0.05);
      hinge = t.duration();
      t.addPause(hinge)
        .to([panel, scrim], { autoAlpha: 0, duration: 0.2, ease: 'none' }, hinge)
        .set(chev, { rotation: 0 })
        .set(items, { autoAlpha: 0 });
    }
    t.timeScale(cfg.slow ? 0.3 : 1);
    return t;
  };
  const rebuild = () => {
    const from = tl;
    context.add(() => { tl = build(); });
    from?.kill();
    tl.pause(wantOpen ? hinge : 0);
    hingeMark.style.left = `${((hinge / tl.duration()) * 100).toFixed(2)}%`;
    draw();
  };

  const setOpen = (open) => {
    wantOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    panel.inert = !open; // inert the moment a close is asked for
    root.classList.toggle('is-open', open);
    if (tier === 'static') { tl.pause(open ? hinge : 0); draw(); return; }
    if (open) {
      // From rest or from a rewind: play forward to the hinge. From inside the close half: reverse back to it (the
      // addPause callback fires in reverse too and holds it there).
      if (tl.time() > hinge) tl.reverse(); else tl.play();
    } else if (cfg.hinge === 'mirror' || tl.time() < hinge) {
      // The move: before the hinge, rewind what has played. (Mirror: rewind after it too.)
      tl.reverse();
    } else {
      tl.play();
    }
  };

  rebuild();
  panel.inert = true;
  if (ctx.capture) readout.hidden = true;

  on(ctx, toggle, 'click', () => setOpen(!wantOpen));
  on(ctx, scrim, 'click', () => setOpen(false));
  panel.querySelectorAll('a').forEach((a) => on(ctx, a, 'click', () => setOpen(false)));
  on(ctx, document, 'keydown', (e) => {
    if (e.key === 'Escape' && wantOpen) { setOpen(false); toggle.focus(); }
  });

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.some((k) => k === 'openDur' || k === 'closeDur')) rebuild();
      if (changed.includes('slow')) tl.timeScale(cfg.slow ? 0.3 : 1);
    },
    action(id) {
      if (id === 'toggle') setOpen(!wantOpen);
    },
  };
}
