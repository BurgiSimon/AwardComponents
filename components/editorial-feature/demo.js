// Editorial feature — a Fieldnote long read laid out as a spread. One reading column, held at a measure in ch, sits
// against one side of the article; the lead figure (caption attached) and the pull quote hang out of it into the
// margin as floats whose negative margin equals their own width, so the text never wraps round them, and the quote
// clears the figure, so at any measure it lands below the picture. A smaller figure floats inside the text. Below
// 760 px everything stacks in document order: figure, caption, heading, paragraphs, quote. Static by design: the
// controls only change the side, the measure and the type voice.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, html, raw, photo, imageHTML, content } from '../../src/demo-kit/index.js';

export default function mount(root, options, ctx) {
  const { magazine } = content;
  const article = magazine.articles[0];
  const next = magazine.articles[3];
  const [p1, p2, p3, p4, p5] = magazine.longRead;
  // The caption names sand flats, so the lead is the sand picture, not a seeded landscape (that drew alpine snow).
  const lead = photo('land-dunes', { fallbackTags: ['landscape', 'warm'] });
  // The set has no salt crystals, so the inset is the paper picture, captioned as the archive the fourth paragraph opens.
  const inset = photo('tex-paper-sheets', { fallbackTags: ['texture'] });
  root.className = 'ef';
  root.innerHTML = html`
    <main id="ef-top">
      <article class="ef-art ac-wrap" aria-labelledby="ef-title">
        <div class="ef-col">
          <figure class="ef-lead">
            <div class="ef-lead__media" style="--focus-point:${lead.focus || '50% 50%'}">${raw(imageHTML(lead, { eager: true, sizes: '(min-width: 760px) 50vw, 100vw', alt: lead.alt || 'The salt flats on the south side of Læsø' }))}</div>
            <figcaption class="ef-cap"><span class="ef-cap__k">Above</span> The flats on the island’s south side, where the brine is drawn up from under the sand.</figcaption>
          </figure>

          <header class="ef-head">
            <p class="ef-kicker">${article.section} · ${article.read} read</p>
            <h1 class="ef-title" id="ef-title">${article.title}</h1>
            <p class="ef-dek">${article.dek}</p>
            <p class="ef-byline ac-label">Words by <span>${article.author}</span></p>
          </header>

          <div class="ef-body">
            <p class="ef-p ef-p--first">${p1}</p>
            <p class="ef-p">${p2}</p>
            <blockquote class="ef-pull">
              <p>She reads the pan by sound: a low roll means the water is too deep, a hiss means it is nearly done.</p>
              <footer class="ac-label">On Birthe, thirty-one summers at the pans</footer>
            </blockquote>
            <p class="ef-p">${p3}</p>
            <figure class="ef-inset">
              <div class="ef-inset__media" style="--focus-point:${inset.focus || '50% 50%'}">${raw(imageHTML(inset, { sizes: '(min-width: 760px) 22vw, 100vw', alt: inset.alt || 'Loose pages from the salt archive' }))}</div>
              <figcaption class="ef-cap">Loose pages from the archive above the boiling house.</figcaption>
            </figure>
            <p class="ef-p">${p4}</p>
            <p class="ef-p ef-p--last">${p5}</p>
            <p class="ef-filed ac-label">Filed from Læsø, August</p>
            <a class="ef-next" href="#ef-top">
              <span class="ac-label">Next in ${next.section}</span>
              <span class="ef-next__title">${next.title} <span aria-hidden="true">→</span></span>
              <span class="ef-next__dek">${next.dek} By ${next.author}.</span>
            </a>
          </div>
        </div>
      </article>
    </main>`;
  root.querySelectorAll('a[href="#ef-top"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  let cfg = { ...options };
  const apply = () => {
    root.dataset.side = cfg.side;
    root.dataset.quote = cfg.quote;
    root.style.setProperty('--measure', String(cfg.measure));
    root.classList.toggle('ef--serif', cfg.serif);
    root.classList.toggle('ef--dropcap', cfg.dropCap);
  };
  apply();

  return {
    update(next) { cfg = { ...next }; apply(); },
  };
}
