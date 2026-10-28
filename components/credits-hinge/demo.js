// Credits under the footer — the end of a Fieldnote issue page, built from the awards recipe `footer-credits-hinge`.
// The page's last sheet (the ground, the issue line and the Fieldnote wordmark) slides off a footer stage that is
// position: sticky (top 0, 100svh) inside a rail starting `rail` svh above the footer. A linear scrub from the moment
// the stage sticks to the end tips the sheet on its top-left corner, and the stage's content rises 12 % → 0 as the
// sheet's foot clears. Credits scrolls to the end (0.8 s, expo out) while one CSS transition (1 s expo out) lifts the
// stage by the colophon's own height + 24 px + (stage width / 2) × sin |tilt| and tilts it, uncovering the colophon.
// Escape, Close credits, Credits again or a scroll of more than 24 px after a 0.85 s arming delay put it back.
// Reduced: native scroll, nothing tips or lifts, the colophon fades up over the stage. Static: a cut.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, html, raw, photo, imageHTML, content, observeResize } from '../../src/demo-kit/index.js';
import { gsap, useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const OPEN_SCROLL = 0.8; // s: the scroll to the end, run beside the lift
const SCROLL_CLOSE = 24; // px: once armed, a scroll further than this puts the credits away
const NARROW = 760; // px: the sheet also rises as it tips, and the open stage tilts 60 % as far
const expoOut = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
// The sheet's box runs 8vw past the left edge (its hinge corner is off screen), so its foot stays covered with a far
// smaller sideways slide than the recipe's −6 % / −10 %, and the wordmark is never cut at the left.
const SHIFT = { wide: { x: -2, y: 0 }, narrow: { x: -4, y: -24 } };

// The issue's four stories and the picture each one shows; every picture is credited in the colophon.
const PICTURES = {
  'salt-and-time': ['land-overcast-sea', ['water']],
  'the-quiet-room': ['paint-hammershoi-sunlight', ['interior']],
  'glaze-chemistry': ['obj-jian-tea-bowl', ['ceramic']],
  'night-swimming': ['land-lake-reflection', ['landscape']],
};

// The blink family, registered once and composed by name: hard opacity steps, never a fade. Hover and keyboard focus
// get one step, a press the full ladder.
if (!gsap.effects.blink) {
  gsap.registerEffect({
    name: 'blink',
    extendTimeline: true,
    effect: (targets) => gsap.timeline().set(targets, { opacity: 0 }, 0).set(targets, { opacity: 1 }, 0.06).set(targets, { opacity: 0 }, 0.12).set(targets, { opacity: 1, clearProps: 'opacity' }, 0.18),
  });
  gsap.registerEffect({
    name: 'blinkOnce',
    extendTimeline: true,
    effect: (targets) => gsap.timeline().set(targets, { opacity: 0 }, 0).set(targets, { opacity: 1, clearProps: 'opacity' }, 0.06),
  });
}

// "Work — maker, source (licence)" → the two halves, so a phone can drop the work's title and keep who made it.
const splitCredit = (pic) => {
  if (pic.drawn || !pic.credit) return { work: '', who: 'Drawn colour field, no picture credit' };
  const i = pic.credit.indexOf(' — ');
  return i < 0 ? { work: '', who: pic.credit } : { work: pic.credit.slice(0, i), who: pic.credit.slice(i + 3) };
};

export default function mount(root, options, ctx) {
  const { magazine, people } = content;
  const stories = magazine.articles.slice(0, 4);
  const pics = stories.map((a) => photo(PICTURES[a.slug][0], { fallbackTags: PICTURES[a.slug][1] }));
  const editor = people.find((p) => /^Editor/.test(p.role))?.name || 'Ellis Brandt';
  const writers = [...new Set(stories.map((a) => a.author))];
  const [lead, ...rest] = stories;
  const issueNo = magazine.issue.split(' — ')[0];
  const full = ctx.motion === 'full';
  const ARM = full ? 0.85 : 0.3; // s
  let cfg = { ...options };

  root.className = 'ch';
  root.dataset.tier = ctx.motion;
  if (ctx.capture) root.classList.add('ch--capture');
  root.innerHTML = html`
    <header class="ch__bar ac-wrap">
      <a class="ch__brand" href="#top" data-brand>${magazine.name}</a>
      <nav aria-label="Main">${['Places', 'Architecture', 'Craft', 'Culture'].map((s) => html`<a href="#top">${s}</a>`)}</nav>
      <a class="ac-btn ac-btn--sm" href="#top">Subscribe</a>
    </header>

    <main class="ch__page">
      <section class="ch__head ac-wrap" aria-labelledby="ch-title">
        <p class="ac-label">${magazine.issue} · Autumn 2026</p>
        <h1 class="ch__title" id="ch-title">The weather issue</h1>
        <p class="ac-lede">Four stories from places where the forecast sets the work: salt boiled from the sea, a library built around one window, glazes read like skies, and swimming after dark.</p>
      </section>

      <section class="ch__stories ac-wrap" aria-label="In this issue">
        <article class="ch__lead" aria-labelledby="ch-s0">
          <span class="ac-media ch__lead-pic">${raw(imageHTML(pics[0], { sizes: '(max-width: 760px) 100vw, 58vw', alt: '', eager: true }))}</span>
          <div class="ch__lead-copy">
            <p class="ac-label">${lead.section} · ${lead.read}</p>
            <h2 class="ch__lead-title" id="ch-s0"><a href="#top">${lead.title}</a></h2>
            <p class="ac-lede">${lead.dek}</p>
            <p class="ac-small">Words by ${lead.author}</p>
          </div>
        </article>
        <ul class="ch__row" role="list">
          ${rest.map((a, i) => html`
            <li>
              <article class="ch__story" aria-labelledby="ch-s${i + 1}">
                <span class="ac-media ch__story-pic">${raw(imageHTML(pics[i + 1], { sizes: '(max-width: 760px) 40vw, 30vw', alt: '' }))}</span>
                <p class="ac-label">${a.section} · ${a.read}</p>
                <h2 class="ch__story-title" id="ch-s${i + 1}"><a href="#top">${a.title}</a></h2>
                <p class="ch__dek">${a.dek}</p>
                <p class="ac-small">Words by ${a.author}</p>
              </article>
            </li>`)}
        </ul>
      </section>

      <p class="ch__end ac-wrap"><span class="ac-label">End of ${issueNo}</span> Issue 15, on shelter, goes to print in February.</p>
    </main>

    <footer class="ch__close" aria-labelledby="ch-foot">
      <div class="ch__sheet" data-sheet>
        <p class="ch__word" aria-hidden="true">${magazine.name}</p>
        <p class="ch__issue"><span>${magazine.issue}</span><span>Autumn 2026 · four stories</span></p>
      </div>
      <div class="ch__rail" data-rail>
        <div class="ch__stage" data-stage>
          <div class="ch__ground" aria-hidden="true"></div>
          <div class="ch__content ac-wrap" data-content>
            <h2 class="sr-only" id="ch-foot">${magazine.name}</h2>
            <section class="ch__letters" aria-labelledby="ch-f1">
              <h3 class="ch__label" id="ch-f1">Letters to the editor</h3>
              <p class="ch__say">Tell us what the weather does where you work.</p>
              <p class="ch__mail"><a href="mailto:letters@fieldnote.no" data-blink><span>letters@fieldnote.no</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg></a></p>
            </section>
            <div class="ch__cols">
              <section class="ch__col ch__col--sub" aria-labelledby="ch-f2">
                <h3 class="ch__label" id="ch-f2">Subscribe</h3>
                <p class="ch__note">Four issues a year, posted in March, June, September and December. 56 € a year.</p>
                <ul class="ch__inline" role="list"><li><a href="#top" data-blink>Subscribe</a></li><li><a href="#top" data-blink>Give a year</a></li><li><a href="#top" data-blink>Back issues</a></li></ul>
              </section>
              <nav class="ch__col" aria-labelledby="ch-f3">
                <h3 class="ch__label" id="ch-f3">Sections</h3>
                <ul class="ch__list" role="list">${['Places', 'Architecture', 'Craft', 'Culture'].map((s) => html`<li><a href="#top" data-blink>${s}</a></li>`)}</ul>
              </nav>
              <nav class="ch__col" aria-labelledby="ch-f4">
                <h3 class="ch__label" id="ch-f4">Elsewhere</h3>
                <ul class="ch__list" role="list">${['Newsletter', 'Instagram', 'RSS'].map((s) => html`<li><a href="#top" data-blink>${s}</a></li>`)}</ul>
              </nav>
            </div>
            <p class="ch__base">
              <span class="ch__copy">© 2026 ${magazine.name}</span>
              <span class="ch__base-end">
                <button type="button" class="ch__credits-btn" data-credits aria-expanded="false" aria-controls="ch-credits" data-blink>Credits</button>
                <i aria-hidden="true">/</i>
                <a href="#top" data-up data-blink>Back to top</a>
              </span>
            </p>
          </div>
        </div>
      </div>

      <section class="ch__credits" id="ch-credits" data-panel aria-labelledby="ch-credits-title" inert>
        <div class="ch__credits-in ac-wrap">
          <h2 class="ch__credits-title" id="ch-credits-title" tabindex="-1">Credits</h2>
          <p class="ch__colophon">
            <strong>Editor</strong> ${editor} ·
            <strong>Words</strong> ${writers.join(', ')} ·
            <strong>Type</strong> Mona Sans and JetBrains Mono, headlines in Bodoni Moda
          </p>
          <div class="ch__pics">
            <h3 class="ch__pics-title">Pictures in this issue</h3>
            <ol class="ch__pic-list" role="list">
              ${stories.map((a, i) => {
                const c = splitCredit(pics[i]);
                return html`<li><strong>${a.title}</strong> ${c.work ? html`<span class="ch__work">${c.work} — </span>` : ''}${c.who}</li>`;
              })}
            </ol>
          </div>
          <button type="button" class="ch__close-btn" data-credits-close>Close credits</button>
        </div>
      </section>
    </footer>`;

  const sheet = root.querySelector('[data-sheet]');
  const rail = root.querySelector('[data-rail]');
  const stage = root.querySelector('[data-stage]');
  const stageContent = root.querySelector('[data-content]');
  const trigger = root.querySelector('[data-credits]');
  const panel = root.querySelector('[data-panel]');
  const title = panel.querySelector('h2');
  const closeBtn = panel.querySelector('[data-credits-close]');
  const up = root.querySelector('[data-up]');
  const brand = root.querySelector('[data-brand]');
  root.querySelectorAll('a[href^="#"]:not([data-up]), a[href^="mailto"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  // One clock: Lenis rides GSAP's ticker and feeds ScrollTrigger (full tier only; native scroll otherwise).
  const lenis = useLenis(ctx, { lerp: 0.12 });
  const { ScrollTrigger, context } = useGsap(ctx, root);
  const narrow = () => innerWidth <= NARROW;
  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  // Lenis re-measures first: the page can grow after it last measured (the wordmark's face arriving), and a stale
  // limit would stop the scroll short of the end, leaving the colophon's foot below the fold.
  const scrollToY = (y, smooth) => {
    if (!lenis) { window.scrollTo(0, y); return; }
    lenis.resize();
    lenis.scrollTo(y, smooth ? { duration: OPEN_SCROLL, easing: expoOut, force: true } : { immediate: true, force: true });
  };

  // The footer's room: the taller of the stage's content and the colophon. The lift: the colophon's own height,
  // plus a margin, plus what the tilt takes back at the corner that drops (half the stage's width × sin |tilt|).
  let room = -1;
  const measure = () => {
    const tilt = cfg.tilt * (narrow() ? 0.6 : 1);
    const ch = Math.ceil(stageContent.offsetHeight);
    const ph = Math.ceil(panel.offsetHeight);
    root.style.setProperty('--tilt', `${-tilt}deg`);
    root.style.setProperty('--lift', `${Math.ceil(ph + 24 + (stage.offsetWidth / 2) * Math.sin((tilt * Math.PI) / 180))}px`);
    const next = Math.max(ch, ph);
    if (next !== room) {
      room = next;
      root.style.setProperty('--room', `${room}px`);
      ScrollTrigger.refresh();
    }
  };
  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
  ctx.onCleanup(() => cancelAnimationFrame(raf));

  const apply = () => {
    root.style.setProperty('--rail', `${cfg.rail}svh`);
    root.style.setProperty('--lift-dur', `${cfg.liftDuration}s`);
    root.dataset.ground = cfg.stage;
  };
  apply();
  measure();
  observeResize(ctx, [stageContent, panel, stage], schedule);
  document.fonts?.ready.then(() => { if (!ctx.signal.aborted) { measure(); ScrollTrigger.refresh(); } });

  // Scrubs, full tier only: the sheet tips on its top-left corner from the moment the stage sticks (the rail's top
  // reaching the viewport's top: the sheet's top at `rail` % of the viewport) to the last pixel; the stage's content
  // rises the last 12 % as the sheet's foot clears the viewport. Linear: the scroll is the curve. A short rail on a
  // window taller than the footer would only stick at the last pixel, so the tip always gets at least 25svh of scroll.
  const tipStart = () => Math.min(rail.getBoundingClientRect().top + window.scrollY, maxScroll() - innerHeight * 0.25);
  if (full) {
    context.add(() => {
      gsap.to(sheet, {
        xPercent: () => (narrow() ? SHIFT.narrow.x : SHIFT.wide.x),
        yPercent: () => (narrow() ? SHIFT.narrow.y : SHIFT.wide.y),
        rotation: () => -cfg.tilt,
        ease: 'none',
        scrollTrigger: { trigger: rail, start: tipStart, end: 'max', scrub: true, invalidateOnRefresh: true },
      });
      gsap.fromTo(stageContent, { yPercent: 12 }, {
        yPercent: 0,
        ease: 'none',
        scrollTrigger: { trigger: sheet, start: 'bottom bottom', end: 'max', scrub: true, invalidateOnRefresh: true },
      });
    });
  }

  // The blink: registered effects, full tier only, mouse hover and keyboard focus (one step) and press (the ladder).
  const blink = (el, kind = 'blinkOnce') => {
    if (!full || !cfg.blink) return;
    gsap.killTweensOf(el);
    context.add(() => gsap.effects[kind](el));
  };
  root.querySelectorAll('[data-blink]').forEach((el) => {
    on(ctx, el, 'pointerenter', (e) => { if (e.pointerType === 'mouse') blink(el); });
    on(ctx, el, 'focus', () => { if (el.matches(':focus-visible')) blink(el); });
  });

  // Open and close.
  let open = false;
  let armedAt = null;
  let armTimer = 0;
  let movingFocus = false;
  ctx.onCleanup(() => clearTimeout(armTimer));
  const focusQuietly = (el, keyboard) => {
    movingFocus = true;
    el.focus({ preventScroll: true, focusVisible: keyboard });
    movingFocus = false;
  };

  // moveFocus: false for the toolbar's actions (focus stays where the visitor is) and for closes the page caused.
  function setOpen(next, { moveFocus = true, keyboard = false } = {}) {
    if (next === open) return;
    open = next;
    root.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
    clearTimeout(armTimer);
    armedAt = null;
    if (open) {
      measure();
      if (window.scrollY < maxScroll() - 2) scrollToY(maxScroll(), !ctx.capture);
      if (moveFocus) focusQuietly(title, keyboard);
      armTimer = setTimeout(() => { armedAt = window.scrollY; }, ARM * 1000);
    } else if (moveFocus) {
      focusQuietly(trigger, keyboard);
    }
  }

  on(ctx, trigger, 'click', (e) => { blink(trigger, 'blink'); setOpen(!open, { keyboard: e.detail === 0 }); });
  on(ctx, closeBtn, 'click', (e) => setOpen(false, { keyboard: e.detail === 0 }));
  on(ctx, document, 'keydown', (e) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false, { keyboard: true }); }
  });
  // A deliberate scroll after the arming delay puts the credits away; focus returns to Credits only when it was
  // inside the colophon (a closed colophon is inert, so focus would otherwise fall to the body).
  on(ctx, window, 'scroll', () => {
    if (!open || armedAt === null || Math.abs(window.scrollY - armedAt) <= SCROLL_CLOSE) return;
    setOpen(false, { moveFocus: panel.contains(document.activeElement) });
  }, { passive: true });

  // Keyboard focus never lands under the sheet or the open colophon: once the stage sticks its links count as in
  // view while the sheet still covers them, so keyboard focus in the stage jumps to the end first, and while the
  // credits are open (the lifted stage tucks its upper links under the sheet) it puts the credits away first.
  // Pointer focus and the focus this script moves are left alone.
  on(ctx, stageContent, 'focusin', (e) => {
    if (movingFocus || !e.target.matches(':focus-visible')) return;
    if (open) { setOpen(false, { moveFocus: false }); return; }
    if (window.scrollY < maxScroll() - 2) scrollToY(maxScroll(), false);
  });

  on(ctx, up, 'click', (e) => {
    e.preventDefault();
    setOpen(false, { moveFocus: false });
    if (lenis) lenis.scrollTo(0, { duration: 1.2, easing: expoOut, force: true });
    else window.scrollTo(0, 0);
    brand.focus({ preventScroll: true, focusVisible: e.detail === 0 });
  });

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      measure();
      if (full && changed.some((c) => c === 'tilt' || c === 'rail')) ScrollTrigger.refresh();
      return undefined;
    },
    action(id) {
      if (id === 'open') setOpen(true, { moveFocus: false });
      else if (id === 'close') setOpen(false, { moveFocus: false });
      else if (id === 'end') scrollToY(maxScroll(), !ctx.capture);
    },
  };
}
