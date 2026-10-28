// Logo marquee — a banking app's "trusted by" band: a row of client marks and, running the other way, a row of
// their work. One clock (the shared ticker) moves both tracks; each wraps at one copy's width, adds a damped share
// of the Lenis velocity, pauses on hover and focus, and stops off-screen. Reduced motion: a still, wrapped grid.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { onFrame, on, whileVisible, damp, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

// Drawn wordmarks: each client gets a type treatment and a glyph so the row reads like real marks.
const GLYPHS = [
  '<circle cx="12" cy="12" r="8"/>',
  '<path d="M12 3 21 20H3Z"/>',
  '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  '<path d="M4 12h16M12 4v16"/>',
  '<path d="M3 12a9 9 0 0 1 18 0Z"/>',
  '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
  '<path d="M4 20 12 4l8 16"/>',
  '<path d="M12 3a9 9 0 1 0 9 9h-9Z"/>',
  '<rect x="3" y="8" width="18" height="8" rx="4"/>',
  '<path d="m12 3 2.6 6.2L21 10l-5 4.3 1.6 6.7L12 17.5 6.4 21 8 14.3 3 10l6.4-.8Z"/>',
];
const STYLES = ['wide', 'serif', 'mono', 'heavy', 'italic', 'spaced', 'narrow', 'wide', 'serif', 'heavy'];

function logo(name, i) {
  return html`<li class="lm__logo lm__logo--${STYLES[i % STYLES.length]}"><svg viewBox="0 0 24 24" aria-hidden="true">${raw(GLYPHS[i % GLYPHS.length])}</svg><span>${name}</span></li>`;
}

export default function mount(root, options, ctx) {
  const { app, studio } = content;
  const work = photos({ tags: ['architecture'], count: 4, seed: 'lm-arch' }).concat(photos({ tags: ['interior'], count: 3, seed: 'lm-int' }));
  root.className = 'lm';
  root.innerHTML = html`
    <section class="lm__band" aria-labelledby="lm-title">
      <div class="ac-wrap lm__head">
        <p class="ac-label">${app.name} · customers</p>
        <h1 class="ac-h1" id="lm-title">Two hundred studios run their books on ${app.name}.</h1>
      </div>
      <div class="lm__row" data-row="logos" aria-label="Customers">
        <ul class="lm__track" role="list">${app.clients.map(logo)}</ul>
      </div>
      <div class="lm__row lm__row--work" data-row="work" aria-label="Recent work by customers">
        <ul class="lm__track" role="list">
          ${work.map((p, i) => html`<li class="lm__card"><a href="#work" class="lm__card-link"><span class="lm__media">${raw(imageHTML(p, { sizes: '320px', alt: '' }))}</span><span class="lm__cap"><strong>${studio.projects[i % studio.projects.length].title}</strong><span>${app.clients[(i * 3) % app.clients.length]}</span></span></a></li>`)}
        </ul>
      </div>
    </section>
    <section class="ac-wrap lm__after">
      <div><strong class="ac-num">4.9</strong><span>average rating from studio owners</span></div>
      <div><strong class="ac-num">11 min</strong><span>to open an account, ID included</span></div>
      <div><strong class="ac-num">€0</strong><span>to send invoices in 32 currencies</span></div>
    </section>
    <p class="lm__hint ac-label">Scroll — the rows speed up with you</p>`;
  root.querySelectorAll('a[href="#work"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const lenis = useLenis(ctx);
  let cfg = { ...options };
  const rows = [...root.querySelectorAll('.lm__row')];

  const apply = () => {
    root.style.setProperty('--fade', `${cfg.fade}%`);
    root.querySelector('[data-row="work"]').hidden = cfg.rows === 'logos';
    rows.forEach((r) => r.track?.refill());
  };

  if (ctx.motion !== 'full') {
    root.classList.add('lm--still');
    apply();
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  rows.forEach((row, index) => {
    const track = row.querySelector('.lm__track');
    const originals = [...track.children];
    let copyWidth = 0;
    let x = 0;
    let speed = 0;
    let hovered = false;
    let focused = false;

    const refill = () => {
      track.querySelectorAll('[data-clone]').forEach((n) => n.remove());
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      copyWidth = originals.reduce((w, li) => w + li.getBoundingClientRect().width + gap, 0);
      if (!copyWidth) return;
      const copies = Math.max(2, Math.ceil((row.clientWidth * 2) / copyWidth) + 1);
      for (let c = 1; c < copies; c++) {
        for (const li of originals) {
          const clone = li.cloneNode(true);
          clone.dataset.clone = '';
          clone.setAttribute('aria-hidden', 'true');
          clone.querySelectorAll('a, button').forEach((a) => a.setAttribute('tabindex', '-1'));
          track.append(clone);
        }
      }
      x %= copyWidth;
    };
    row.track = { refill };

    const frame = (dt) => {
      if (!copyWidth || row.hidden) return;
      const paused = focused || (hovered && cfg.pause);
      const sign = (cfg.direction === 'left' ? -1 : 1) * (index % 2 ? -1 : 1);
      const target = paused ? 0 : cfg.speed + Math.abs(lenis?.velocity || 0) * 60 * cfg.boost;
      speed = damp(speed, target, paused ? 12 : 5, dt);
      x += sign * speed * dt;
      if (x <= -copyWidth) x += copyWidth;
      if (x > 0) x -= copyWidth;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    };

    on(ctx, row, 'pointerenter', () => { hovered = true; });
    on(ctx, row, 'pointerleave', () => { hovered = false; });
    on(ctx, row, 'focusin', () => { focused = true; });
    on(ctx, row, 'focusout', () => { focused = false; });

    let off = null;
    whileVisible(ctx, row, () => { refill(); off = onFrame(ctx, frame); }, () => { off?.(); off = null; });
    document.fonts?.ready.then(refill);
    row.querySelectorAll('img').forEach((img) => img.addEventListener('load', refill, { once: true, signal: ctx.signal }));
  });
  on(ctx, window, 'resize', () => rows.forEach((r) => r.track?.refill()));
  apply();

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.some((k) => k === 'fade' || k === 'rows')) apply();
    },
  };
}
