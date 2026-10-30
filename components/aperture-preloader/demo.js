// Aperture preloader — Halden's first visit: one full-bleed project photograph and its title under a curtain. The
// curtain waits on real signals (the type and the photograph's decode, raced against a 4 s ceiling, no minimum hold),
// then lifts while the hero frame opens from a rounded clip-path inset to full bleed and the photograph scales in;
// the title follows. Scroll is locked and the hero inert for the gate and hand-off only. A sessionStorage flag skips
// it on repeat visits. Reduced: the curtain fades. Static: one cut once the signals land.
import './demo.css';
import { on, html, photo, image, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';

const KEY = 'halden:aperture';
const MAX_GATE_MS = 4000;
const OPEN = 'inset(0% round 0px)';
const seen = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = (on) => { try { if (on) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch { /* storage blocked: every visit is a first visit */ } };

export default function mount(root, options, ctx) {
  const { studio } = content;
  const [project] = studio.projects;
  // By id: a landscape building whose credit names no real place, so it can stand for the project.
  const hero = photo('arch-concrete-slab', { fallbackTags: ['architecture'] });
  let cfg = { ...options };
  root.className = 'ap';
  root.innerHTML = html`
    <section class="ap__hero" aria-labelledby="ap-title" data-page>
      <div class="ap__frame" data-frame>
        <div class="ap__media" data-media></div>
        <h1 class="ac-display ap__title ap__in" id="ap-title" tabindex="-1">${project.title}</h1>
      </div>
      <p class="ac-stage__note ac-stage__note--media"><span>${studio.name} · first visit</span></p>
    </section>
    <div class="ap__curtain" data-curtain hidden>
      <div class="ap__curtain-top">
        <span class="ac-brand">${studio.name}</span>
        <button class="ap__skip" type="button" data-skip>Skip intro</button>
      </div>
      <p class="ap__mark" aria-hidden="true">${studio.name}<br><span>Arkitekter</span></p>
      <ul class="ap__signals" role="list" aria-hidden="true"><li data-signal="type">Type</li><li data-signal="photo">Photograph</li></ul>
      <p class="sr-only" role="status" aria-live="polite" data-status></p>
    </div>
    <div class="ap__toast ac-card" data-toast hidden>
      <span>Seen this session, so the curtain stays down.</span>
      <button class="ac-btn ac-btn--sm" type="button" data-again>Play it again</button>
    </div>`;

  const page = root.querySelector('[data-page]');
  const curtain = root.querySelector('[data-curtain]');
  const frame = root.querySelector('[data-frame]');
  const media = root.querySelector('[data-media]');
  const copy = [...root.querySelectorAll('.ap__in')];
  const status = root.querySelector('[data-status]');
  const toast = root.querySelector('[data-toast]');
  const skipBtn = root.querySelector('[data-skip]');
  const signals = [...root.querySelectorAll('[data-signal]')];
  const { gsap } = useGsap(ctx, root);

  // The hero photograph. Its request is re-made on every intro (after the simulated latency) so the gate has
  // something real to wait for: its decode.
  const img = image(hero, { eager: true, sizes: '100vw', alt: `${project.title}, ${project.place}` });
  const source = { src: img.getAttribute('src'), srcset: img.getAttribute('srcset') };
  media.append(img);

  let runId = 0;
  let timers = [];
  let tl = null;
  const after = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const stop = () => { runId++; timers.forEach(clearTimeout); timers = []; tl?.kill(); tl = null; };
  ctx.onCleanup(stop);

  const lock = (gated) => {
    document.documentElement.classList.toggle('ap-gated', gated); // overflow hidden on the root: no wheel, touch or key scroll
    page.inert = gated;
  };
  const mark = (name) => {
    signals.find((s) => s.dataset.signal === name)?.classList.add('is-done');
    status.textContent = `${name === 'type' ? 'Type' : 'Photograph'} ready`;
  };

  const finish = () => {
    stop();
    const hadFocus = curtain.contains(document.activeElement);
    gsap.set([curtain, frame, media, ...copy], { clearProps: 'all' });
    curtain.hidden = true;
    lock(false);
    if (hadFocus) page.querySelector('h1').focus({ preventScroll: true });
    remember(true);
  };

  // The real signals, raced against a ceiling. No minimum hold: the curtain is up exactly as long as the page needs.
  const gate = (id) => {
    const live = (fn) => (v) => { if (id === runId) fn(v); };
    const type = (document.fonts?.ready || Promise.resolve()).then(live(() => mark('type')));
    const photo = new Promise((resolve) => after(() => {
      if (source.srcset) img.setAttribute('srcset', source.srcset);
      img.setAttribute('src', source.src);
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(resolve);
    }, ctx.capture ? 0 : cfg.latency)).then(live(() => mark('photo')));
    const ceiling = new Promise((resolve) => after(resolve, MAX_GATE_MS));
    return Promise.race([Promise.all([type, photo]), ceiling]);
  };

  const intro = () => {
    stop();
    const id = runId;
    toast.hidden = true;
    window.scrollTo(0, 0);
    lock(true);
    curtain.hidden = false;
    gsap.set([curtain, frame, media, ...copy], { clearProps: 'all' });
    signals.forEach((s) => s.classList.remove('is-done'));
    status.textContent = `Loading ${project.title}`;
    img.removeAttribute('srcset');
    img.removeAttribute('src');
    const mode = ctx.motion === 'static' ? 'cut' : ctx.motion === 'full' && window.scrollY < 2 ? 'aperture' : 'fade';
    if (mode === 'aperture') {
      // Start values under the curtain, so the closed window is never seen before the lift. The photo is never
      // smaller than the window, or the ground would show inside it.
      gsap.set(frame, { clipPath: `inset(${cfg.inset}% round ${cfg.radius}px)` });
      gsap.set(media, { scale: Math.max(cfg.scale, 1 - (2 * cfg.inset) / 100) });
      gsap.set(copy, { autoAlpha: 0, y: 24 });
    }
    gate(id).then(() => {
      if (id !== runId) return;
      status.textContent = `${project.title} is open`;
      if (mode === 'cut') { finish(); return; }
      tl = gsap.timeline({ onComplete: finish });
      if (mode === 'fade') { tl.to(curtain, { autoAlpha: 0, duration: 0.6, ease: 'power1.out' }); return; }
      const d = cfg.duration;
      tl.to(curtain, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' })
        .to(frame, { clipPath: OPEN, duration: d, ease: 'expo.inOut' }, 0.3)
        .to(media, { scale: 1, duration: d, ease: 'expo.inOut' }, 0.3)
        .to(copy, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.3 + d * 0.57);
      // The thumbnail: the window halfway open, held.
      if (ctx.capture) tl.pause(0.3 + d * 0.5);
    });
  };

  const replay = (focusSkip) => {
    remember(false);
    intro();
    if (focusSkip) skipBtn.focus();
  };
  on(ctx, skipBtn, 'click', finish);
  on(ctx, root.querySelector('[data-again]'), 'click', () => replay(true));
  ctx.onCleanup(() => document.documentElement.classList.remove('ap-gated'));

  if (cfg.repeat && seen() && !ctx.capture) {
    // Repeat visit in this session: no gate at all, the hero is simply open.
    img.decode?.().catch(() => {});
    toast.hidden = false;
  } else {
    intro();
  }

  return {
    update(next, changed) {
      cfg = { ...next };
      if (changed.some((k) => k !== 'repeat')) replay(false);
    },
    action(name) { if (name === 'replay') replay(false); },
  };
}
