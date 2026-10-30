// The site's home: the awards plugin and its component library as one argument. A build is done when a juror in a
// separate session says ship, so the first screen holds a jury slip that steps through a real build's rounds (every
// score read from the plugin by scripts/sync-plugin.mjs). Below it: the two ways in, the nine phases, the jury's
// terms, the record of every build, the live component bench, what the plugin carries, and the install again.
import { components, groups, byId, loadComponent } from '../../registry/index.js';
import { loadPlugin, AXES, ROUND_KINDS, score, shortDate } from '../../registry/plugin.js';
import { site } from '../../registry/site.js';
import { resolve, toParams } from '../../registry/options.js';
import { html, raw, href, reducedMotion } from '../dom.js';
import { icon } from '../icons.js';
import { frameImg } from '../frames.js';
import { createPreview } from '../ui/preview.js';
import { createControls } from '../ui/controls.js';
import { createPromptPanel } from '../ui/prompt-panel.js';
import { bindCopy } from '../ui/copy.js';
import { installTicket, bindTicket, verdictChip, trailDots } from '../ui/plugin-bits.js';

const EXAMPLE = 'magnetic-button';
// Scores are drawn on a 5–9 scale: the range every round in the record falls inside, so differences of a few
// tenths stay visible. The floors sit where the ship rule puts them.
const LO = 5;
const HI = 9;
const pos = (v) => Math.max(0, Math.min(1, (v - LO) / (HI - LO)));

// A rule from the jury agent reads as a clause after its word; on its own it starts with a capital.
const sentence = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const SAMPLE = 'Build an award-worthy site for Saltglaze, a two-person stoneware studio. Collectors and restaurant buyers, often on a phone. The goal is enquiries for the next kiln opening.';

function slip(core) {
  const floor = core.jury.floor;
  return html`
    <figure class="verdict" data-verdict aria-labelledby="verdict-cap">
      <div class="verdict__screen"><img data-v-img alt="" width="960" height="600" decoding="async" fetchpriority="high"></div>
      <div class="verdict__slip">
        <div class="verdict__head">
          <p class="verdict__build"><a data-v-link href="${href('/showcase/')}"><span data-v-name></span>${raw(icon('arrowRight', { size: 14 }))}</a></p>
          <p class="verdict__round" data-v-round></p>
        </div>
        <dl class="verdict__axes" style="--floor:${pos(floor.axis)}">
          ${AXES.map((a) => raw(html`
          <div class="axis" data-axis="${a.key}">
            <dt>${a.name} <span>${Math.round(a.weight * 100)} %</span></dt>
            <dd><span class="axis__track"><span class="axis__fill"></span></span><span class="axis__n" data-n></span></dd>
          </div>`))}
        </dl>
        <div class="verdict__total" style="--floor:${pos(floor.weighted)}">
          <p><span>Weighted</span><strong data-v-total></strong></p>
          <span class="axis__track axis__track--total"><span class="axis__fill"></span></span>
          <p class="verdict__rule">Ship needs ${score(floor.weighted)} weighted and no axis under ${score(floor.axis)}.</p>
        </div>
        <p class="verdict__stamp" data-v-stamp aria-hidden="true"></p>
      </div>
      <div class="verdict__bar">
        <ol class="verdict__trail" data-v-trail aria-label="Rounds"></ol>
        <div class="verdict__ctl">
          <button class="icon-btn icon-btn--sm" type="button" data-v-prev aria-label="Previous build">${raw(icon('chevronLeft', { size: 16 }))}</button>
          <button class="icon-btn icon-btn--sm" type="button" data-v-play aria-pressed="false" aria-label="Pause the rounds">${raw(icon('pause', { size: 16 }))}</button>
          <button class="icon-btn icon-btn--sm" type="button" data-v-next aria-label="Next build">${raw(icon('chevronRight', { size: 16 }))}</button>
        </div>
      </div>
      <figcaption id="verdict-cap" class="verdict__cap">A juror in a separate session scores each round from screenshots. <span data-v-count></span></figcaption>
    </figure>`;
}

function ways(core) {
  const phases = core.phases.flatMap((r) => r.phases);
  const sample = ['magnetic-button', 'fullscreen-menu', 'hover-preview-list'].filter((id) => byId.has(id));
  return html`
    <section class="ways" aria-labelledby="ways-title">
      <h2 id="ways-title" class="h2">A whole site, or one move in a site you have</h2>
      <div class="ways__grid">
        <article class="way way--site" data-theme="dark">
          <p class="way__cmd"><code>/awards:craft</code><span>Codex: <code>$awards:craft</code></span></p>
          <h3>Build a site from a brief</h3>
          <p>Describe it in your own words: the subject, who it is for, what a visitor should do. At most three questions come back, then three directions to choose from. Everything else is decided, written into <code>AWARDS.md</code> and <code>DESIGN.md</code>, built, judged and fixed.</p>
          <ol class="way__phases" aria-label="The phases">${phases.map((p) => raw(html`<li>${p.name}</li>`))}</ol>
          <div class="way__status" aria-label="The Status checklist of a finished build">
            <p class="way__file">${raw(icon('file', { size: 13 }))}AWARDS.md · Status · ${core.status.build}</p>
            <ul>${core.status.lines.map((l) => raw(html`<li class="${l.done ? 'is-done' : ''}"><span aria-hidden="true">${l.done ? '✓' : '○'}</span>${l.text}</li>`))}</ul>
          </div>
          <p class="way__note">The reference build ran about 45 minutes and 150 turns, unattended.</p>
          <p class="way__links"><a class="arrow-link" href="${href('/docs/first-build/')}">Your first build ${raw(icon('arrowRight', { size: 15 }))}</a><a class="arrow-link" href="${href('/docs/flow/')}">How a build runs ${raw(icon('arrowRight', { size: 15 }))}</a></p>
        </article>
        <article class="way way--component">
          <p class="way__cmd"><code>/awards:component</code><span>Codex: <code>$awards:component</code></span></p>
          <h3>Add one component to a site</h3>
          <p>A hero, a menu, a cursor, a gallery. It inherits the site’s tokens, type and motion library, writes a six-line contract, and proves the result with keyboard, touch and reduced-motion captures. Start from one of the ${components.length} components here: tune it, copy its prompt, paste it.</p>
          <div class="way__frames" aria-hidden="true">${raw(sample.map((id) => frameImg(id, { size: 'sm', sizes: '220px' })).join(''))}</div>
          <p class="way__links"><a class="arrow-link" href="${href('/components/')}">Browse components ${raw(icon('arrowRight', { size: 15 }))}</a><a class="arrow-link" href="${href('/docs/components/')}">Use a component ${raw(icon('arrowRight', { size: 15 }))}</a></p>
        </article>
      </div>
    </section>`;
}

function run(core) {
  return html`
    <section class="run" aria-labelledby="run-title">
      <div class="run__head">
        <h2 id="run-title" class="h2">Nine phases, each ending in a file</h2>
        <p class="lede">Skills cannot call each other, so nothing is carried in the conversation: each phase writes a file, then tells the next skill to start. <code>AWARDS.md</code> is the build’s memory, and a new session resumes from it. Under each phase, a line from the Museum of Extinct Colours’ own files.</p>
      </div>
      <div class="run__cols">
        ${core.phases.map((r) => raw(html`
        <div class="run__col">
          <h3 class="run__name">${r.name}</h3>
          <ol class="run__list">
            ${r.phases.map((p) => raw(html`
            <li class="phase">
              <p class="phase__top"><span class="phase__name">${p.name}</span><a class="phase__skill" href="${href(`/docs/skills/${p.skill}/`)}"><code>awards:${p.skill}</code></a></p>
              <p class="phase__does">${p.does}</p>
              <p class="phase__file">${raw(icon('file', { size: 13 }))}${p.file}</p>
              <blockquote class="phase__quote"><p>${p.quote}</p></blockquote>
            </li>`))}
          </ol>
          ${r.name === 'Judge' ? raw(loop(core)) : ''}
        </div>`))}
      </div>
      <p class="run__more"><a class="arrow-link" href="${href('/docs/flow/')}">The flow in the docs, with the direction contract ${raw(icon('arrowRight', { size: 15 }))}</a></p>
    </section>`;
}

// Jury and ship loop until the word is ship: the Museum's own trail, round by round.
function loop(core) {
  const b = core.builds.find((x) => x.id === 'extinct');
  if (!b) return '';
  return html`
    <div class="loop">
      <p class="loop__t">Then round again, until the word is ship</p>
      <ol>${b.trail.map((r) => raw(html`<li><span>${ROUND_KINDS[r.kind]}</span>${raw(verdictChip(r.word))}<b>${score(r.w)}</b></li>`))}</ol>
      <p class="loop__k"><a href="${href(`/showcase/${b.id}/`)}">${b.name}</a>: its first screen was sent back as rebuild before the rest of the page was built.</p>
    </div>`;
}

function jury(core) {
  const j = core.jury;
  const order = ['recapture', 'rebuild', 'fix', 'ship'];
  return html`
    <section class="terms" aria-labelledby="terms-title">
      <div class="terms__head">
        <h2 id="terms-title" class="h2">A juror who never saw it built</h2>
        <p class="lede">The juror is forked from the build, so the conversation that made the page cannot argue for it. It describes the first screen in its own words before it reads the brief, walks the page with a keyboard and a phone, then scores four axes, weighted the way award entries are.</p>
      </div>
      <div class="terms__grid">
        <div class="weights">
          <p class="weights__bar" aria-hidden="true">${j.axes.map((a) => raw(html`<span style="--w:${a.weight}"><b>${a.axis}</b> ${a.weight} %</span>`))}</p>
          <dl class="weights__list">
            ${j.axes.map((a) => raw(html`<div><dt>${a.axis} <span>${a.weight} %</span></dt><dd>${a.measures}.</dd></div>`))}
          </dl>
        </div>
        <div class="ladder">
          <h3>It ends on one word, tested in this order</h3>
          <ol>
            ${order.map((id) => raw(html`<li>${raw(verdictChip(id))}<p>${sentence(j.dispositions.find((d) => d.id === id).rule)}</p></li>`))}
          </ol>
          <p class="ladder__note">It scores about 0.7 below what the same sites receive from the award, on purpose: a ship here clears a stricter floor, and the first verdict is usually fix.</p>
        </div>
      </div>
      <p class="run__more"><a class="arrow-link" href="${href('/docs/jury/')}">The rubric, the developer criteria and the walk ${raw(icon('arrowRight', { size: 15 }))}</a></p>
    </section>`;
}

const SORTS = [['w', 'Weighted'], ['d', 'Design'], ['u', 'Usability'], ['c', 'Creativity'], ['co', 'Content']];

function record(core) {
  return html`
    <section class="record" aria-labelledby="record-title">
      <div class="record__head">
        <div>
          <h2 id="record-title" class="h2">${core.builds.length} builds, every round on file</h2>
          <p class="lede">Each was built by the plugin from a written brief and judged from its screenshots before it could ship. Their jury logs and reports are in the awards repository.</p>
        </div>
        <div class="record__sort" role="group" aria-label="Sort the builds by">
          ${SORTS.map(([k, label]) => raw(html`<button class="chip-btn" type="button" data-sort="${k}" aria-pressed="${k === 'w'}">${label}</button>`))}
        </div>
      </div>
      <p class="sr-only" role="status" data-sort-status></p>
      <ol class="record__list" data-record>
        ${[...core.builds].sort((a, b) => b.last.w - a.last.w).map((b) => raw(html`
        <li class="rec" data-id="${b.id}" data-w="${b.last.w}" data-d="${b.last.d}" data-u="${b.last.u}" data-c="${b.last.c}" data-co="${b.last.co ?? 0}">
          <a class="rec__link" href="${href(`/showcase/${b.id}/`)}">
            <span class="rec__img">${raw(b.frame ? `<img src="${href(b.frame)}" alt="" width="960" height="600" loading="lazy" decoding="async">` : '')}</span>
            <span class="rec__name"><b>${b.name}</b><span>${b.fictional ? 'Invented client' : 'The plugin’s own page'} · ${b.rounds} rounds</span></span>
          </a>
          ${raw(trailDots(b.trail))}
          <span class="rec__axes">${AXES.map((a) => raw(html`<span data-k="${a.key}"><abbr title="${a.name}">${a.name[0]}${a.key === 'co' ? 'o' : ''}</abbr> ${score(b.last[a.key])}</span>`))}</span>
          <span class="rec__w" data-k="w">${score(b.last.w)}</span>
          ${raw(verdictChip(b.last.word))}
        </li>`))}
      </ol>
      <p class="run__more"><a class="arrow-link" href="${href('/showcase/')}">Every build, round by round, with the juror’s fixes ${raw(icon('arrowRight', { size: 15 }))}</a></p>
    </section>`;
}

function library(exampleId) {
  const ex = byId.get(exampleId);
  return html`
    <section class="libsec" aria-labelledby="lib-title">
      <div class="libsec__head">
        <h2 id="lib-title" class="h2">${components.length} components, each one a prompt</h2>
        <p class="lede">One component per recipe in the plugin, staged on its own with real names and pictures, light and dark. Tune it until it feels right; the prompt names the recipe and only the settings you changed, and the plugin rebuilds it in your project’s own tokens, type and stack.</p>
      </div>
      <div class="how__bench" data-bench>
        <div class="how__stage" data-slot="preview"></div>
        <div class="how__panel" data-slot="controls"></div>
        <div class="how__prompt" data-slot="prompt"></div>
      </div>
      <p class="how__note">Drag a slider and the prompt changes with it. This is the <a href="${href(`/components/${exampleId}/`)}" data-example-link>${ex?.title || exampleId}</a>; the link keeps your settings.</p>
      <ul class="libsec__cats" aria-label="Categories">
        ${groups.map((g) => raw(html`<li><a href="${href(`/components/?cat=${g.id}`)}">${raw(icon(g.icon, { size: 15 }))}${g.title}<span>${g.items.length}</span></a></li>`))}
      </ul>
      <p class="run__more"><a class="arrow-link" href="${href('/library/')}">The library ${raw(icon('arrowRight', { size: 15 }))}</a><a class="arrow-link" href="${href('/components/')}">All ${components.length} components ${raw(icon('arrowRight', { size: 15 }))}</a></p>
    </section>`;
}

function inside(core) {
  const c = core.counts;
  const maxFam = Math.max(...core.families.map((f) => f.count));
  // Frames of components built on recipes, one per category, for the recipes block.
  const strip = groups.map((g) => g.items.find((x) => x.recipe) || g.items[0]).filter(Boolean).slice(0, 8);
  return html`
    <section class="inside" aria-labelledby="inside-title">
      <h2 id="inside-title" class="h2">What the plugin carries</h2>
      <div class="inside__grid">
        <a class="box box--recipes" href="${href('/recipes/')}">
          <span class="box__strip" aria-hidden="true">${raw(strip.map((x) => frameImg(x.id, { size: 'sm', sizes: '180px' })).join(''))}</span>
          <span class="box__t">${c.recipes} recipes, each one running ${raw(icon('arrowRight', { size: 16 }))}</span>
          <span class="box__b">From a preloader that waits for a real load signal to a page-wide shader: each a small Vite page with a verifier that drives it in headless Chromium, keyboard, touch and reduced motion included. ${c.recipesVerified} carry a recorded pass; ${c.drafts} more wait as drafts.</span>
        </a>
        <a class="box box--audit" href="${href('/docs/audit/')}">
          <span class="box__t">${c.rules} audit rules, no model in the loop ${raw(icon('arrowRight', { size: 16 }))}</span>
          <span class="box__b">${c.rulesP0P1} at P0 or P1. ${c.rulesRendered} need the rendered page at three widths; ${c.rulesSlop} look for what a generator does when nobody decided.</span>
          <span class="fams" aria-hidden="true">${core.families.map((f) => raw(html`<span class="fam"><span>${f.name}</span><span class="fam__bar" style="--n:${f.count / maxFam}"></span><span>${f.count}</span></span>`))}</span>
        </a>
        <a class="box box--corpus" href="${href('/docs/corpus/')}">
          <span class="box__t">${c.sites} award sites, read in depth ${raw(icon('arrowRight', { size: 16 }))}</span>
          <span class="box__b">Every fact on a card is labelled verified, recalled, inferred or unknown. ${c.patterns} pattern files turn the cards into rules; ${c.skeletons} cards carry a measured composition skeleton.</span>
          <span class="tops" aria-hidden="true">${core.corpusTop.map((t) => raw(html`<span><span>${t.site}</span><b>${t.score.toFixed(2)}</b></span>`))}</span>
        </a>
        <a class="box box--skills" href="${href('/docs/skills/')}">
          <span class="box__t">${c.skills} skills, one hand-off at a time ${raw(icon('arrowRight', { size: 16 }))}</span>
          <span class="box__b">Each answers its own kind of request; craft drives them in order for a whole site.</span>
          <span class="skl" aria-hidden="true">${core.skills.map((s) => raw(html`<span><code>${s.id}</code><span>${s.short}</span></span>`))}</span>
        </a>
      </div>
    </section>`;
}

function close(core) {
  return html`
    <section class="close" data-theme="dark" aria-labelledby="close-title">
      <div class="close__copy">
        <h2 id="close-title" class="h2">Install it, then ask for a site</h2>
        <p>Start a session in an empty folder and say what the site is for. <code>/awards:craft</code> is the explicit entry point; an award-framed request reaches it on its own. A build needs Node 22.12 or later (or 24 LTS) and Playwright ${core.pins.playwright} with Chromium for its screenshots.</p>
        <div class="close__sample">
          <p class="close__k">For example</p>
          <p class="close__text">${SAMPLE}</p>
          <button class="chip-btn" type="button" data-copy-sample>${raw(icon('copy', { size: 13 }))}<span data-label>Copy</span></button>
        </div>
        <p class="way__links"><a class="arrow-link" href="${href('/docs/install/')}">Everything a build needs ${raw(icon('arrowRight', { size: 15 }))}</a><a class="arrow-link" href="${core.plugin.repository}" target="_blank" rel="noopener" data-external>awards on GitHub ${raw(icon('arrowUpRight', { size: 15 }))}</a></p>
      </div>
      ${raw(installTicket(core, { id: 'close', both: true }))}
    </section>`;
}

export default async function homePage() {
  const core = await loadPlugin();
  const exampleId = byId.has(EXAMPLE) ? EXAMPLE : components[0].id;

  const node = document.createElement('div');
  node.className = 'home';
  node.innerHTML = html`
    <section class="claim" aria-labelledby="claim-title">
      <div class="claim__copy">
        <h1 id="claim-title" class="claim__title" tabindex="-1"><span>Built by your agent.</span> <span><em>Judged</em> before it ships.</span></h1>
        <p class="claim__lede"><strong>awards</strong> is a plugin for Claude Code and Codex. It designs and builds a website the way award winners are built, then a juror in a separate session scores the screenshots and sends it back until it clears the floor. This is its home: the docs, the builds it made, and ${components.length} components you can tune and hand to it as a prompt.</p>
        ${raw(installTicket(core, { id: 'top' }))}
        <p class="claim__links"><a class="arrow-link" href="${href('/docs/first-build/')}">Your first build ${raw(icon('arrowRight', { size: 15 }))}</a><a class="arrow-link" href="${href('/components/')}">Browse components ${raw(icon('arrowRight', { size: 15 }))}</a></p>
      </div>
      ${raw(slip(core))}
    </section>
    ${raw(ways(core))}
    ${raw(run(core))}
    ${raw(jury(core))}
    ${raw(record(core))}
    ${raw(library(exampleId))}
    ${raw(inside(core))}
    ${raw(close(core))}`;

  const cleanups = [];
  node.querySelectorAll('[data-ticket]').forEach((t) => cleanups.push(bindTicket(t, core)));
  bindCopy(node.querySelector('[data-copy-sample]'), SAMPLE, { message: 'Example brief copied' });
  const verdict = mountVerdict(node.querySelector('[data-verdict]'), core);
  const sorter = mountSort(node.querySelector('.record'));

  // The live example: the same preview, controls and prompt the component pages use, filled once its meta loads.
  let preview = null;
  let prompt = null;
  let controls = null;
  let gone = false;
  loadComponent(exampleId).then((example) => {
    if (gone || !example) return;
    let values = resolve(example, {});
    const link = node.querySelector('[data-example-link]');
    preview = createPreview(example, () => values, { compact: true, height: 380 });
    prompt = createPromptPanel(example, () => values, { compact: true });
    controls = createControls(example, values, {
      onChange(next) {
        values = next;
        preview.setValues(values);
        prompt.update();
        const q = toParams(example, values).toString();
        link.href = href(`/components/${example.id}/`) + (q ? `?${q}` : '');
      },
    });
    node.querySelector('.libsec [data-slot="preview"]').append(preview.el);
    node.querySelector('.libsec [data-slot="controls"]').append(controls.el);
    node.querySelector('.libsec [data-slot="prompt"]').append(prompt.el);
  });

  return {
    node,
    title: `${site.name} — the awards plugin and its component library`,
    layout: 'wide',
    destroy() {
      gone = true;
      verdict.destroy();
      sorter.destroy();
      cleanups.forEach((fn) => fn?.());
      controls?.destroy();
      preview?.destroy();
      prompt?.destroy();
    },
  };
}

// ---- The jury slip -------------------------------------------------------------------------------------------------
// Steps through the rounds of one build, then moves to the next. Each step sets the four axis bars, the weighted
// bar and the word; a ship presses the stamp. It runs only while on screen, with motion allowed, the tab visible and
// the visitor not having paused it; with reduced motion it starts paused on a build's last round and the trail,
// arrows and keyboard step it. Nothing here is announced on its own: the trail buttons name every round.
function mountVerdict(fig, core) {
  const builds = core.builds.filter((b) => b.frame);
  const $ = (s) => fig.querySelector(s);
  const img = $('[data-v-img]');
  const playBtn = $('[data-v-play]');
  let bi = 0;
  let ri = 0;
  let timer = 0;
  let userPaused = false;
  let onScreen = true;
  let raf = 0;
  const still = reducedMotion();

  const tweenNumber = (el, to) => {
    const from = parseFloat(el.textContent) || to;
    if (still || from === to) { el.textContent = score(to); return; }
    const t0 = performance.now();
    cancelAnimationFrame(el._raf);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 520);
      const e = 1 - (1 - k) ** 3;
      el.textContent = (from + (to - from) * e).toFixed(2);
      if (k < 1) el._raf = requestAnimationFrame(step);
      else el.textContent = score(to);
    };
    el._raf = requestAnimationFrame(step);
  };

  function renderBuild() {
    const b = builds[bi];
    img.src = href(b.frame);
    img.alt = `The first screen of ${b.name}, as built by the plugin`;
    $('[data-v-name]').textContent = b.name;
    $('[data-v-link]').href = href(`/showcase/${b.id}/`);
    $('[data-v-count]').textContent = `Build ${bi + 1} of ${builds.length}: ${b.name}, ${b.rounds} rounds.`;
    $('[data-v-trail]').innerHTML = b.trail.map((r, i) => html`<li><button type="button" class="vdot vdot--${r.word}" data-i="${i}" aria-label="Round ${i + 1}: ${ROUND_KINDS[r.kind]}, ${r.word}, ${score(r.w)}"><span>${i + 1}</span></button></li>`).join('');
  }

  function renderRound() {
    const b = builds[bi];
    const r = b.trail[ri];
    fig.dataset.word = r.word;
    $('[data-v-round]').textContent = `Round ${ri + 1} of ${b.trail.length} · ${ROUND_KINDS[r.kind]}${r.target ? ` ${r.target}` : ''} · ${shortDate(r.date)}`;
    for (const a of AXES) {
      const row = fig.querySelector(`[data-axis="${a.key}"]`);
      const v = r[a.key];
      row.classList.toggle('is-empty', v == null);
      row.classList.toggle('is-low', v != null && v < core.jury.floor.axis);
      row.style.setProperty('--v', v == null ? 0 : pos(v));
      row.querySelector('[data-n]').textContent = v == null ? 'not scored' : score(v);
    }
    const total = $('.verdict__total');
    total.style.setProperty('--v', pos(r.w));
    total.classList.toggle('is-low', r.w < core.jury.floor.weighted);
    tweenNumber($('[data-v-total]'), r.w);
    const stamp = $('[data-v-stamp]');
    stamp.textContent = r.word;
    stamp.className = `verdict__stamp verdict__stamp--${r.word}`;
    void stamp.offsetWidth;
    stamp.classList.add('is-in');
    fig.querySelectorAll('.vdot').forEach((d) => d.setAttribute('aria-current', String(Number(d.dataset.i) === ri)));
  }

  const show = (b, r) => {
    const changed = b !== bi;
    bi = (b + builds.length) % builds.length;
    ri = r;
    if (changed) renderBuild();
    renderRound();
  };
  const playing = () => !userPaused && onScreen && !still && !document.hidden;
  const schedule = () => {
    clearTimeout(timer);
    if (!playing()) return;
    const last = ri === builds[bi].trail.length - 1;
    timer = setTimeout(() => { if (last) show(bi + 1, 0); else show(bi, ri + 1); schedule(); }, last ? 4200 : 2100);
  };
  const syncPlay = () => {
    const paused = userPaused || still;
    playBtn.setAttribute('aria-pressed', String(paused));
    playBtn.setAttribute('aria-label', paused ? 'Play the rounds' : 'Pause the rounds');
    playBtn.innerHTML = icon(paused ? 'play' : 'pause', { size: 16 });
    schedule();
  };

  renderBuild();
  // Reduced motion starts on the verdict a build ended with and never plays on its own, so it has no play button;
  // otherwise the story starts at round one.
  if (still) { ri = builds[0].trail.length - 1; userPaused = true; playBtn.hidden = true; }
  renderRound();
  syncPlay();

  playBtn.addEventListener('click', () => { userPaused = !userPaused; syncPlay(); });
  $('[data-v-prev]').addEventListener('click', () => { show(bi - 1, still || userPaused ? builds[(bi - 1 + builds.length) % builds.length].trail.length - 1 : 0); schedule(); });
  $('[data-v-next]').addEventListener('click', () => { show(bi + 1, still || userPaused ? builds[(bi + 1) % builds.length].trail.length - 1 : 0); schedule(); });
  fig.addEventListener('click', (e) => {
    const dot = e.target.closest('.vdot');
    if (!dot) return;
    userPaused = true;
    show(bi, Number(dot.dataset.i));
    syncPlay();
  });
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; schedule(); }, { threshold: 0.2 });
  io.observe(fig);
  const onVis = () => schedule();
  document.addEventListener('visibilitychange', onVis);

  return {
    destroy() {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}

// ---- The record's sort --------------------------------------------------------------------------------------------
// Re-sorts the rows by one axis of their last round, highest first; pressing the pressed button turns the order
// round. Rows move by FLIP (their old place to their new one); reduced motion just reorders.
function mountSort(section) {
  const list = section.querySelector('[data-record]');
  const status = section.querySelector('[data-sort-status]');
  let key = 'w';
  let dir = -1;
  const label = Object.fromEntries(SORTS);
  const apply = () => {
    const rows = [...list.children];
    const first = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
    rows.sort((a, b) => dir * (Number(a.dataset[key]) - Number(b.dataset[key])) || a.dataset.id.localeCompare(b.dataset.id));
    list.append(...rows);
    list.dataset.key = key;
    if (!reducedMotion()) {
      for (const r of rows) {
        const dy = first.get(r) - r.getBoundingClientRect().top;
        if (!dy) continue;
        r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.1, 1)' });
      }
    }
    status.textContent = `Sorted by ${label[key]}, ${dir < 0 ? 'highest' : 'lowest'} first.`;
  };
  const onClick = (e) => {
    const btn = e.target.closest('[data-sort]');
    if (!btn) return;
    if (btn.dataset.sort === key) dir = -dir;
    else { key = btn.dataset.sort; dir = -1; }
    section.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === key)));
    apply();
  };
  section.addEventListener('click', onClick);
  list.dataset.key = key;
  return { destroy() { section.removeEventListener('click', onClick); } };
}
