// Docked media — an architecture studio's film, docked in the corner under a one-headline hero. The reel is laid out
// at its final box: a 100 svh section with the gutter as padding. While docked, the same box is position: fixed at
// inset: gutter and scaled down around its bottom corner, so that corner stays at the gutter corner at every scale.
// A linear scrub from the section's top at 85 % to top top grows it to scale 1; at that end the fixed box and the
// section box coincide and onLeave hands the reel back to the flow. Transform only; the radius is counter-scaled.
// Phones and reduced motion: no dock.
import './demo.css';
import { on, html, raw, photo, photos, videos, credit, imageHTML, whileVisible, content } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const DOCK_MAX = 0.32; // the docked card never exceeds this share of the final box
const DOCK_MEDIA = '(min-width: 700px)'; // below it a fixed card would cover a phone's content: the reel stays in the flow

export default function mount(root, options, ctx) {
  const { studio } = content;
  // The film: a clip from the shared set when one shows a building or water, else a still that drifts slowly.
  const named = photo('land-lake-reflection');
  const still = named.drawn ? photos({ tags: ['landscape'], count: 1, seed: 'dm-film' })[0] : named;
  const clip = videos.find((v) => v.tags?.some((t) => ['architecture', 'interior', 'water'].includes(t)));
  credit(clip);
  let cfg = { ...options };

  root.className = 'dm';
  root.innerHTML = html`
    <a class="dm__cue" href="#dm-film" data-cue hidden><span class="dm__cue-play" aria-hidden="true"></span>Watch the film <span class="dm__cue-time ac-num">2:40</span></a>

    <section class="dm__hero ac-wrap" aria-labelledby="dm-title">
      <h1 class="ac-display" id="dm-title">${studio.tagline}</h1>
      <a class="dm__inline-cue" href="#dm-film" data-inline-cue><span class="dm__cue-play" aria-hidden="true"></span>Watch the film <span class="dm__cue-time ac-num">2:40</span></a>
    </section>

    <section class="dm__film" id="dm-film" data-section aria-labelledby="dm-film-title">
      <div class="dm__reel" data-reel>
        <div class="dm__media">
          ${clip
            ? raw(`<video muted playsinline loop preload="metadata" poster="${clip.poster || ''}" src="${clip.src}" aria-hidden="true"></video>`)
            : raw(imageHTML(still, { sizes: '100vw', alt: '' }))}
        </div>
        <div class="dm__over" data-over>
          <h2 class="dm__film-title" id="dm-film-title">Fjordhus, one winter</h2>
          <button class="dm__pause" type="button" data-pause aria-pressed="false"><span class="dm__pause-icon" aria-hidden="true"></span><span data-pause-label>Pause</span></button>
        </div>
      </div>
    </section>

    <section class="dm__outro ac-wrap" aria-label="After the film">
      <p class="ac-h1">Have a site in mind? Start with a walk around it.</p>
    </section>`;

  const section = root.querySelector('[data-section]');
  const reel = root.querySelector('[data-reel]');
  const over = root.querySelector('[data-over]');
  const cue = root.querySelector('[data-cue]');
  const video = root.querySelector('video');
  const pauseBtn = root.querySelector('[data-pause]');
  const pauseLabel = root.querySelector('[data-pause-label]');

  // The film plays only while on screen, not paused by the visitor, and only in the full tier.
  let userPaused = ctx.motion !== 'full';
  let visible = false;
  const sync = () => {
    const playing = visible && !userPaused;
    root.classList.toggle('dm--playing', playing);
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseLabel.textContent = userPaused ? 'Play' : 'Pause';
    if (video) { if (playing) video.play().catch(() => {}); else video.pause(); }
  };
  on(ctx, pauseBtn, 'click', () => { userPaused = !userPaused; sync(); });
  whileVisible(ctx, reel, () => { visible = true; sync(); }, () => { visible = false; sync(); });
  sync();

  const apply = () => {
    root.dataset.corner = cfg.corner;
    root.style.setProperty('--dm-radius', `${cfg.radius}px`);
  };
  apply();

  const lenis = useLenis(ctx);
  if (ctx.motion !== 'full') {
    on(ctx, root.querySelector('[data-inline-cue]'), 'click', (e) => { e.preventDefault(); section.scrollIntoView(); });
    return { update(next) { cfg = { ...next }; apply(); } };
  }

  const { gsap, ScrollTrigger } = useGsap(ctx, root);
  // reel.offsetWidth is the layout box, which ignores transforms: safe at any point of the scrub.
  const dockScale = () => Math.min(DOCK_MAX, cfg.dock / Math.max(1, reel.offsetWidth));
  const setDocked = (docked) => root.classList.toggle('dm--docked', docked);
  // Counter-scale the radius, and fade a lift shadow out as the card reaches its section.
  let s0 = 1;
  const radius = () => {
    const s = Number(gsap.getProperty(reel, 'scale')) || 1;
    reel.style.borderRadius = `${(cfg.radius / s).toFixed(2)}px`;
    reel.style.setProperty('--s', s.toFixed(4));
    reel.style.setProperty('--lift', s0 < 1 ? ((1 - s) / (1 - s0)).toFixed(3) : '0');
  };

  let mm = null;
  const build = () => {
    mm?.revert();
    mm = gsap.matchMedia();
    mm.add(DOCK_MEDIA, () => {
      cue.hidden = false;
      root.classList.add('dm--live');
      setDocked(true);
      const tl = gsap.timeline({
        defaults: { ease: 'none' }, // scrubbed: linear, the smoothing is Lenis'
        scrollTrigger: {
          trigger: section,
          start: `top ${cfg.start}%`,
          end: 'top top', // the section's top reaches the viewport's: fixed box = section box
          scrub: true, // no catch-up, so the hand-off at the end lands on scale 1 exactly
          invalidateOnRefresh: true,
          onRefresh: (self) => setDocked(self.progress < 1),
          onLeave: () => setDocked(false),
          onEnterBack: () => setDocked(true),
        },
      });
      s0 = dockScale();
      tl.fromTo(reel, { scale: dockScale }, { scale: 1, duration: 1, onUpdate: radius }, 0)
        .to(cue, { autoAlpha: 0, duration: 0.15 }, 0)
        .fromTo(over, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, 0.75);
      radius();
      return () => { cue.hidden = true; root.classList.remove('dm--live'); setDocked(false); reel.style.borderRadius = ''; reel.style.removeProperty('--lift'); };
    });
  };
  build();
  ctx.onCleanup(() => mm?.revert());

  const goToFilm = (e) => {
    e.preventDefault();
    if (lenis) lenis.scrollTo(section, { duration: 1.2 }); else section.scrollIntoView();
  };
  on(ctx, cue, 'click', goToFilm);
  on(ctx, root.querySelector('[data-inline-cue]'), 'click', goToFilm);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  on(ctx, window, 'load', () => ScrollTrigger.refresh());

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('start') || changed.includes('dock')) build();
      else radius();
      ScrollTrigger.refresh();
      return undefined;
    },
  };
}
