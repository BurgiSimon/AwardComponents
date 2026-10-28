// Designed footer — Halden's site close. A statement and a large mailto: action, a newsletter field with the page's
// own validation message, three labelled link columns, the address with Bergen's local time, a colophon, and the
// wordmark fitted to the content width: measured once at a reference size, then scaled to fit on every resize.
// When the wordmark enters view its letters rise from a mask (60 ms stagger). Reduced: they fade. Static: no motion.
import './demo.css';
import { on, every, observeResize, observeIntersection, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';

const NAME = 'Halden';

export default function mount(root, options, ctx) {
  const { studio } = content;
  let cfg = { ...options };
  const next = studio.projects[1];
  const pic = photos({ tags: ['architecture'], count: 1, seed: 'bf-next' })[0];
  const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });

  root.className = 'bf';
  root.innerHTML = html`
    <section class="bf__next ac-wrap" aria-labelledby="bf-next">
      <p class="ac-label">Next project</p>
      <a class="bf__next-link" href="#top">
        <span class="bf__next-title" id="bf-next">${next.title}</span>
        <span class="bf__next-meta ac-small">${next.place} · ${next.year} · ${next.summary}</span>
        <span class="bf__next-pic ac-media" aria-hidden="true">${raw(imageHTML(pic, { sizes: '220px', alt: '' }))}</span>
        <svg class="bf__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </section>

    <footer class="bf__foot" aria-labelledby="bf-title">
      <div class="bf__mark" aria-hidden="true" data-mark><span class="bf__word" data-word>${[...NAME].map((ch, i) => html`<span class="bf__ch" style="--i:${i}">${ch}</span>`)}</span></div>

      <div class="bf__top ac-wrap">
        <div class="bf__say">
          <p class="bf__label">Contact</p>
          <h2 class="bf__title" id="bf-title">Have a site in mind? We would like to walk it with you.</h2>
        </div>
        <div class="bf__reach">
          <a class="bf__mail" href="mailto:${studio.email}"><span>${studio.email}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
          <a class="bf__phone" href="tel:${studio.phone.replace(/\s/g, '')}">${studio.phone}</a>
        </div>
      </div>

      <div class="bf__mid ac-wrap">
        <form class="bf__letter" novalidate data-letter>
          <label class="bf__label" for="bf-email">Four letters a year</label>
          <p class="bf__small">New buildings, drawings from the archive and the odd open house. Nothing else.</p>
          <div class="bf__field">
            <input class="bf__input" id="bf-email" name="email" type="email" autocomplete="email" required placeholder="you@studio.no" aria-describedby="bf-email-msg">
            <button class="bf__send" type="submit">Subscribe</button>
          </div>
          <p class="bf__msg" id="bf-email-msg" role="status" data-msg></p>
        </form>
        <nav class="bf__col" aria-labelledby="bf-c1"><p class="bf__label" id="bf-c1">Studio</p><ul role="list">${studio.nav.map((n) => html`<li><a href="#top">${n}</a></li>`)}</ul></nav>
        <nav class="bf__col" aria-labelledby="bf-c2"><p class="bf__label" id="bf-c2">Projects</p><ul role="list">${studio.projects.slice(0, 4).map((p) => html`<li><a href="#top">${p.title}</a></li>`)}</ul></nav>
        <nav class="bf__col" aria-labelledby="bf-c3"><p class="bf__label" id="bf-c3">Elsewhere</p><ul role="list"><li><a href="#top">Instagram</a></li><li><a href="#top">LinkedIn</a></li><li><a href="#top">Are.na</a></li></ul></nav>
        <div class="bf__visit">
          <p class="bf__label">Visit</p>
          <address>${studio.address.map((l) => html`<span>${l}</span>`)}</address>
          <p class="bf__small"><span class="bf__dot" aria-hidden="true"></span>${studio.city} <time data-clock></time></p>
        </div>
      </div>

      <div class="bf__base ac-wrap">
        <p>© 2026 ${studio.full} AS · Org. 912 345 678</p>
        <a class="bf__up" href="#top" data-up>Back to top <span aria-hidden="true">↑</span></a>
      </div>
    </footer>`;

  root.querySelectorAll('a[href="#top"]:not([data-up]), a[href^="mailto"], a[href^="tel"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));
  on(ctx, root.querySelector('[data-up]'), 'click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: ctx.motion === 'full' ? 'smooth' : 'auto' });
  });

  // The studio's local time, refreshed on the minute's edge (a cheap check every 10 s).
  const time = root.querySelector('[data-clock]');
  const tick = () => {
    const now = new Date();
    const t = clock.format(now);
    if (time.textContent !== t) { time.textContent = t; time.dateTime = now.toISOString(); }
  };
  tick();
  every(ctx, tick, 10000);

  // Newsletter: the browser's validity, the page's own words, tied to the field by aria-describedby.
  const form = root.querySelector('[data-letter]');
  const input = form.querySelector('input');
  const msg = form.querySelector('[data-msg]');
  const check = () => {
    if (input.validity.valueMissing) return 'Type an email address first.';
    if (input.validity.typeMismatch) return 'That address is missing something: it should look like name@studio.no.';
    return '';
  };
  on(ctx, form, 'submit', (e) => {
    e.preventDefault();
    const problem = check();
    input.setAttribute('aria-invalid', String(!!problem));
    form.classList.toggle('is-wrong', !!problem);
    form.classList.toggle('is-done', !problem);
    msg.textContent = problem || `Thank you. The next letter goes to ${input.value} on the first Monday of December.`;
    if (problem) input.focus();
  });
  on(ctx, input, 'input', () => {
    if (form.classList.contains('is-wrong') && !check()) { form.classList.remove('is-wrong'); input.setAttribute('aria-invalid', 'false'); msg.textContent = ''; }
  });

  // The wordmark: its ink measured once at 100 px (canvas text metrics), then sized so the ink, not the text box,
  // spans the chosen share of the width; the box is trimmed to the baseline so the letters stand on the rule below
  // and rise out of that edge. Without the metrics it falls back to the DOM box.
  const mark = root.querySelector('[data-mark]');
  const word = root.querySelector('[data-word]');
  let ref = null;
  const measure = () => {
    const cs = getComputedStyle(word);
    const g = document.createElement('canvas').getContext('2d');
    g.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    if ('fontStretch' in g) g.fontStretch = 'expanded'; // 125 %, as --wider in the CSS
    if ('letterSpacing' in g) g.letterSpacing = '-5px'; // -0.05em at 100 px
    const m = g.measureText(NAME);
    const ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (ink > 0 && m.fontBoundingBoxAscent) {
      const baseline = (100 + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2; // from the top of a 1em line box
      return { ink, left: -m.actualBoundingBoxLeft, baseline, top: baseline - m.actualBoundingBoxAscent };
    }
    word.style.fontSize = '100px';
    return { ink: word.getBoundingClientRect().width, left: 0, baseline: 0, top: 0 };
  };
  const fit = () => {
    if (!ref) ref = measure();
    if (!ref.ink) return;
    const size = ((mark.clientWidth * (cfg.size / 100)) / ref.ink) * 100;
    word.style.fontSize = `${size.toFixed(2)}px`;
    word.style.marginLeft = `${(-ref.left / 100).toFixed(4)}em`;
    if (ref.baseline) {
      word.style.height = `${(ref.baseline / 100).toFixed(4)}em`;
      word.style.marginTop = `${(-(ref.top - 2) / 100).toFixed(4)}em`;
    }
  };
  observeResize(ctx, mark, fit);
  document.fonts?.ready.then(() => { ref = null; fit(); });

  // Entrance: the letters rise as the wordmark comes into view (once; Replay runs it again).
  const play = () => {
    mark.classList.remove('is-in');
    void mark.offsetWidth;
    mark.classList.add('is-in');
  };
  let seen = false;
  observeIntersection(ctx, mark, ([entry]) => {
    if (entry.isIntersecting && !seen) { seen = true; mark.classList.add('is-in'); }
  }, { threshold: 0.35 });

  const apply = () => {
    root.dataset.layout = cfg.layout;
    root.dataset.tone = cfg.tone;
    root.dataset.entrance = cfg.entrance && ctx.motion !== 'static' ? (ctx.motion === 'full' ? 'rise' : 'fade') : 'none';
    form.hidden = !cfg.newsletter;
    root.classList.toggle('bf--no-letter', !cfg.newsletter);
    fit();
  };
  apply();

  return {
    update(nextOptions) { cfg = { ...nextOptions }; apply(); },
    action(id) { if (id === 'replay') play(); },
  };
}
