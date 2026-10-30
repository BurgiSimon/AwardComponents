// Designed 404 — Halden's not-found page. One plain title in the studio's voice says what happened, and the way
// back comes first in the DOM: the front page, three named routes and a search. Beside it, a small CSS-only scene
// plays once without holding anything up: two drafted fours stand on a fjord's horizon and the zero between them is
// the sun, setting (or the moon, rising into place). The scene is aria-hidden inline SVG; reduced motion fades it in
// where it rests, static shows the last frame. Replay re-runs the CSS animation by re-inserting the scene.
import './demo.css';
import { on, html, raw } from '../../src/demo-kit/index.js';

const TITLE = {
  plain: 'We can’t find that page.',
  studio: 'This page was never built.',
};

// A drafted four: stem, crossbar and a diagonal that stops short of the stem, so the top stays open.
const FOUR = '<g class="nf-four"><polygon points="0,232 186,0 250,0 64,232"/><rect x="0" y="228" width="330" height="54"/><rect x="232" y="64" width="58" height="276"/></g>';
const SCENE = `<svg class="nf-art" viewBox="0 0 1000 620" focusable="false">
  <defs>
    <clipPath id="nf-sky"><rect width="1000" height="380"/></clipPath>
    <clipPath id="nf-sea"><rect y="380" width="1000" height="240"/></clipPath>
  </defs>
  <rect class="nf-skyfill" width="1000" height="380"/>
  <g class="nf-stars">${[[90, 70], [210, 34], [330, 96], [610, 52], [760, 30], [900, 88], [470, 24]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 2 : 3}" style="--i:${i}"/>`).join('')}</g>
  <path class="nf-ridge" d="M0 380 L70 344 L120 360 L210 300 L300 352 L360 330 L430 372 L560 372 L640 318 L700 346 L790 290 L880 350 L940 334 L1000 356"/>
  <rect class="nf-sea" y="380" width="1000" height="240"/>
  <g class="nf-mirror" clip-path="url(#nf-sea)">
    <g transform="translate(46 669) scale(.84 -.84)">${FOUR}</g>
    <g transform="translate(675 669) scale(.84 -.84)">${FOUR}</g>
  </g>
  <g class="nf-fours">
    <g transform="translate(46 91) scale(.84)">${FOUR}</g>
    <g transform="translate(675 91) scale(.84)">${FOUR}</g>
  </g>
  <g clip-path="url(#nf-sky)"><circle class="nf-orb" cx="500" cy="390" r="128"/></g>
  <g class="nf-glints">${[[360, 404, 280], [392, 432, 216], [424, 460, 152], [454, 488, 92], [478, 516, 44]].map(([x, y, w]) => `<rect class="nf-glint" x="${x}" y="${y}" width="${w}" height="9" rx="4.5"/>`).join('')}</g>
  <line class="nf-horizon" x1="0" x2="1000" y1="380.5" y2="380.5"/>
</svg>`;

export default function mount(root, options, ctx) {
  let cfg = { ...options };
  root.className = 'nf';
  root.innerHTML = html`
    <a class="nf-skip" href="#nf-main">Skip to the way back</a>
    <main class="nf-lost ac-wrap" id="nf-main">
      <div class="nf-lead">
        <h1 class="nf-title" data-title></h1>
        <a class="nf-home" href="#nf-home" id="nf-home">Back to the front page <span aria-hidden="true">→</span></a>
      </div>
      <nav class="nf-routes" aria-labelledby="nf-routes-title">
        <h2 class="ac-label" id="nf-routes-title">Or go straight to</h2>
        <ul class="nf-routes__list" role="list">
          ${['Work', 'Studio', 'Contact'].map((r) => html`<li class="nf-route"><a href="#nf-home">${r} <span aria-hidden="true">→</span></a></li>`)}
        </ul>
      </nav>
      <form class="nf-find" role="search" action="/search" method="get" aria-labelledby="nf-find-label" data-search>
        <label class="ac-label" id="nf-find-label" for="nf-q">Search the site</label>
        <div class="nf-find__row">
          <input class="nf-find__input" id="nf-q" name="q" type="search" placeholder="a project, a place, a year" autocomplete="off" enterkeyhint="search">
          <button class="ac-btn ac-btn--sm" type="submit">Search</button>
        </div>
        <p class="nf-find__note" role="status" data-note></p>
      </form>
      <div class="nf-scene" aria-hidden="true" data-art>${raw(SCENE)}</div>
    </main>`;

  // In the demo the links stay on the page; on a site they are root-absolute (/work/, /studio/ …).
  root.querySelectorAll('a[href="#nf-home"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const form = root.querySelector('[data-search]');
  const note = root.querySelector('[data-note]');
  on(ctx, form, 'submit', (e) => {
    e.preventDefault();
    const q = String(new FormData(form).get('q') ?? '').trim();
    note.textContent = q ? `Demo: the site would open /search?${new URLSearchParams({ q })} here.` : 'Type a project, a place or a year first.';
  });

  const art = root.querySelector('[data-art]');
  const apply = () => {
    root.querySelector('[data-title]').textContent = TITLE[cfg.tone] || TITLE.plain;
    root.dataset.scene = cfg.scene;
    root.style.setProperty('--nf-dur', `${cfg.duration}s`);
  };
  // Replay: a fresh copy of the scene restarts every CSS animation from its first frame.
  const replay = () => { art.innerHTML = SCENE; };
  apply();

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('scene') || changed.includes('duration')) replay();
    },
    action(id) { if (id === 'replay') replay(); },
  };
}
