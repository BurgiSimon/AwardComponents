// Drawn path — an architecture studio's fifty-year timeline: a year, a name and a picture per stop. One SVG path is
// generated through the milestones' markers (measured from the DOM on load and resize, so it passes through each at
// any width). Its dash array equals its length and the dash offset is scrubbed from that length to 0, linear, from
// the section's top at 70 % to its bottom at the bottom; each milestone lights up when the drawn length passes its
// point. Dashed and dotted lines keep their own pattern and are revealed through a solid masked copy instead.
// Reduced motion: drawn and lit.
import './demo.css';
import { on, html, raw, colour, photos, imageHTML, content, observeResize } from '../../src/demo-kit/index.js';
import { useGsap } from '../../src/demo-kit/gsap.js';
import { useLenis } from '../../src/demo-kit/lenis.js';

const SVGNS = 'http://www.w3.org/2000/svg';

export default function mount(root, options, ctx) {
  const { studio } = content;
  const tern = studio.projects.find((p) => p.slug === 'tern-library');
  const MILESTONES = [
    { year: 1976, title: 'The boathouse', tags: ['interior'] },
    { year: 1989, title: 'Ask School', tags: ['architecture'] },
    { year: 2003, title: 'Nordnes Sea Bath', tags: ['water'] },
    { year: 2014, title: 'Utne Ferry Terminal', tags: ['landscape'] },
    { year: tern.year, title: tern.title, tags: tern.tags },
  ];
  const shots = MILESTONES.map((m, i) => photos({ tags: m.tags, count: 1, seed: `dp-${i}` })[0]);
  const maskId = `dp-mask-${Math.random().toString(36).slice(2, 8)}`;
  let cfg = { ...options };

  root.className = 'dp';
  root.innerHTML = html`
    <section class="dp__route ac-wrap" data-route aria-labelledby="dp-title">
      <h1 class="sr-only" id="dp-title">${studio.name}, 1976 to ${tern.year}</h1>
      <svg class="dp__svg" data-svg aria-hidden="true" focusable="false">
        <defs><mask id="${maskId}" maskUnits="userSpaceOnUse"><path class="dp__mask-path" data-mask-path fill="none" stroke="#fff" stroke-linecap="round"/></mask></defs>
        <path class="dp__ghost" data-ghost/>
        <path class="dp__line" data-line/>
        <path class="dp__measure" data-measure/>
        <circle class="dp__tip" data-tip r="5"/>
      </svg>
      <ol class="dp__list" role="list">
        ${MILESTONES.map((m, i) => html`
          <li class="dp__item" data-item data-side="${i % 2 ? 'right' : 'left'}">
            <span class="dp__marker" data-marker aria-hidden="true"><span>${m.year}</span></span>
            <p class="dp__year" aria-hidden="true">${m.year}</p>
            <article class="dp__card">
              <span class="ac-media dp__media">${raw(imageHTML(shots[i], { sizes: '(max-width: 760px) 86vw, 40vw', alt: '' }))}</span>
              <h2 class="ac-h3"><span class="sr-only">${m.year}: </span>${m.title}</h2>
            </article>
          </li>`)}
      </ol>
    </section>`;

  const route = root.querySelector('[data-route]');
  const svg = root.querySelector('[data-svg]');
  const ghost = root.querySelector('[data-ghost]');
  const line = root.querySelector('[data-line]');
  const maskPath = root.querySelector('[data-mask-path]');
  const measure = root.querySelector('[data-measure]');
  const tip = root.querySelector('[data-tip]');
  const markers = [...root.querySelectorAll('[data-marker]')];
  const items = [...root.querySelectorAll('[data-item]')];

  // Geometry: a point per marker (centre, in the route's own px), joined by cubics with vertical tangents, so the
  // line leaves and enters each marker straight down and swings across the gap between milestones.
  let total = 1;
  let marks = []; // cumulative length at each marker
  let progress = ctx.motion === 'full' ? 0 : 1;
  const build = () => {
    const box = route.getBoundingClientRect();
    if (!box.width) return;
    svg.setAttribute('viewBox', `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
    const pts = markers.map((m) => { const r = m.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; });
    const start = [pts[0][0], Math.max(0, pts[0][1] - 120)];
    const all = [start, ...pts];
    let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
    let acc = 0;
    marks = [];
    for (let i = 1; i < all.length; i++) {
      const [x0, y0] = all[i - 1];
      const [x1, y1] = all[i];
      const k = (y1 - y0) / 2;
      const seg = `C${x0.toFixed(1)} ${(y0 + k).toFixed(1)} ${x1.toFixed(1)} ${(y1 - k).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      measure.setAttribute('d', `M${x0} ${y0}${seg}`);
      acc += measure.getTotalLength();
      marks.push(acc);
      d += seg;
    }
    [ghost, line, maskPath].forEach((p) => p.setAttribute('d', d));
    total = line.getTotalLength() || acc || 1;
    style();
    render(progress);
  };

  // Look: solid lines are drawn by their own dash offset (the recipe); dashed and dotted keep their pattern and are
  // revealed by the masked solid copy.
  const style = () => {
    root.style.setProperty('--dp-colour', colour(cfg.colour));
    root.style.setProperty('--dp-stroke', `${cfg.stroke}px`);
    root.dataset.markers = cfg.markers;
    const s = cfg.stroke;
    if (cfg.dash === 'solid') {
      line.removeAttribute('mask');
      line.style.strokeDasharray = `${total} ${total}`;
      line.style.strokeLinecap = 'round';
    } else {
      line.setAttribute('mask', `url(#${maskId})`);
      line.style.strokeDasharray = cfg.dash === 'dashed' ? `${s * 4} ${s * 3}` : `0 ${s * 3}`;
      line.style.strokeDashoffset = '0';
      line.style.strokeLinecap = cfg.dash === 'dotted' ? 'round' : 'butt';
      maskPath.style.strokeDasharray = `${total} ${total}`;
      maskPath.style.strokeWidth = `${s + 8}px`;
    }
  };

  let lit = -1;
  const render = (p) => {
    progress = p;
    const drawn = p * total;
    if (cfg.dash === 'solid') line.style.strokeDashoffset = String(total - drawn);
    else maskPath.style.strokeDashoffset = String(total - drawn);
    const on = p > 0.001 && p < 0.999 && ctx.motion === 'full';
    tip.style.opacity = on ? '1' : '0';
    if (on) { const pt = line.getPointAtLength(drawn); tip.setAttribute('cx', pt.x.toFixed(1)); tip.setAttribute('cy', pt.y.toFixed(1)); }
    const count = marks.filter((m) => m <= drawn + 1).length;
    if (count !== lit) { lit = count; items.forEach((it, i) => it.classList.toggle('is-lit', i < count)); }
  };

  build();
  observeResize(ctx, route, build);
  document.fonts?.ready.then(build);
  root.querySelectorAll('img').forEach((img) => on(ctx, img, 'load', build, { once: true }));

  useLenis(ctx);
  if (ctx.motion !== 'full') {
    root.classList.add('dp--still');
    render(1);
    return { update(next) { cfg = { ...next }; style(); render(1); } };
  }

  const { gsap, ScrollTrigger, context } = useGsap(ctx, root);
  const state = { p: 0 };
  let tween = null;
  const arm = () => {
    if (tween) { tween.scrollTrigger?.kill(); tween.kill(); }
    tween = context.add(() => gsap.to(state, {
      p: 1,
      ease: 'none', // the reading pace is the easing
      onUpdate: () => render(state.p),
      scrollTrigger: { trigger: route, start: 'top 70%', end: 'bottom bottom', scrub: cfg.scrub > 0 ? cfg.scrub : true, invalidateOnRefresh: true },
    }));
  };
  arm();
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return {
    update(next, changed) {
      cfg = { ...next };
      style();
      render(progress);
      if (changed.includes('scrub')) arm();
      if (changed.includes('markers')) requestAnimationFrame(build);
      return undefined;
    },
  };
}
