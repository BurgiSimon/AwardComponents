// Long-read dialog — a Fieldnote issue page. "Read the full story" opens a native <dialog> (showModal) that holds the
// whole article, server-rendered with the page. A second Lenis bound to the dialog's scroller rides the same GSAP
// ticker as the page Lenis, which stops while the dialog is open; data-lenis-prevent keeps them apart, and an inner
// ledger pane keeps native scrolling. Below the breakpoint the same markup is a bottom sheet dragged away from its
// header (past `dismiss` of its height, or a flick > 0.6 px/ms). Reduced/static: instant, native scrolling.
import './demo.css';
import '../../src/demo-kit/serif.css';
import Lenis from 'lenis';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const OPEN = { dur: 0.66, ease: 'expo.out', rise: 48 };
const CLOSE = { dur: 0.42, ease: 'expo.in', drop: 32 };
const FLICK = 0.6;
const MORE = [
  'The pans are shallow iron trays the size of a small room, set over a firebox fed with driftwood and old pallets. Brine from a well behind the boiling house runs in along a wooden gutter, and the fire takes it from twelve centimetres to a wet crust in about thirty hours.',
  'The salt is raked to the edges with a long wooden rake, drained in baskets and dried on racks above the pans. A good week gives three hundred kilos. A week of north wind, when the smoke will not draw, gives almost nothing.',
  'The archive took six years to fund. Most of the money came from the island itself, in jars left on the counter of the boiling-house shop, which is why the reading room has a shelf of jars where another building would have a plaque.',
  'On the last evening of the season the fires are allowed to die on their own. Nobody rakes the final pan. By morning it is a sheet of grey glass, and Birthe breaks it into pieces small enough to post to everyone who wrote to the island that year.',
];
const LEDGER = [
  ['1788', '14 June', 'First fire of the season. Wind south-west, light.'],
  ['1788', '2 July', 'Two pans cracked. 41 kg.'],
  ['1791', '19 May', 'Peat short; driftwood from the north beach.'],
  ['1795', '8 August', 'Storm. Pans covered for four days.'],
  ['1802', '30 June', 'New gutter of pine. 66 kg in the week.'],
  ['1811', '11 July', 'No fire: blockade, no buyers.'],
  ['1847', '3 June', 'Boys paid in salt, two kilos a day.'],
  ['1866', '22 August', 'Best week on record. 212 kg.'],
  ['1901', '15 May', 'Last peat cut on the island.'],
  ['1934', '9 July', 'Boiling house re-roofed in larch.'],
  ['1991', '1 June', 'First summer of the revival. Six volunteers.'],
  ['2025', '12 September', 'Last fire before the archive opens.'],
];

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const story = magazine.articles[0];
  const [lead, fig, ...rest] = photos({ tags: ['landscape'], count: 2, seed: 'ds-story' }).concat(photos({ tags: ['editorial'], count: 3, seed: 'ds-more' }));
  let cfg = { ...options };
  const full = ctx.motion === 'full';

  root.className = 'ds';
  root.innerHTML = html`
    <header class="ds__bar ac-wrap">
      <a class="ds__brand" href="#top">${magazine.name}</a>
      <nav aria-label="Sections">${['Places', 'Architecture', 'Craft', 'Culture'].map((s) => html`<a href="#top">${s}</a>`)}</nav>
      <a class="ac-btn ac-btn--sm" href="#top">Subscribe</a>
    </header>
    <main class="ds__page ac-wrap">
      <article class="ds__feature" aria-labelledby="ds-card-title">
        <figure class="ac-media ds__lead">${raw(imageHTML(lead, { sizes: '(max-width: 760px) 100vw, 55vw', alt: 'Salt pans on Læsø', eager: true }))}</figure>
        <div class="ds__card">
          <p class="ac-label">${magazine.issue} · ${story.section} · ${story.read}</p>
          <h1 class="ds__title" id="ds-card-title">${story.title}</h1>
          <p class="ac-lede">${story.dek}</p>
          <p class="ac-small">Words by ${story.author}</p>
          <button type="button" class="ac-btn ac-btn--lg" data-open aria-haspopup="dialog" aria-controls="ds-dialog">Read the full story</button>
        </div>
      </article>
      <section class="ds__more" aria-label="Also in this issue">
        <p class="ac-label">Also in ${magazine.issue.split(' — ')[0]}</p>
        <ul role="list">${magazine.articles.slice(1, 4).map((a, i) => html`<li><a href="#top"><span class="ac-media">${raw(imageHTML(rest[i], { sizes: '240px', alt: '' }))}</span><span class="ac-label">${a.section} · ${a.read}</span><strong>${a.title}</strong><span class="ac-small">${a.dek}</span></a></li>`)}</ul>
      </section>
    </main>

    <dialog class="ds__dialog" id="ds-dialog" data-lenis-prevent aria-labelledby="ds-title">
      <div class="ds__scrim" data-scrim></div>
      <div class="ds__panel" data-panel>
        <div class="ds__head" data-handle>
          <span class="ds__grip" aria-hidden="true"></span>
          <p class="ac-label ds__kicker">${story.section} · ${story.read}</p>
          <button type="button" class="ds__close" data-close autofocus><span>Close</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg></button>
        </div>
        <div class="ds__scroller" data-scroller tabindex="0" role="region" aria-labelledby="ds-title">
          <div class="ds__content" data-content>
            <header class="ds__story-head">
              <h2 class="ds__title" id="ds-title">${story.title}</h2>
              <p class="ac-lede">${story.dek}</p>
              <p class="ac-small">Words by ${story.author} · Photographs by Mira Lund</p>
            </header>
            <figure class="ds__figure"><span class="ac-media">${raw(imageHTML(lead, { sizes: '760px', alt: 'Salt pans on Læsø at the end of the day' }))}</span><figcaption class="ac-small">The boiling house on Læsø in September, a week before the last fire.</figcaption></figure>
            <div class="ds__body">
              ${magazine.longRead.slice(0, 3).map((p) => html`<p>${p}</p>`)}
              <blockquote class="ds__quote"><p>She reads the pan by sound: a low roll means the water is too deep.</p></blockquote>
              ${MORE.slice(0, 2).map((p) => html`<p>${p}</p>`)}
              <section class="ds__ledger" aria-labelledby="ds-ledger">
                <h3 class="ac-label" id="ds-ledger">From the ledger, 1788–2025</h3>
                <ol class="ds__pane" data-pane data-lenis-prevent tabindex="0" aria-label="Ledger entries" role="list">
                  ${LEDGER.map(([y, d, t]) => html`<li><span class="ac-num">${y}</span><span class="ac-small">${d}</span><span>${t}</span></li>`)}
                </ol>
              </section>
              ${magazine.longRead.slice(3).map((p) => html`<p>${p}</p>`)}
              <figure class="ds__figure"><span class="ac-media">${raw(imageHTML(fig, { sizes: '760px', alt: 'The dunes over the half-buried archive' }))}</span><figcaption class="ac-small">The archive, with the dune already blowing across its roof.</figcaption></figure>
              ${MORE.slice(2).map((p) => html`<p>${p}</p>`)}
              <p class="ds__end ac-small">First published in Fieldnote ${magazine.issue}.</p>
            </div>
          </div>
        </div>
      </div>
    </dialog>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const html_ = document.documentElement;
  const dialog = root.querySelector('dialog');
  const panel = root.querySelector('[data-panel]');
  const scrim = root.querySelector('[data-scrim]');
  const handle = root.querySelector('[data-handle]');
  const scroller = root.querySelector('[data-scroller]');
  const inner = root.querySelector('[data-content]');
  const opener = root.querySelector('[data-open]');
  const closeBtn = root.querySelector('[data-close]');
  const lenis = useLenis(ctx);
  useGsap(ctx, root);
  const state = { open: false, closing: false, variant: 'dialog' };
  let tl = null;
  let nested = null;
  const tick = (time) => nested?.raf(time * 1000);

  const apply = () => {
    root.style.setProperty('--dw', `${cfg.width}px`);
    root.style.setProperty('--blur', `${cfg.blur}px`);
  };
  apply();

  // `keyboard`: whether Close, focused by showModal, should show its ring (not after a mouse press or the toolbar).
  function open({ keyboard = false } = {}) {
    if (state.open) return;
    state.variant = innerWidth < cfg.breakpoint ? 'sheet' : 'dialog';
    dialog.dataset.variant = state.variant;
    html_.style.overflow = 'hidden'; // backs up the stopped Lenis for native scrolling
    lenis?.stop();
    scroller.scrollTop = 0;
    dialog.showModal(); // top layer, the page inert, focus to [autofocus]
    if (!keyboard) { closeBtn.blur(); closeBtn.focus({ preventScroll: true, focusVisible: false }); }
    state.open = true;
    // The nested Lenis: wheel inside the scroller eases here, on the same ticker as the page's.
    if (full) {
      nested = new Lenis({ wrapper: scroller, content: inner, autoRaf: false, duration: 1.2, easing: (x) => Math.min(1, 1.001 - 2 ** (-10 * x)) });
      gsap.ticker.add(tick);
    }
    if (!full) { gsap.set([panel, scrim], { clearProps: 'transform,opacity' }); return; }
    const from = state.variant === 'sheet' ? { y: panel.offsetHeight } : { y: OPEN.rise, opacity: 0 };
    tl = gsap.timeline()
      .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0)
      .fromTo(panel, from, { y: 0, opacity: 1, duration: OPEN.dur, ease: OPEN.ease }, 0);
  }

  function close() {
    if (!state.open || state.closing) return;
    state.closing = true;
    tl?.kill();
    if (!full) { dialog.close(); return; }
    const to = state.variant === 'sheet' ? { y: panel.offsetHeight } : { y: CLOSE.drop, opacity: 0 };
    tl = gsap.timeline({ onComplete: () => dialog.close() })
      .to(panel, { ...to, duration: CLOSE.dur, ease: CLOSE.ease }, 0)
      .to(scrim, { opacity: 0, duration: CLOSE.dur, ease: 'power1.in' }, 0.05);
  }

  // Every way out ends here: our close(), or the browser closing the dialog itself.
  const teardown = () => {
    tl?.kill();
    tl = null;
    gsap.ticker.remove(tick);
    nested?.destroy();
    nested = null;
    gsap.set([panel, scrim], { clearProps: 'transform,opacity' });
    state.open = false;
    state.closing = false;
    html_.style.overflow = '';
    lenis?.start();
  };
  let closedByKey = false;
  on(ctx, dialog, 'close', () => { teardown(); opener.focus({ preventScroll: true, focusVisible: closedByKey }); closedByKey = false; });
  on(ctx, dialog, 'cancel', (e) => { e.preventDefault(); closedByKey = true; close(); }); // Escape: animate instead of cutting
  on(ctx, opener, 'click', (e) => open({ keyboard: e.detail === 0 })); // detail 0: Enter or Space
  on(ctx, closeBtn, 'click', (e) => { closedByKey = e.detail === 0; close(); });
  on(ctx, scrim, 'click', close);
  ctx.onCleanup(() => { if (state.open) { teardown(); if (dialog.open) dialog.close(); } });

  // Drag to dismiss, sheet only, from the header; the text keeps its own touch scrolling.
  let drag = null;
  on(ctx, handle, 'pointerdown', (e) => {
    if (state.variant !== 'sheet' || !state.open || state.closing || e.button !== 0 || e.target.closest('button')) return;
    tl?.kill();
    drag = { id: e.pointerId, y0: e.clientY, y: 0, t: e.timeStamp, v: 0 };
    handle.setPointerCapture(e.pointerId);
  });
  on(ctx, handle, 'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const y = Math.max(0, e.clientY - drag.y0);
    const dt = e.timeStamp - drag.t;
    if (dt > 0) drag.v = (y - drag.y) / dt;
    drag.y = y;
    drag.t = e.timeStamp;
    gsap.set(panel, { y });
    gsap.set(scrim, { opacity: 1 - y / panel.offsetHeight });
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { y, v, t } = drag;
    drag = null;
    const flick = e.type === 'pointerup' && e.timeStamp - t < 100 && v > FLICK; // only if the finger was still moving
    if (e.type === 'pointerup' && (y > panel.offsetHeight * (cfg.dismiss / 100) || flick)) { close(); return; }
    if (!full) { gsap.set([panel, scrim], { clearProps: 'transform,opacity' }); return; }
    gsap.to(panel, { y: 0, duration: 0.5, ease: 'expo.out' });
    gsap.to(scrim, { opacity: 1, duration: 0.3, ease: 'power1.out' });
  };
  on(ctx, handle, 'pointerup', release);
  on(ctx, handle, 'pointercancel', release);

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
    action(id) {
      if (id === 'open') open();
    },
  };
}
