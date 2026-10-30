// Art-directed hero — an architecture studio's first screen cut to the picture and one headline. A <picture>
// carries two compositions: a portrait source below 48rem and a wide image above it, so the browser picks the crop
// with no script. Each layout asks for the composition its frame needs (overlay and stacked: wide; split and every
// phone: portrait), and a small crop label names the one on screen. object-position pins the subject's focal point,
// and in the overlay the headline moves to the quiet side of the picture behind a gradient scrim. The headline
// comes first in the DOM and on screen at every size. Nothing moves.
import './demo.css';
import { html, escapeHTML, photos, content } from '../../src/demo-kit/index.js';

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
    <section class="adh__hero" aria-labelledby="adh-title">
      <div class="adh__copy">
        <h1 class="adh__title" id="adh-title">${studio.tagline}</h1>
      </div>
      <figure class="adh__media">
        <div class="adh__frame" data-frame></div>
        <span class="adh__focus" aria-hidden="true"></span>
        <span class="ac-label adh__cap" aria-hidden="true"><span class="adh__crop-wide">Wide composition</span><span class="adh__crop-tall">Portrait composition</span></span>
      </figure>
      <p class="ac-stage__note adh__note"><span>${studio.name} · home hero</span></p>
    </section>`;

  const frame = root.querySelector('[data-frame]');
  const note = root.querySelector('.adh__note');
  let shown = '';

  const apply = () => {
    if (shown !== cfg.layout) { frame.innerHTML = picture(cfg.layout); shown = cfg.layout; }
    root.dataset.layout = cfg.layout;
    // The headline goes where the subject is not: left of a subject on the right, right of one on the left, else low.
    root.dataset.side = cfg.focusX > 56 ? 'left' : cfg.focusX < 44 ? 'right' : 'bottom';
    root.style.setProperty('--fx', `${cfg.focusX}%`);
    root.style.setProperty('--fy', `${cfg.focusY}%`);
    root.style.setProperty('--scrim', String(cfg.scrim / 100));
    root.classList.toggle('adh--marks', cfg.marks);
    note.classList.toggle('ac-stage__note--media', cfg.layout === 'overlay');
  };
  apply();

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
  };
}
