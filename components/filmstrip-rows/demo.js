// Filmstrip rows — Halden's project index: each project is one self-moving strip of its photographs, caption beside
// it. The strips are CSS keyframe loops, but each row's duration is computed from its measured width
// (duration = one copy's width / 70 px/s), so a row of four frames and a row of eight travel at the same speed and
// the page reads as one system. A row pauses on hover, on focus inside it and off-screen, and its reel grows 1.2×
// on a late, overshooting curve. One link per project; the frames are aria-hidden decoration. A short clip mounts
// on hover only when the shared set has videos, the pointer can hover and the motion tier is full.
// Reduced and static: every reel at rest, nothing grows.
import './demo.css';
import { on, html, raw, photo, photos, videos, observeIntersection, observeResize, finePointer, content } from '../../src/demo-kit/index.js';

// Each project's frames: tag lists tried in order, and how many frames its strip holds (rows differ on purpose).
const FRAMES = {
  fjordhus: { tags: [['architecture'], ['landscape']], count: 6 },
  'tern-library': { tags: [['architecture'], ['interior']], count: 8 },
  stillwater: { tags: [['water'], ['architecture']], count: 5 },
  'kiln-house': { tags: [['interior'], ['ceramic']], count: 7 },
  'granite-court': { tags: [['city'], ['architecture']], count: 6 },
  'low-light': { tags: [['interior', 'dark'], ['night'], ['interior']], count: 4 },
  saltworks: { tags: [['landscape'], ['architecture']], count: 7 },
  'arc-chair': { tags: [['furniture'], ['object']], count: 5 },
};
const RATIOS = [1.5, 0.8, 1.78, 1, 1.33, 0.75, 1.5, 0.8];   // stand-in frames (drawn fields) take these shapes

function framesFor(slug, i) {
  const spec = FRAMES[slug] || { tags: [['architecture']], count: 6 };
  const out = [];
  const seen = new Set();
  for (const tags of spec.tags) {
    for (const p of photos({ tags, count: spec.count, seed: `fr-${slug}-${tags.join('-')}` })) {
      if (out.length < spec.count && !p.drawn && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
    }
  }
  for (let k = out.length; k < spec.count; k++) out.push(photo(`fr-${slug}-${k}`));   // unknown id → a drawn field
  return out.map((p, k) => ({ p, r: p.drawn ? RATIOS[(k + i) % RATIOS.length] : Math.min(1.8, Math.max(0.66, (p.width || 4) / (p.height || 3))) }));
}

const still = ({ p, r }) => `<span class="fr__still" style="--r:${r.toFixed(3)}"><img src="${p.srcSm || p.src}" alt="" decoding="async" draggable="false" style="object-position:${p.focus || '50% 50%'}"></span>`;

export default function mount(root, options, ctx) {
  const { studio } = content;
  const projects = studio.projects.slice(0, 6);
  let cfg = { ...options };
  const full = ctx.motion === 'full';

  root.className = `fr${full ? '' : ' fr--still'}`;
  root.innerHTML = html`
    <header class="ac-bar fr__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n, i) => html`<a href="#${n.toLowerCase()}"${i === 0 ? raw(' aria-current="page"') : ''}>${n}</a>`)}</nav>
    </header>
    <section class="fr__intro ac-wrap" aria-labelledby="fr-title">
      <h1 class="ac-h1" id="fr-title">Selected work</h1>
      <p class="fr__count ac-label">${String(projects.length).padStart(2, '0')} projects · 2024–2026 · ${studio.city}</p>
    </section>
    <ol class="fr__rows" role="list" aria-labelledby="fr-title">
      ${projects.map((p, i) => html`
        <li class="fr__row" data-row>
          <p class="fr__cap">
            <a href="#${p.slug}">
              <span class="fr__n ac-label">${String(i + 1).padStart(2, '0')} — ${p.discipline}</span>
              <span class="fr__name">${p.title}</span>
              <span class="fr__line">${p.summary}</span>
              <span class="fr__info ac-label">${p.place} · ${p.year}<span class="fr__view"> · View project</span></span>
            </a>
          </p>
          <div class="fr__reel" aria-hidden="true"><div class="fr__grow"><div class="fr__track" data-track>${raw(framesFor(p.slug, i).map(still).join('').repeat(2))}</div></div></div>
        </li>`)}
    </ol>
    <footer class="fr__foot ac-wrap"><a class="ac-link" href="#archive">The full archive, 1998–2026</a><span class="ac-small">${studio.address.join(', ')}</span></footer>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  // The reel holds two copies; every still carries its gap as margin, so two copies are exactly twice one and the
  // −50 % keyframe wraps without a seam.
  const rows = [...root.querySelectorAll('[data-row]')].map((li) => ({ li, track: li.querySelector('[data-track]'), reel: li.querySelector('.fr__grow'), reasons: new Set(), visible: false, video: null }));

  const apply = () => {
    root.style.setProperty('--fr-h', `${cfg.height}px`);
    root.style.setProperty('--fr-grow', String(cfg.grow));
    root.classList.toggle('fr--alternate', cfg.alternate);
    rows.forEach(measure);
  };
  // Set the speed, not the duration: duration = one copy's measured width / px per second.
  function measure(row) {
    const copy = row.track.offsetWidth / 2;   // offsetWidth ignores the hover scale
    if (copy) row.track.style.setProperty('--dur', `${(copy / cfg.speed).toFixed(3)}s`);
  }
  function pause(row, reason, yes) {
    if (yes) row.reasons.add(reason); else row.reasons.delete(reason);
    row.li.toggleAttribute('data-paused', row.reasons.size > 0);   // CSS: animation-play-state: paused
  }

  // A real clip on hover, mounted only where it can be used: shared videos exist, a hovering pointer, full motion,
  // an on-screen row. Without videos the stills stand in, as they do on touch screens.
  const clipFor = (i) => videos[i % Math.max(1, videos.length)];
  function syncVideo(row, i) {
    const want = videos.length > 0 && row.visible && finePointer() && full;
    if (want && !row.video) {
      const v = document.createElement('video');
      Object.assign(v, { muted: true, playsInline: true, loop: true, preload: 'none', src: clipFor(i).src, poster: clipFor(i).poster || '' });
      v.className = 'fr__clip';
      row.reel.append(v);
      row.video = v;
    } else if (!want && row.video) {
      row.video.pause();
      row.video.remove();
      row.video = null;
    }
  }

  rows.forEach((row, i) => {
    // Hover is a mouse or pen state; a tap never sticks a row in its grown, paused state.
    on(ctx, row.li, 'pointerenter', (e) => { if (e.pointerType === 'touch') return; row.li.classList.add('is-hover'); pause(row, 'hover', true); row.video?.play().catch(() => {}); });
    on(ctx, row.li, 'pointerleave', (e) => { if (e.pointerType === 'touch') return; row.li.classList.remove('is-hover'); pause(row, 'hover', false); row.video?.pause(); });
    on(ctx, row.li, 'focusin', () => pause(row, 'focus', true));
    on(ctx, row.li, 'focusout', () => pause(row, 'focus', false));
  });
  // Off-screen rows stop: no compositor work for reels nobody sees.
  observeIntersection(ctx, rows.map((r) => r.li), (entries) => {
    for (const e of entries) {
      const i = rows.findIndex((r) => r.li === e.target);
      rows[i].visible = e.isIntersecting;
      pause(rows[i], 'offscreen', !e.isIntersecting);
      syncVideo(rows[i], i);
    }
  });
  ctx.onCleanup(() => rows.forEach((r) => { r.video?.pause(); r.video?.remove(); }));

  apply();
  observeResize(ctx, root.querySelector('.fr__rows'), () => rows.forEach(measure));

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
  };
}
