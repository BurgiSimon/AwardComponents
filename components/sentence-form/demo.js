// Sentence form — Halden's enquiry as one sentence to complete. Each phrase is the <label> of the blank after it;
// the project types are a radiogroup labelled by its phrase. Validation is the browser's constraint API (required,
// type="email", a required select) with the studio's own message per field and failure, tied by aria-describedby;
// the first invalid blank takes focus and, after a first attempt, each field re-checks as it is fixed. A focused
// thank-you replaces the send row. The sentence arrives phrase by phrase (rise / fade / none); reduced: fade only.
import './demo.css';
import '../../src/demo-kit/serif.css';
import { on, html, raw, photo, photos, imageHTML, content } from '../../src/demo-kit/index.js';

const MESSAGES = {
  name: { valueMissing: 'Your name first: the sentence starts with it.' },
  kind: { valueMissing: 'Pick the closest kind of project; “something else” is fine.' },
  budget: { valueMissing: 'A rough budget tells us whether we are the right studio.' },
  email: { valueMissing: 'An address to write back to.', typeMismatch: 'That address needs an @ and a domain, like name@studio.no.' },
};
const FIELDS = Object.keys(MESSAGES); // sentence order, so the first invalid is the first one read
const KINDS = [['house', 'a house'], ['library', 'a library'], ['interiors', 'interiors'], ['other', 'something else']];
const BUDGETS = ['under €400,000', '€400,000 to €1 million', '€1 to €5 million', 'more than that', 'not sure yet'];

// Two working days from now, in words: the reply promise in the thank-you.
function replyBy(from = new Date()) {
  const d = new Date(from);
  let left = 2;
  while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6 !== 0) left--; }
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

export default function mount(root, options, ctx) {
  const { studio, people } = content;
  let cfg = { ...options };
  const chosen = photo('interior-butterfly-chair'); // a room with tall studio windows; any interior otherwise
  const pic = chosen.drawn ? photos({ tags: ['interior'], count: 1, seed: 'sf-studio' })[0] : chosen;
  const reader = people[1].name;

  root.className = 'sf';
  root.innerHTML = html`
    <header class="ac-bar sf__bar">
      <a class="ac-brand" href="#top">${studio.name}</a>
      <nav aria-label="Studio">${studio.nav.map((n) => html`<a href="#top" ${n === 'Contact' ? raw('aria-current="page"') : ''}>${n}</a>`)}</nav>
    </header>
    <main class="sf__page ac-wrap">
      <section class="sf__main" aria-labelledby="sf-title">
        <h1 class="ac-label sf__title" id="sf-title">Start a project</h1>
        <form class="sf__form" novalidate data-form>
          <p class="sf__text" data-text>
            <label class="sf__frag" for="sf-name">Hi, I’m</label>
            <input class="sf__blank" id="sf-name" name="name" type="text" autocomplete="name" required placeholder="your name" aria-describedby="sf-e-name">
            <label class="sf__frag" for="sf-org">from</label>
            <input class="sf__blank" id="sf-org" name="org" type="text" autocomplete="organization" placeholder="your studio"><span class="sf__punct">.</span>
            <span class="sf__frag" id="sf-l-kind">We’d like help with</span>
            <span class="sf__choices" role="radiogroup" aria-labelledby="sf-l-kind" aria-describedby="sf-e-kind" aria-required="true" data-group>
              ${KINDS.map(([v, t]) => html`<label class="sf__choice"><input type="radio" name="kind" value="${v}" required><span>${t}</span></label>`)}
            </span>
            <label class="sf__frag" for="sf-budget">on a budget of about</label>
            <span class="sf__select"><select class="sf__blank" id="sf-budget" name="budget" required aria-describedby="sf-e-budget"><option value="" disabled selected>choose one</option>${BUDGETS.map((b) => html`<option>${b}</option>`)}</select></span><span class="sf__punct">,</span>
            <label class="sf__frag" for="sf-email">and you can write back to</label>
            <input class="sf__blank" id="sf-email" name="email" type="email" autocomplete="email" required placeholder="you@studio.no" aria-describedby="sf-e-email"><span class="sf__punct">.</span>
          </p>
          <ul class="sf__errors" role="list">
            ${FIELDS.map((f) => html`<li class="sf__error" id="sf-e-${f}" hidden></li>`)}
          </ul>
          <div class="sf__send" data-send>
            <button class="ac-btn ac-btn--lg sf__btn" type="submit">Send the enquiry <span aria-hidden="true">→</span></button>
            <p class="ac-small">Every blank but the company is needed. Nothing is sent from this demo.</p>
          </div>
        </form>
        <p class="sf__sent" tabindex="-1" hidden data-sent></p>
      </section>

      <aside class="sf__aside" aria-label="About replies">
        <figure class="sf__fig">
          <span class="ac-media sf__pic">${raw(imageHTML(pic, { sizes: '(min-width: 900px) 28vw, 100vw', eager: true, alt: '' }))}</span>
          <figcaption class="ac-small">The studio on ${studio.address[0]}, ${studio.city}.</figcaption>
        </figure>
        <div class="sf__next">
          <p class="ac-label">What happens next</p>
          <p class="ac-body">${reader} reads every enquiry and replies within two working days, usually with a few questions about the site.</p>
          <p class="ac-small">Or write to <a class="ac-link" href="mailto:${studio.email}">${studio.email}</a> · ${studio.phone}</p>
        </div>
      </aside>
    </main>`;
  root.querySelectorAll('a[href="#top"], a[href^="mailto"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const form = root.querySelector('[data-form]');
  const group = root.querySelector('[data-group]');
  const sent = root.querySelector('[data-sent]');
  const text = root.querySelector('[data-text]');
  let submits = 0;

  // Entrance pieces: each phrase, blank, choice and punctuation mark, in reading order.
  const pieces = [...text.children].flatMap((el) => (el === group ? [...group.children] : [el]));
  pieces.forEach((el, i) => { el.classList.add('sf__piece'); el.style.setProperty('--i', String(i)); });

  const control = (name) => (form.elements[name] instanceof RadioNodeList ? form.elements[name][0] : form.elements[name]);
  const invalidTarget = (name) => (name === 'kind' ? group : control(name)); // the group carries aria-invalid, not each radio
  const check = (name) => {
    const { validity } = control(name);
    const reason = Object.keys(MESSAGES[name]).find((k) => validity[k]);
    const error = root.querySelector(`#sf-e-${name}`);
    error.textContent = reason ? MESSAGES[name][reason] : '';
    error.hidden = !reason;
    invalidTarget(name).setAttribute('aria-invalid', String(!!reason));
    return !reason;
  };
  const focusField = (name) => {
    const el = name === 'kind' ? (form.querySelector('[name="kind"]:checked') ?? control('kind')) : control(name);
    el.focus();
  };

  on(ctx, form, 'submit', (e) => {
    e.preventDefault(); // this form sends nothing
    submits++;
    const invalid = FIELDS.filter((name) => !check(name));
    if (invalid.length) { focusField(invalid[0]); return; }
    const data = new FormData(form);
    const first = String(data.get('name')).trim().split(/\s+/)[0];
    sent.textContent = `Thank you, ${first}. ${reader.split(' ')[0]} will write to ${data.get('email')} by ${replyBy()}.`;
    sent.hidden = false;
    root.classList.add('is-sent');
    sent.focus();
  });
  // After the first attempt, a field clears or updates its message as soon as it is fixed.
  const recheck = (e) => { if (submits && MESSAGES[e.target.name]) check(e.target.name); };
  on(ctx, form, 'input', recheck);
  on(ctx, form, 'change', recheck);

  const entrance = () => (ctx.motion === 'static' || cfg.entrance === 'none' ? 'none' : ctx.motion === 'reduced' ? 'fade' : cfg.entrance);
  const play = () => {
    root.classList.remove('is-entering');
    void root.offsetWidth;
    root.classList.add('is-entering');
  };
  const apply = () => {
    root.dataset.entrance = entrance();
    root.dataset.field = cfg.field;
    root.classList.toggle('sf--sans', !cfg.serif);
    root.style.setProperty('--sf-stagger', `${cfg.stagger}ms`);
  };
  apply();
  if (!ctx.capture) play(); // the thumbnail shows the settled sentence

  return {
    update(next, changed) {
      cfg = { ...next };
      apply();
      if (changed.includes('entrance') || changed.includes('stagger')) play();
    },
    action(id) {
      if (id === 'replay') {
        // Start over: an empty sentence, no messages, then the entrance again.
        form.reset();
        submits = 0;
        FIELDS.forEach((f) => { root.querySelector(`#sf-e-${f}`).hidden = true; invalidTarget(f).removeAttribute('aria-invalid'); });
        sent.hidden = true;
        root.classList.remove('is-sent');
        play();
      }
      if (id === 'errors') form.requestSubmit();
    },
  };
}
