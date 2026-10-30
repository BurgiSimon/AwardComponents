// Case-study page — Halden's work index and the inner page it opens. The index lists eight projects as ruled rows;
// the Tern Library row opens its case study in place (content swapped, scroll reset, focus on the new h1). The case
// is one <article> whose rows each carry a layout family, and no two neighbours share one: an edge-to-edge title
// over a definition list of client, year, scope and credits, a bled plate, an offset split for the brief, an uneven
// pair, a caption-led figure bled to the right edge, a drawn section as a second plate, the result as ruled rows, and
// a next-project close that links back into the index and marks the row it names. Only what starts below the fold is
// held back for a reveal: full rises 32 px and fades over 0.9 s, reduced only fades, static holds nothing back.
import './demo.css';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';

const CREDITS = [
  ['Direction', 'Ingrid Vold'],
  ['Interiors', 'Tomas Reyes'],
  ['Project architect', 'Sigrid Haug'],
  ['Landscape', 'Oda Lien'],
  ['Structure', 'Nordvik Engineering'],
  ['Furniture', 'Halden Workshop'],
];
const RESULTS = [
  ['Visits a week', '1,900 → 5,600'],
  ['Seats facing the water', '220 of 220'],
  ['Daylight factor at the reading tables', '5.2 %'],
  ['Opening hours a week', '38 → 72'],
  ['Energy use', '41 kWh/m²'],
];
// Each order keeps the adjacency rule: no row shares a layout family with its neighbour, and the title family
// (edge-to-edge type) appears only at the two ends.
const RHYTHMS = {
  classic: ['plate', 'brief', 'pair', 'lead', 'section', 'facts'],
  image: ['plate', 'pair', 'brief', 'section', 'lead', 'facts'],
  text: ['brief', 'plate', 'lead', 'pair', 'section', 'facts'],
};

// The long section, drawn from tokens: the sound on the left, the reading room behind one window, the stacks
// stepping up behind the readers, a monopitch roof holding the snow, and the low noon sun of January.
const SECTION = `<svg viewBox="60 180 1920 823" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Long section through Tern Library: the sound on the left, one tall window, readers at tables facing it, the stacks stepping up behind them and a sloping roof under snow">
  <g class="cs-dwg__water"><rect x="0" y="700" width="480" height="320"/></g>
  <g class="cs-dwg__thin">${[740, 772, 804, 836].map((y, i) => `<path d="M${70 + i * 22} ${y} q 40 -10 80 0 t 80 0 t 80 0 t 80 0"/>`).join('')}</g>
  <path class="cs-dwg__ground" d="M480 700 L560 652 L1000 652 L1000 620 L1180 620 L1180 590 L1360 590 L1360 560 L1540 560 L1540 530 L1760 530 L2100 500"/>
  <g class="cs-dwg__hatch">${Array.from({ length: 40 }, (_, i) => `<path d="M${580 + i * 38} ${700 - Math.max(0, (i - 11)) * 4.2} l -26 40"/>`).join('')}</g>
  <path class="cs-dwg__snow" d="M524 352 L1772 290"/>
  <path class="cs-dwg__roof" d="M520 370 L1780 306 L1780 332 L560 394 Z"/>
  <rect class="cs-dwg__glass" x="552" y="392" width="18" height="260"/>
  <path class="cs-dwg__wall" d="M1760 330 L1760 530"/>
  <g class="cs-dwg__stacks">${[0, 1, 2, 3].map((s) => `<g transform="translate(${1030 + s * 180} ${590 - s * 30})">${[0, 1, 2].map((r) => `<rect x="${r * 46}" y="-120" width="34" height="120"/>`).join('')}</g>`).join('')}</g>
  <g class="cs-dwg__people">${[640, 760, 880].map((x) => `<g transform="translate(${x} 652)"><path d="M-30 -58 h 70"/><path d="M28 -58 v 58"/><circle cx="-4" cy="-96" r="11"/><path d="M-4 -84 v 30 l 22 0 v 28"/></g>`).join('')}</g>
  <circle class="cs-dwg__sun" cx="190" cy="610" r="26"/>
  <path class="cs-dwg__ray" d="M216 604 L900 560"/>
  <g class="cs-dwg__label"><text x="90" y="920">SOUND</text><text x="600" y="686">READING ROOM  +0.0</text><text x="1210" y="420">STACKS  +3.6</text><text x="210" y="580">NOON, JANUARY</text></g>
</svg>`;

export default function mount(root, options, ctx) {
  const { studio } = content;
  const projects = studio.projects;
  const caseProject = projects.find((p) => p.slug === 'tern-library');
  const nextProject = projects.find((p) => p.slug === 'kiln-house');
  const [opening, lead] = photos({ tags: ['architecture'], count: 2, seed: 'cs-tern', orientation: 'landscape' });
  const [portrait] = photos({ tags: ['interior'], count: 1, seed: 'cs-room', orientation: 'portrait' });
  const [square] = photos({ tags: ['texture'], count: 1, seed: 'cs-slats' });
  const [nextPic] = photos({ tags: ['interior'], count: 1, seed: 'cs-kiln', orientation: 'landscape' });
  let cfg = { ...options };
  let view = '';

  root.className = 'cs';
  root.innerHTML = html`
    <a class="cs-skip" href="#cs-main">Skip to content</a>
    <header class="cs-bar">
      <a class="cs-bar__brand ac-brand" href="#cs-work" data-go="index">${studio.name}</a>
      <nav aria-label="Breadcrumb"><ol class="cs-crumbs" role="list" data-crumbs></ol></nav>
      <a class="cs-bar__contact" href="mailto:${studio.email}">Contact</a>
    </header>
    <main id="cs-main" class="cs-main" data-view></main>
    <p class="sr-only" role="status" data-status></p>`;

  const main = root.querySelector('[data-view]');
  const crumbs = root.querySelector('[data-crumbs]');
  const status = root.querySelector('[data-status]');

  const fig = (item, cls, alt, sizes) => raw(`<div class="cs-media ${cls}" style="--focus-point:${item.focus || '50% 50%'}">${imageHTML(item, { sizes, alt: item.alt || alt })}</div>`);

  const indexHTML = () => html`
    <section class="cs-index-head" aria-labelledby="cs-index-title">
      <p class="ac-label">${studio.full} · ${studio.city}</p>
      <h1 class="cs-display cs-display--index" id="cs-index-title" tabindex="-1">Work, <span class="cs-nowrap">2022–2026</span></h1>
      <p class="cs-lede">Houses, libraries, rooms and one chair. Tern Library opens as a full case study; the others are listed with their sites and sizes.</p>
    </section>
    <ol class="cs-works" role="list" aria-labelledby="cs-index-title">
      ${projects.map((p) => (p === caseProject
        ? html`<li class="cs-work cs-work--case" id="cs-w-${p.slug}">
            <a class="cs-work__link" href="#cs-case" data-go="case">
              <span class="cs-work__name">${p.title}</span>
              <span class="cs-work__meta">${p.discipline} · ${p.year}</span>
              <span class="cs-work__line">${p.summary} <span class="cs-work__go">Read the case study <span aria-hidden="true">→</span></span></span>
              <span class="cs-work__thumb" aria-hidden="true">${raw(imageHTML(opening, { sizes: '22rem', alt: '' }))}</span>
            </a>
          </li>`
        : html`<li class="cs-work" id="cs-w-${p.slug}" tabindex="-1">
            <span class="cs-work__name">${p.title}</span>
            <span class="cs-work__meta">${p.discipline} · ${p.year}</span>
            <span class="cs-work__line">${p.summary} <span class="cs-work__size">${p.place} · ${p.size}</span></span>
          </li>`))}
    </ol>`;

  const ROWS = {
    plate: () => html`<figure class="cs-plate" data-row="plate" data-family="plate" data-reveal>
        ${fig(opening, 'cs-media--open', 'Tern Library from the shore of the sound', '100vw')}
        <figcaption class="cs-cap">The reading room’s window from the shore, an hour after the sun came back in late January.</figcaption>
      </figure>`,
    brief: () => html`<section class="cs-text" data-row="brief" data-family="offset-split" aria-labelledby="cs-brief" data-reveal>
        <h2 class="cs-h2" id="cs-brief">The brief</h2>
        <div class="cs-text__body">
          <p>The old library sat on the third floor of the town hall, behind a lift that was out of order more often than not. The city asked for a building at street level, open until ten, that would still feel like a room for reading through a polar night seven weeks long.</p>
          <p>We put the whole reading room behind one window facing the sound. It runs ninety-two metres, low enough to see the water from a chair, and the stacks stand behind the readers, so every seat looks out.</p>
        </div>
      </section>`,
    pair: () => html`<div class="cs-pair" data-row="pair" data-family="uneven-grid">
        <figure class="cs-pair__a" data-reveal>${fig(portrait, 'cs-media--portrait', 'The reading room at midday in winter', '(min-width: 760px) 46vw, 100vw')}<figcaption class="cs-cap">The reading room at noon in January, lit by the window and nothing else for two hours.</figcaption></figure>
        <figure class="cs-pair__b" data-reveal>${fig(square, 'cs-media--square', 'Birch slats on the reading room ceiling', '(min-width: 760px) 30vw, 70vw')}<figcaption class="cs-cap">Birch slats on the ceiling, spaced to soften the voices of 220 readers.</figcaption></figure>
      </div>`,
    lead: () => html`<figure class="cs-lead" data-row="lead" data-family="offset-split" data-reveal>
        <figcaption class="cs-lead__cap"><span class="cs-lead__title">One window, ninety-two metres</span>The glazing is set in five bays of 18.4 metres, with the mullions outside, so from a chair the sound reads as one view and the frames read as weather.</figcaption>
        ${fig(lead, 'cs-media--lead', 'The long window of Tern Library seen along its length', '(min-width: 760px) 66vw, 100vw')}
      </figure>`,
    section: () => html`<figure class="cs-plate cs-plate--dwg" data-row="section" data-family="plate" data-reveal>
        <div class="cs-media cs-media--wide cs-dwg">${raw(SECTION)}</div>
        <figcaption class="cs-cap">Long section. The stacks step up behind the readers, so every seat looks at the water.</figcaption>
      </figure>`,
    facts: () => html`<section class="cs-facts" data-row="facts" data-family="index-rows" aria-labelledby="cs-facts-title" data-reveal>
        <h2 class="cs-h2" id="cs-facts-title">What changed</h2>
        <dl class="cs-facts__list">${RESULTS.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
        <p class="cs-small">First full year open, against the old library’s last.</p>
      </section>`,
  };

  const caseHTML = () => html`
    <article class="cs-case" aria-labelledby="cs-case-title">
      <header class="cs-head" data-row="title" data-family="edge-type">
        <h1 class="cs-display cs-title" id="cs-case-title" tabindex="-1">${caseProject.title}</h1>
        <p class="cs-stand">A public reading room on the sound at Tromsø, with one window ninety-two metres long and a roof that holds the snow.</p>
        <dl class="cs-meta">
          <div><dt>Client</dt><dd>The city library board, Tromsø</dd></div>
          <div><dt>Year</dt><dd>2021–${caseProject.year}</dd></div>
          <div><dt>Scope</dt><dd>Architecture, interiors, furniture</dd></div>
          <div class="cs-meta__credits"><dt>Credits</dt><dd><dl class="cs-credits">${CREDITS.map(([r, n]) => html`<div><dt>${r}</dt><dd>${n}</dd></div>`)}</dl></dd></div>
        </dl>
      </header>
      ${(RHYTHMS[cfg.rhythm] || RHYTHMS.classic).map((r) => ROWS[r]())}
    </article>
    <nav class="cs-next" aria-label="Next project" data-row="next" data-family="edge-type">
      <a class="cs-next__link" href="#cs-w-${nextProject.slug}" data-go="index" data-mark="${nextProject.slug}">
        <span class="cs-next__label ac-label">Next project · ${nextProject.discipline}, ${nextProject.year}</span>
        <span class="cs-next__media" aria-hidden="true">${raw(imageHTML(nextPic, { sizes: '100vw', alt: '' }))}</span>
        <span class="cs-display cs-next__title">${nextProject.title} <span aria-hidden="true">→</span></span>
      </a>
    </nav>`;

  // Reveal: only rows that start below the fold are held back, so the first paint is complete.
  let io = null;
  ctx.onCleanup(() => io?.disconnect());
  const reveal = () => {
    io?.disconnect();
    if (!cfg.reveal || ctx.motion === 'static') return;
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.remove('is-pending');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    main.querySelectorAll('[data-reveal]').forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add('is-pending');
      io.observe(el);
    });
  };

  const setCrumbs = () => {
    crumbs.innerHTML = view === 'case'
      ? html`<li><a href="#cs-work" data-go="index">Work</a></li><li aria-current="page">${caseProject.title}</li>`
      : html`<li aria-current="page">Work</li>`;
  };

  // The route: swap the view, reset the scroll, move focus to the new h1 (or to the row the close named).
  const go = (next, { mark, focus = true, keepScroll = false } = {}) => {
    view = next;
    main.innerHTML = next === 'case' ? caseHTML() : indexHTML();
    main.dataset.view = next;
    setCrumbs();
    const target = mark && main.querySelector(`#cs-w-${mark}`);
    if (target) {
      target.classList.add('is-target');
      target.scrollIntoView({ block: 'center' });
    } else if (!keepScroll) {
      window.scrollTo(0, 0);
    }
    if (focus) (target || main.querySelector('h1')).focus({ preventScroll: true });
    status.textContent = next === 'case' ? `${caseProject.title}, case study` : 'Work index';
    reveal();
  };

  on(ctx, root, 'click', (e) => {
    const link = e.target.closest('a');
    if (!link || !root.contains(link)) return;
    if (link.dataset.go) { e.preventDefault(); go(link.dataset.go, { mark: link.dataset.mark }); return; }
    if (/^(mailto|tel):/.test(link.getAttribute('href') || '')) e.preventDefault();
  });

  const apply = () => {
    root.dataset.credits = cfg.credits;
    root.style.setProperty('--cs-title', `${cfg.titleScale}vw`);
    root.classList.toggle('cs--reveal', cfg.reveal);
  };
  apply();
  go(cfg.start === 'case' ? 'case' : 'index', { focus: false });

  return {
    update(next, changed) {
      const prev = cfg;
      cfg = { ...next };
      apply();
      if (view === 'case' && changed.includes('rhythm')) go('case', { focus: false, keepScroll: true });
      if (changed.includes('start') && cfg.start !== prev.start) go(cfg.start, { focus: false });
      if (changed.includes('reveal') && !cfg.reveal) main.querySelectorAll('.is-pending').forEach((el) => el.classList.remove('is-pending'));
    },
    action(id) {
      // From the toolbar: route without pulling focus out of the page that pressed the button.
      if (id === 'open') go('case', { focus: false });
      if (id === 'index') go('index', { focus: false });
    },
  };
}
