// Motion preference switch — a festival site's motion setting (Follow system, Full, Reduced, Static) in a native
// popover, beside a small sample that obeys it: the headline's line reveal and the line-up ticker. One function
// answers the tier: the visitor's saved choice wins, "Follow system" hands it back to the system setting (ctx.motion
// here; prefers-reduced-motion on a real site). Every effect is built inside one gsap.context for that tier and
// reverted, with its ticker subscription, before the next tier applies, so tiers never stack. Full: line reveals
// (yPercent 110 → 0, 1.2 s expo.out, stagger .1) and a 60 px/s line-up ticker that pauses off-screen. Reduced: fades
// only (.4 s). Static: end states. On a real site the tier lives on <html data-motion>; inside the library frame it
// sits on the demo's root.
import './demo.css';
import { gsap } from '../../src/demo-kit/gsap.js';
import { on, ticker, observeIntersection, html, raw, content } from '../../src/demo-kit/index.js';

const KEY = 'signal:motion';
const TIERS = [
  { id: 'system', name: 'Follow system', note: '' },
  { id: 'full', name: 'Full', note: 'Reveals and the line-up ticker, as designed.' },
  { id: 'reduced', name: 'Reduced', note: 'Nothing travels across the screen. Fades and state changes stay.' },
  { id: 'static', name: 'Static', note: 'Everything settled on load. Nothing runs on a clock.' },
];
const NAMES = { full: 'Full', reduced: 'Reduced', static: 'Static' };
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* storage blocked: the choice lasts this visit */ } };
const forget = () => { try { localStorage.removeItem(KEY); } catch { /* nothing stored */ } };
const BARS = raw('<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h9M3 10h14M3 14h6"/><circle cx="15" cy="6" r="1.6"/><circle cx="12" cy="14" r="1.6"/></svg>');

export default function mount(root, options, ctx) {
  const { festival } = content;
  let cfg = { ...options };
  const trigger = (where) => html`<button class="ms__trigger ms__trigger--${where}" type="button" popovertarget="ms-pop" data-trigger>${BARS}<span class="ms__trigger-k">Motion</span><span class="ms__trigger-v" data-tier-label>Full</span></button>`;

  root.className = 'ms';
  root.innerHTML = html`
    <section class="ac-stage ms__stage" aria-label="${festival.name} site settings">
      <div class="ms__corner">${trigger('header')}</div>
      <div class="ms__sample">
        <h1 class="ms__title"><span class="ms__mask"><span class="ms__line">Three days</span></span> <span class="ms__mask"><span class="ms__line">on the</span></span> <span class="ms__mask"><span class="ms__line">harbour.</span></span></h1>
        <div class="ms__band" aria-label="Line-up" role="group" data-band>
          <div class="ms__marquee" aria-hidden="true"><div class="ms__track" data-track>${[0, 1].map(() => html`<span class="ms__copyset">${festival.lineup.map((n) => html`<span>${n}</span><i>✶</i>`)}</span>`)}</div></div>
          <p class="sr-only">Line-up: ${festival.lineup.join(', ')}.</p>
        </div>
      </div>
      <p class="ac-stage__note"><span>${festival.name} · site settings</span></p>
    </section>
    <div class="ms__dock">${trigger('footer')}<span class="ac-small">${festival.edition}</span></div>
    <div class="ms__pop" id="ms-pop" popover data-pop>
      <fieldset class="ms__set">
        <legend class="ms__legend">Motion</legend>
        <p class="ac-small ms__hint" data-hint>How much this site moves. Saved on this device.</p>
        ${TIERS.map((t) => html`<label class="ms__opt" data-opt="${t.id}"><input type="radio" name="ms-tier" value="${t.id}"><span class="ms__radio" aria-hidden="true"></span><span class="ms__opt-copy"><strong>${t.name}</strong><span${t.id === 'system' ? raw(' data-system-note') : ''}>${t.note}</span></span></label>`)}
      </fieldset>
    </div>
    <p class="sr-only" aria-live="polite" data-announce></p>`;

  const $ = (s) => root.querySelector(s);
  const pop = $('[data-pop]');
  const radios = [...root.querySelectorAll('input[name="ms-tier"]')];
  const lines = [...root.querySelectorAll('.ms__line')];
  const track = $('[data-track]');
  const announce = $('[data-announce]');
  const systemTier = ctx.motion; // what the system asks for (the preview toolbar or the OS)
  $('[data-system-note]').textContent = `Your device asks for ${NAMES[systemTier].toLowerCase()} motion right now.`;

  // The choice: saved, else the first-visit default. Without "Follow system" it pins whatever the system asks.
  let choice = (cfg.remember && read()) || cfg.start;
  const legal = (c) => (TIERS.some((t) => t.id === c) ? c : 'system');
  const tier = () => (choice === 'system' ? systemTier : choice);

  // 1. The one function: every effect for a tier is made inside one context and torn down before the next.
  let g = null;
  let ticking = false;
  let bandVisible = false;
  let x = 0;
  let half = 0;
  const marquee = (dt) => {
    if (!half) half = track.scrollWidth / 2;
    x = (x - 60 * dt) % half;
    track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
  };
  const syncTicker = () => {
    const want = root.dataset.tier === 'full' && bandVisible;
    if (want && !ticking) { ticking = true; ticker.add(marquee); }
    if (!want && ticking) { ticking = false; ticker.remove(marquee); }
    if (root.dataset.tier !== 'full') track.style.transform = '';
  };
  observeIntersection(ctx, $('[data-band]'), ([e]) => { bandVisible = e.isIntersecting; syncTicker(); });
  ctx.onCleanup(() => { g?.revert(); if (ticking) ticker.remove(marquee); });

  const build = (t, replay) => {
    g?.revert();
    root.dataset.tier = t;
    g = gsap.context(() => {
      if (t === 'full') {
        if (replay) gsap.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 });
      } else if (t === 'reduced') {
        if (replay) gsap.fromTo(lines, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.05 });
      }
      // static: nothing is created; every element is already in its end state.
    }, root);
    syncTicker();
  };

  const reflect = () => {
    const t = tier();
    root.querySelectorAll('[data-tier-label]').forEach((el) => { el.textContent = choice === 'system' ? `Auto · ${NAMES[t]}` : NAMES[t]; });
    radios.forEach((r) => { r.checked = r.value === choice; });
    $('[data-opt="system"]').hidden = !cfg.system;
    $('[data-hint]').textContent = cfg.remember ? 'How much this site moves. Saved on this device.' : 'How much this site moves, for this visit.';
  };
  const choose = (next, { replay = true, say = true } = {}) => {
    choice = legal(next);
    if (!cfg.system && choice === 'system') choice = systemTier;
    if (cfg.remember) write(choice);
    const before = root.dataset.tier;
    reflect();
    build(tier(), replay || before !== tier());
    if (say) announce.textContent = `Motion: ${NAMES[tier()]}${choice === 'system' ? ', following your system' : ''}.`;
  };

  const apply = () => {
    root.classList.toggle('ms--footer', cfg.placement === 'footer');
    reflect();
  };
  apply();
  choose(choice, { say: false });

  radios.forEach((r) => on(ctx, r, 'change', () => { if (r.checked) choose(r.value); }));
  const close = () => { try { pop.hidePopover(); } catch { /* not open */ } };
  on(ctx, window, 'resize', () => { half = 0; });
  ctx.onCleanup(close);

  return {
    update(next, changed) {
      const was = cfg;
      cfg = { ...next };
      apply();
      if (changed.includes('remember') && !cfg.remember) forget();
      if (changed.includes('start')) choose(cfg.start);
      else if (changed.includes('system') && !cfg.system && choice === 'system') choose(systemTier, { replay: false });
      else if (changed.includes('remember') && cfg.remember && !was.remember) write(choice);
    },
    action(id) {
      if (id === 'open') { try { pop.showPopover(); } catch { /* already open or unsupported */ } }
    },
  };
}
