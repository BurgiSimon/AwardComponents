// Editorial page — Halden's home page, paced as one document around its newest house. Five sections, each with its own
// job and layout family: an art-directed hero (copy beside an 8:5 picture that recrops to 4:5 on a phone), an
// image-and-text story (figure 1.35 parts to copy 1, caption attached), the house in figures (a <dl> and a native
// <details>), a shorter passage that slows the pace, and a reversed close with one contact action. Nothing moves and
// nothing needs the script to read: the controls only swap tokens and data attributes on the root.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';

const FIGURES = [
  ['Floor area', '310', 'm²', 'over two levels'],
  ['Footprint', '11 × 24', 'm', ''],
  ['Structure', 'Cross-laminated spruce', '', 'on 14 steel pins'],
  ['Cladding', 'Untreated larch', '', '22 mm boards'],
  ['Long window', '9.6', 'm', 'five panes, triple glazed'],
  ['Energy use', '38', 'kWh/m²', 'a year'],
  ['Completed', 'May 2026', '', ''],
];
const WEATHER = [['Year one', 'Honey'], ['Year three', 'Driftwood'], ['Year ten', 'Silver']];

export default function mount(root, options, ctx) {
  const { studio, people } = content;
  const [hero, profile] = photos({ tags: ['architecture'], count: 2, seed: 'ep-house', orientation: 'landscape' });
  const [detail] = photos({ tags: ['interior'], count: 1, seed: 'ep-hearth' });
  const work = studio.projects.slice(0, 3);
  root.className = 'ep';
  root.innerHTML = html`
    <a class="ep__skip" href="#ep-main">Skip to content</a>
    <header class="ep-mast" id="ep-top">
      <a class="ep-mast__mark" href="#ep-top" aria-label="${studio.full}, back to top">${studio.name}<span>Arkitekter</span></a>
      <nav aria-label="Main">
        <a href="#ep-story">Work</a><a href="#ep-care">Studio</a><a href="#ep-contact">Contact <span aria-hidden="true">↗</span></a>
      </nav>
    </header>

    <main id="ep-main">
      <section class="ep-hero ac-wrap" aria-labelledby="ep-title">
        <div class="ep-hero__copy">
          <p class="ac-label">New work · Fjordhus, Hardanger</p>
          <h1 class="ep-display" id="ep-title">Long winters, short summers.</h1>
          <p class="ep-hero__lede">We draw houses, libraries and furniture for the north. The newest, Fjordhus, stands on a granite shelf thirty metres above the fjord.</p>
          <a class="ep-action" href="#ep-story">Read about the house <span aria-hidden="true">↓</span></a>
        </div>
        <figure class="ep-hero__figure">
          <div class="ep-hero__media" style="--focus-point:${hero.focus || '50% 50%'}">${raw(imageHTML(hero, { eager: true, sizes: '(min-width: 900px) 58vw, 100vw', alt: hero.alt || 'Fjordhus seen from the water' }))}</div>
          <figcaption class="ep-cap"><span>Fjordhus from the water, late March.</span><span class="ep-cap__k">01</span></figcaption>
        </figure>
      </section>

      <section class="ep-story ac-wrap" id="ep-story" aria-labelledby="ep-story-title">
        <figure class="ep-story__figure">
          <div class="ep-media ep-media--detail" style="--focus-point:${detail.focus || '50% 50%'}">${raw(imageHTML(detail, { sizes: '(min-width: 760px) 56vw, 100vw', alt: detail.alt || 'The lower level of Fjordhus' }))}</div>
          <figcaption class="ep-cap"><span>The lower level, where the granite comes up through the floor and became the hearth.</span><span class="ep-cap__k">02</span></figcaption>
        </figure>
        <div class="ep-story__copy">
          <p class="ac-label">The site</p>
          <h2 class="ep-heading" id="ep-story-title">The rock decides.</h2>
          <p class="ep-body ep-body--first">The plot was a granite shelf eleven metres deep, with the fjord thirty metres below. Instead of blasting it flat, the house steps down with the rock in two levels, and the floor follows the stone the way a path would.</p>
          <p class="ep-body">Fourteen steel pins hold the timber frame clear of the granite, so meltwater runs under the house in spring and the rock stays as the ice left it. Where the stone breaks through inside, we left it bare.</p>
          <blockquote class="ep-note"><p>“We moved less than a cubic metre of rock.”</p><footer>${people[0].name}, founding partner</footer></blockquote>
          <a class="ep-link" href="#ep-spec">The house in figures <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section class="ep-spec ac-wrap" id="ep-spec" aria-labelledby="ep-spec-title">
        <figure class="ep-spec__figure">
          <div class="ep-media ep-media--profile" style="--focus-point:${profile.focus || '50% 50%'}">${raw(imageHTML(profile, { sizes: '(min-width: 1000px) 56vw, 100vw', alt: profile.alt || 'The long side of Fjordhus' }))}</div>
          <figcaption class="ep-cap"><span>The long side, and the window that runs the length of the living room.</span><span class="ep-cap__k">03</span></figcaption>
        </figure>
        <div class="ep-spec__facts">
          <p class="ac-label">Particulars</p>
          <h2 class="ep-heading" id="ep-spec-title">Fjordhus in figures.</h2>
          <dl class="ep-dl">
            ${FIGURES.map(([k, v, unit, note]) => html`<div><dt>${k}</dt><dd><span class="ep-dl__v">${v}</span>${unit ? html`<span class="ep-dl__u">${unit}</span>` : ''}${note ? html`<span class="ep-dl__n">${note}</span>` : ''}</dd></div>`)}
          </dl>
          <details class="ep-details">
            <summary>Materials and makers</summary>
            <p>Spruce cross-laminated at Os, larch milled in Voss, the pins forged in Odda and the stove cast in Denmark. Everything but the stove came from within 160 km of the site.</p>
          </details>
        </div>
      </section>

      <section class="ep-care ac-wrap" id="ep-care" aria-labelledby="ep-care-title">
        <div class="ep-care__intro">
          <p class="ac-label">Care</p>
          <h2 class="ep-display ep-display--care" id="ep-care-title">In ten winters.</h2>
          <p class="ep-care__lead">The larch is left untreated. It will not stay this colour, and it is not meant to.</p>
        </div>
        <div class="ep-care__body">
          <h3 class="ep-sub">How the house weathers</h3>
          <p class="ep-body">Sun and rain draw the resin out of the boards in the first two summers, and the south wall goes from honey to driftwood to silver. The north wall takes longer and stays darker; from the water, that difference is how you read the compass.</p>
          <p class="ep-body">Nothing to oil and nothing to paint. Once a year someone walks round with a brush and clears the needles from the gutters.</p>
          <ol class="ep-weather" role="list" aria-label="The south wall over ten years">
            ${WEATHER.map(([year, tone], i) => html`<li class="ep-weather__step" style="--i:${i}"><span class="ep-weather__chip" aria-hidden="true"></span><span class="ac-label">${year}</span><span class="ep-weather__tone">${tone}</span></li>`)}
          </ol>
          <a class="ep-link" href="#ep-contact">Talk to us about a house <span aria-hidden="true">↘</span></a>
        </div>
      </section>
    </main>

    <footer class="ep-close" id="ep-contact" aria-labelledby="ep-close-title">
      <div class="ac-wrap">
        <div class="ep-close__message">
          <h2 class="ep-display ep-display--close" id="ep-close-title"><span>Have a site in mind?</span> <span>Walk it with us first.</span></h2>
          <a class="ep-close__action" href="mailto:${studio.email}">Write to the studio <span aria-hidden="true">↗</span></a>
        </div>
        <div class="ep-close__bottom">
          <p class="ep-close__sign">${studio.name}<span>Arkitekter</span></p>
          <div>
            <p class="ep-close__label">Recent work</p>
            <nav aria-label="Recent work"><ul role="list">${work.map((p) => html`<li><a href="#ep-top">${p.title}</a></li>`)}</ul></nav>
          </div>
          <div>
            <p class="ep-close__label">Studio</p>
            <address>${studio.address[0]}<br>${studio.address[1]}<br><a href="tel:${studio.phone.replace(/\s/g, '')}">${studio.phone}</a></address>
          </div>
          <div class="ep-close__return">
            <p class="ep-close__label">Return</p>
            <a href="#ep-top">Back to top <span aria-hidden="true">↑</span></a>
          </div>
        </div>
        <div class="ep-close__colophon"><p>${studio.full} AS · drawing in ${studio.city} since 2009</p><p>© 2026</p></div>
      </div>
    </footer>`;

  // Contact links stay in the demo; in-page anchors keep their native jump.
  root.querySelectorAll('a[href^="mailto"], a[href^="tel"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  let cfg = { ...options };
  const apply = () => {
    root.dataset.density = cfg.density;
    root.dataset.accent = cfg.accent;
    root.dataset.hero = cfg.hero;
    root.classList.toggle('ep--serif', cfg.serif);
  };
  apply();

  return {
    update(next) { cfg = { ...next }; apply(); },
  };
}
