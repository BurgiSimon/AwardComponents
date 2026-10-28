// Art-directed hero — an architecture studio's first screen. A <picture> carries two compositions: a portrait
// source below 48rem and a wide image above it, so the browser picks the crop with no script. Each layout asks for
// the composition its frame needs (overlay and stacked: wide; split and every phone: portrait). object-position
// pins the subject's focal point, and in the overlay the copy moves to the quiet side of the picture behind a
// gradient scrim. Copy and actions come first in the DOM and on screen at every size. Nothing moves.
import './demo.css';
import { on, html, escapeHTML, photos, content } from '../../src/demo-kit/index.js';

const SIZES = { overlay: '100vw', split: '(max-width: 47.999rem) 100vw, 50vw', stacked: '(max-width: 47.999rem) 100vw, 92vw' };
const srcset = (p) => (p.drawn ? p.src : `${p.srcSm} ${p.smWidth || 640}w, ${p.src} ${p.width || 1800}w`);

export default function mount(root, options, ctx) {
  const { studio } = content;
  const [wide] = photos({ tags: ['architecture'], orientation: 'landscape', count: 1, seed: 'adh-wide' });
  const [tall] = photos({ tags: ['architecture'], orientation: 'portrait', count: 1, seed: 'adh-tall' });
  const project = studio.projects[0];
  let cfg = { ...options };

  // The picture for a layout: split frames are portrait at every size, the others switch at 48rem.
  const picture = (layout) => {
    const main = layout === 'split' ? tall : wide;
    const source = layout === 'split' ? '' : `<source media="(max-width: 47.999rem)" srcset="${srcset(tall)}" sizes="100vw" width="${tall.width}" height="${tall.height}">`;
    const alt = escapeHTML(main.alt || `${project.title}, ${project.summary.toLowerCase()}`);
    return `<picture>${source}<img src="${main.src}" srcset="${srcset(main)}" sizes="${SIZES[layout]}" width="${main.width}" height="${main.height}" alt="${alt}" fetchpriority="high" decoding="async"></picture>`;
  };

  root.className = 'adh';
  root.innerHTML = html`
    <header class="ac-bar adh__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n) => html`<a href="#top">${n}</a>`)}</nav>
    </header>
    <section class="adh__hero" aria-labelledby="adh-title">
      <div class="adh__copy">
        <p class="ac-label adh__kicker">${studio.full} — ${studio.city}</p>
        <h1 class="adh__title" id="adh-title">${studio.tagline}</h1>
        <p class="adh__lede">An architecture and interiors studio of fourteen in a former net loft on the harbour. Six projects a year, from cabins to libraries.</p>
        <div class="adh__actions">
          <a class="ac-btn ac-btn--accent ac-btn--lg" href="#work">See the work</a>
          <a class="ac-btn ac-btn--ghost ac-btn--lg adh__ghost" href="#top">Start a project</a>
        </div>
      </div>
      <figure class="adh__media">
        <div class="adh__frame" data-frame></div>
        <span class="adh__focus" aria-hidden="true"></span>
        <figcaption class="ac-label adh__cap">${project.title} · ${project.place.replace(', NO', '')}, ${project.year}</figcaption>
      </figure>
    </section>
    <section class="adh__index ac-wrap" id="work" aria-label="Selected work">
      ${studio.projects.slice(1, 4).map((p, i) => html`<a class="adh__row" href="#top"><span class="ac-label">0${i + 2}</span><strong>${p.title}</strong><span>${p.place}</span><span class="ac-num">${p.year}</span></a>`)}
    </section>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const frame = root.querySelector('[data-frame]');
  let shown = '';

  const apply = () => {
    if (shown !== cfg.layout) { frame.innerHTML = picture(cfg.layout); shown = cfg.layout; }
    root.dataset.layout = cfg.layout;
    // The copy goes where the subject is not: left of a subject on the right, right of one on the left, else low.
    root.dataset.side = cfg.focusX > 56 ? 'left' : cfg.focusX < 44 ? 'right' : 'bottom';
    root.style.setProperty('--fx', `${cfg.focusX}%`);
    root.style.setProperty('--fy', `${cfg.focusY}%`);
    root.style.setProperty('--scrim', String(cfg.scrim / 100));
    root.classList.toggle('adh--marks', cfg.marks);
  };
  apply();

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
  };
}
