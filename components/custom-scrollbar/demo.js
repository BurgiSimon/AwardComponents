// Drawn scrollbar — a banking app's long help guide (a title and seven short sections) with a themed thumb on the
// right edge. The thumb only mirrors the scroll: it reads scrollY / (scrollHeight − innerHeight) once a frame (on
// GSAP's ticker, right after Lenis, so it reads the position Lenis wrote that frame) and moves by transform, so keys,
// anchors, find-in-page and the native bar (which stays) move it too. Dragging writes the scroll; pressing the track
// centres the thumb on the pointer and drags from there. Ticks mark where each section starts, and a bubble names the
// section under the pointer or the thumb. The track is aria-hidden and pointer-only; it is hidden on coarse pointers.
// Reduced motion: no Lenis and no easing, the thumb sits exactly on the scroll position, updated on scroll events
// instead of a loop.
import './demo.css';
import { on, html, clamp, damp, colour, observeResize, later } from '../../src/demo-kit/index.js';
import { gsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const MIN_THUMB = 48;
const LINE = 0.3; // a section is current once its top passes 30 % of the viewport height
const SECTIONS = [
  {
    id: 'before', title: 'Before your first invoice',
    body: [
      'Three details go on every invoice, so it is worth setting them once: the account you want paying into, your VAT number if you have one, and the payment terms you agree with most clients.',
      'Open Settings, then Invoicing. Anything you leave blank here can still be filled in per invoice; nothing is sent until you press Send.',
    ],
  },
  {
    id: 'create', title: 'Create and send an invoice',
    body: [
      'Press N anywhere in the app, or choose New invoice from a client’s page. Lines can be typed, pasted from a spreadsheet or pulled from tracked time, and the total updates as you go.',
      'Send emails a link and a PDF. The link shows the invoice in the client’s language and lets them pay by card or bank transfer; the PDF is the same document, for clients whose systems want a file.',
    ],
  },
  {
    id: 'reminders', title: 'Reminders that send themselves',
    body: [
      'Late payers get a polite nudge on day three after the due date, a firmer one on day ten and, on day twenty-one, a note to you suggesting a call. Each email is short and written in your name.',
      'Reminders stop the moment a payment arrives, and pause for a week if the client replies to one. You can edit the wording, or switch the schedule off for a client who always pays on the last day.',
    ],
  },
  {
    id: 'matching', title: 'Matching payments',
    body: [
      'When money arrives, Parallel looks for an open invoice with the same reference, then the same amount from the same payer. A confident match is marked paid at once; anything uncertain waits in Inbox with the two best guesses.',
      'Part-payments stay open with the remainder shown on the invoice and in the next reminder. Overpayments are held as credit on the client and offered against their next invoice.',
    ],
  },
  {
    id: 'pot', title: 'The tax pot',
    body: [
      'A share of every payment you receive moves to a locked pot the moment it lands, so the money for your tax bill is never in the account you spend from. Most studios set it between 20 and 30 per cent.',
      'The pot can be opened twice a year, in the weeks your returns are due, or at any time with a two-day wait. It earns the same interest as a savings account and shows on your statements as its own line.',
    ],
  },
  {
    id: 'exports', title: 'Exports for your accountant',
    body: [
      'Every invoice, payment and receipt can leave Parallel as CSV, as SAF-T for Norwegian and Portuguese accountants, or as one PDF per quarter. Exports can also go by email on the first of each month, to an address you choose.',
      'Receipts are matched on upload, so the export carries the picture of the receipt next to the card payment it belongs to. Your accountant gets read-only access with their own login if they prefer to look for themselves.',
    ],
  },
  {
    id: 'late', title: 'If a client pays very late',
    body: [
      'After forty-five days an invoice moves to Overdue and Parallel offers three things: a statement of everything the client owes, a final reminder with a date, and a letter in the format your country’s small-claims process expects.',
      'None of these is sent without you. Most invoices are paid long before this point; the median Parallel invoice is paid nine days after it is sent.',
    ],
  },
];

export default function mount(root, options, ctx) {
  let cfg = { ...options };
  root.className = 'csb';
  root.innerHTML = html`
    <div class="csb-track" data-track aria-hidden="true">
      <span class="csb-rail"></span>
      <span class="csb-ticks" data-ticks>${SECTIONS.map((s, i) => html`<span class="csb-tick" data-tick="${i}"></span>`)}</span>
      <span class="csb-thumb" data-thumb></span>
      <span class="csb-bubble" data-bubble><span data-bubble-n></span><span data-bubble-t></span></span>
    </div>
    <main>
      <article class="csb-article" aria-labelledby="csb-title">
        <h1 class="ac-h1 csb-title" id="csb-title">Getting paid: invoices, reminders and the tax pot</h1>
        ${SECTIONS.map((s, i) => html`
          <section class="csb-sec" data-section="${i}" aria-labelledby="csb-${s.id}-h">
            <h2 class="ac-h2" id="csb-${s.id}-h"><span class="csb-sec__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${s.title}</h2>
            ${s.body.map((p) => html`<p class="ac-body">${p}</p>`)}
          </section>`)}
      </article>
    </main>`;

  const html_ = document.documentElement;
  const track = root.querySelector('[data-track]');
  const thumb = root.querySelector('[data-thumb]');
  const bubble = root.querySelector('[data-bubble]');
  const bubbleN = root.querySelector('[data-bubble-n]');
  const bubbleT = root.querySelector('[data-bubble-t]');
  const ticks = [...root.querySelectorAll('[data-tick]')];
  const sections = [...root.querySelectorAll('[data-section]')];

  const lenis = useLenis(ctx);
  const s = { shown: 0, target: 0, dragging: false, grab: 0, written: -1, active: -1, lastY: -1 };
  let trackTop = 0; let trackH = 0; let thumbH = MIN_THUMB; let maxScroll = 1; let live = false;
  let starts = [];
  const travel = () => Math.max(1, trackH - thumbH);

  const measure = () => {
    live = getComputedStyle(track).display !== 'none';
    maxScroll = Math.max(1, html_.scrollHeight - innerHeight);
    starts = sections.map((sec) => clamp((sec.getBoundingClientRect().top + scrollY - innerHeight * LINE) / maxScroll, 0, 1));
    if (!live) return;
    const r = track.getBoundingClientRect();
    trackTop = r.top; trackH = r.height;
    thumbH = Math.max(MIN_THUMB, Math.round((trackH * innerHeight) / html_.scrollHeight));
    root.style.setProperty('--thumb-h', `${thumbH}px`);
    // A tick sits where the thumb's centre will be when its section becomes current.
    ticks.forEach((t, i) => { t.style.transform = `translate3d(0, ${(starts[i] * travel() + thumbH / 2).toFixed(1)}px, 0)`; });
    s.written = -1;
  };

  const sectionAt = (f) => { let i = 0; starts.forEach((st, k) => { if (f + 0.0005 >= st) i = k; }); return i; };
  const showBubble = (index, y) => {
    bubbleN.textContent = String(index + 1).padStart(2, '0');
    bubbleT.textContent = SECTIONS[index].title;
    bubble.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    bubble.classList.add('is-on');
  };

  // The thumb and the ticks' scroll-spy, from one reading of the scroll position.
  const render = (dt) => {
    s.target = clamp(scrollY / maxScroll, 0, 1);
    const ease = ctx.motion === 'full' && !s.dragging && cfg.ease > 0;
    s.shown = ease && dt ? damp(s.shown, s.target, cfg.ease, dt) : s.target;
    if (Math.abs(s.shown - s.target) < 1e-4) s.shown = s.target;
    const y = Math.round(s.shown * travel() * 10) / 10;
    if (live && y !== s.written) {
      thumb.style.transform = `translate3d(0, ${y}px, 0)`;
      s.written = y;
      if (s.dragging) showBubble(sectionAt(s.target), y + thumbH / 2);
    }
    const active = sectionAt(s.target);
    if (active !== s.active) {
      s.active = active;
      ticks.forEach((t, i) => t.classList.toggle('is-past', i <= active));
    }
    if (scrollY !== s.lastY) { s.lastY = scrollY; wake(); }
  };

  // Auto-hide: the track fades after 1.2 s without scrolling or a pointer near the edge; it never hides mid-drag.
  let idleTimer = 0;
  const wake = () => {
    track.classList.remove('is-idle');
    clearTimeout(idleTimer);
    if (cfg.autoHide) idleTimer = setTimeout(() => { if (!s.dragging && !track.matches(':hover')) track.classList.add('is-idle'); }, 1200);
  };
  ctx.onCleanup(() => clearTimeout(idleTimer));

  // Drag: the thumb's offset over its free travel is the scroll fraction.
  const scrollToFraction = (f) => {
    const y = clamp(f, 0, 1) * maxScroll;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  };
  const dragTo = (clientY) => scrollToFraction((clientY - trackTop - s.grab) / travel());
  on(ctx, track, 'pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    measure();
    const thumbTop = trackTop + s.shown * travel();
    s.grab = e.target === thumb ? e.clientY - thumbTop : thumbH / 2;
    s.dragging = true;
    track.setPointerCapture(e.pointerId);
    track.classList.add('is-dragging');
    html_.classList.add('csb-dragging');
    dragTo(e.clientY);
    if (!lenis) render(0);
  });
  on(ctx, track, 'pointermove', (e) => {
    if (s.dragging) { dragTo(e.clientY); if (!lenis) render(0); return; }
    // Hover: name the section under the pointer.
    const f = clamp((e.clientY - trackTop - thumbH / 2) / travel(), 0, 1);
    showBubble(sectionAt(f), clamp(e.clientY - trackTop, 0, trackH));
  });
  const end = () => {
    if (!s.dragging) return;
    s.dragging = false;
    track.classList.remove('is-dragging');
    html_.classList.remove('csb-dragging');
    bubble.classList.remove('is-on');
    wake();
  };
  on(ctx, track, 'pointerup', end);
  on(ctx, track, 'pointercancel', end);
  on(ctx, track, 'pointerleave', () => { if (!s.dragging) bubble.classList.remove('is-on'); });
  on(ctx, window, 'pointermove', (e) => { if (cfg.autoHide && innerWidth - e.clientX < 72) wake(); }, { passive: true });
  ctx.onCleanup(() => html_.classList.remove('csb-dragging'));

  // One clock in the full tier: GSAP's ticker runs Lenis, then this. Reduced and static: scroll events, no loop.
  if (lenis) {
    const tick = () => render(gsap.ticker.deltaRatio(60) / 60);
    gsap.ticker.add(tick);
    ctx.onCleanup(() => gsap.ticker.remove(tick));
  } else {
    on(ctx, window, 'scroll', () => render(0), { passive: true });
  }

  const apply = () => {
    root.style.setProperty('--csb-w', `${cfg.width}px`);
    root.style.setProperty('--csb-hover', String((cfg.width + 4) / cfg.width));
    root.style.setProperty('--csb-colour', colour(cfg.colour));
    root.classList.toggle('csb--ticks', cfg.ticks);
    if (!cfg.autoHide) { clearTimeout(idleTimer); track.classList.remove('is-idle'); } else wake();
  };
  apply();
  measure();
  render(0);
  observeResize(ctx, root, () => { measure(); render(0); });
  on(ctx, window, 'resize', () => { measure(); render(0); });
  document.fonts?.ready.then(() => { measure(); render(0); });
  later(ctx, () => { measure(); render(0); }, 300);

  return {
    update(next) { cfg = { ...next }; apply(); measure(); render(0); },
  };
}
