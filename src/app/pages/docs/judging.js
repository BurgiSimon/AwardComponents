// Docs, Judging: the jury, the audit (every rule, filterable) and the corpus (every card and pattern, filterable).
import { md, score, longDate, pluginFile } from '../../../registry/plugin.js';
import { html, raw, href, debounce } from '../../dom.js';
import { icon } from '../../icons.js';
import { commandBlock, verdictChip } from '../../ui/plugin-bits.js';

const sentence = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function jury(core) {
  const j = core.jury;
  const steps = [
    ['Evidence gate', 'The captures must exist, be fresh and show a rendered page at every width; a stuck preloader or a blank frame ends the pass as recapture.'],
    ['Inventory before the contract', 'The first screen is described in the juror’s own words, and the memory sentence written, before the brief or the contract is read.'],
    ['The design director', 'The visual world, the first viewport, the signature against the thesis, specificity against the corpus and the nearest competitor, and the slop scan.'],
    ['The developer judge', 'The six developer criteria from the source, the audit and the measured budgets.'],
    ['The usability walk', 'The page walked as a visitor would, with a keyboard, a phone and reduced motion; each failed step caps Usability.'],
    ['Score, then the word', 'Four scores with a reason each, the caps applied, the weighted score, the ordered fixes, and the last line: disposition and one word.'],
  ];
  return {
    sources: ['references/jury/rubric.md', 'agents/awards-jury.md', 'skills/jury/SKILL.md'],
    body: html`
      <h2 id="axes">Four axes</h2>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Axis</th><th scope="col">Weight</th><th scope="col">What it measures</th></tr></thead>
        <tbody>${j.axes.map((a) => raw(html`<tr><th scope="row">${a.axis}</th><td class="num">${a.weight} %</td><td>${a.measures}</td></tr>`))}</tbody>
      </table></div>
      <p>Weighted score = Design × 0.4 + Usability × 0.3 + Creativity × 0.2 + Content × 0.1, the split award entries print beside each axis. The juror also scores the six developer criteria; their mean is the developer score.</p>

      <h2 id="floor">The floor</h2>
      <p>A page ships at <strong>${score(j.floor.weighted)} weighted with no axis under ${score(j.floor.axis)}</strong>. The corpus’s award winners since 2021 sit in this range (the plugin’s calibration script recomputes it from the cards):</p>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Axis</th><th scope="col" class="num">Lowest</th><th scope="col" class="num">Median</th><th scope="col" class="num">Highest</th></tr></thead>
        <tbody>${j.calibration.map((r) => raw(html`<tr><th scope="row">${r.axis}</th><td class="num">${r.min.toFixed(2)}</td><td class="num">${r.median.toFixed(2)}</td><td class="num">${r.max.toFixed(2)}</td></tr>`))}</tbody>
      </table></div>
      <p><strong>It scores below the award, on purpose.</strong> Six corpus sites were judged blind against their own live entries, and this jury came out about 0.7 lower on the weighted score, almost all of it in Usability and accessibility, from skip links and reduced-motion tiers the winning sites do not have. So a ship here clears a stricter floor than the award’s, and fix or rebuild on work of real award quality is the expected result.</p>

      <h2 id="words">Four words</h2>
      <p>The reply always ends on one literal line, <code>disposition:</code> and one word. The juror tests them in this order and stops at the first that holds:</p>
      <ol class="dladder">${['recapture', 'rebuild', 'fix', 'ship'].map((id) => raw(html`<li>${raw(verdictChip(id))}<p>${sentence(j.dispositions.find((d) => d.id === id).rule)}</p></li>`))}</ol>
      <p><strong>Caps.</strong> ${j.caps}</p>

      <h2 id="process">How a pass runs</h2>
      <p>The juror runs forked into its own agent, so the conversation that built the page cannot argue it upward. It reads the captures, never edits the build, and works in this order:</p>
      <ol class="dsteps">${steps.map(([t, b]) => raw(html`<li><p><strong>${t}</strong></p><p>${b}</p></li>`))}</ol>

      <h2 id="memory">The memory test</h2>
      <p>What a visitor would describe an hour later must be an object or a behaviour, never a mood: a memory test that yields a mood is a rebuild. These are the sentences the juror wrote about each showcase build’s first screen, before it read the brief:</p>
      <ul class="dmemories">${core.builds.map((b) => raw(html`<li><blockquote><p>${b.memory.text}</p></blockquote><p><a href="${href(`/showcase/${b.id}/`)}">${b.name}</a> · ${longDate(b.memory.date)}</p></li>`))}</ul>

      <h2 id="developer">Developer criteria</h2>
      <div class="dtable dtable--wide" tabindex="0" role="region" aria-label="Developer criteria, scrolls sideways on narrow screens"><table>
        <thead><tr><th scope="col">Criterion</th><th scope="col">9–10</th><th scope="col">7</th><th scope="col">5 or under</th></tr></thead>
        <tbody>${j.developer.map((d) => raw(html`<tr><th scope="row">${d.name}</th><td>${raw(md(d.high))}</td><td>${raw(md(d.mid))}</td><td>${raw(md(d.low))}</td></tr>`))}</tbody>
      </table></div>

      <h2 id="honest">Scoring honestly</h2>
      <ol>${j.honest.map((h) => raw(html`<li>${raw(md(h))}</li>`))}</ol>

      <h2 id="raise">What moves each axis</h2>
      <div class="dtable"><table>
        <thead><tr><th scope="col">To raise</th><th scope="col">Do</th><th scope="col">Not</th></tr></thead>
        <tbody>${j.raise.map((r) => raw(html`<tr><th scope="row">${r.axis}</th><td>${raw(md(r.do))}</td><td>${raw(md(r.not))}</td></tr>`))}</tbody>
      </table></div>`,
  };
}

const SEV = ['P0', 'P1', 'P2', 'P3'];

export function audit(core, ref) {
  const fams = core.families;
  const famName = new Map(fams.map((f) => [f.scope, f.name]));
  return {
    sources: ['scripts/data/rules.json', 'scripts/audit.mjs'],
    lede: `${core.counts.rules} rules in eight families, ${core.counts.rulesP0P1} of them at P0 or P1. Static by default; with --render it opens the page in Chromium at desktop, tablet and phone widths and adds the ${core.counts.rulesRendered} checks only a browser can make.`,
    body: html`
      <h2 id="run">Run it</h2>
      ${raw(commandBlock('node <plugin>/scripts/audit.mjs <dir|file|url> [--render] [--json] [--quick]'))}
      <p>In Claude Code a hook runs the quick audit on every file a build edits, silent unless the project has an <code>AWARDS.md</code>; Codex runs it after each batch of edits. Exit code 2 means P0 or P1 findings; a failed browser launch exits 3, and a rendered step that fails is a finding, never a clean read. A finding kept on purpose goes under <code>## Exceptions</code> in <code>AWARDS.md</code> with its reason, scoped to a path like <code>C01@src/hero.css</code>.</p>

      <h2 id="rules">Every rule</h2>
      <div class="rfilter" data-rfilter>
        <div class="field-icon rfilter__q">${raw(icon('search', { size: 16 }))}<input class="field" type="search" placeholder="Search rules: contrast, focus, canvas…" aria-label="Search rules" data-q></div>
        <div class="rfilter__row" role="group" aria-label="Family">
          <button class="chip-btn" type="button" data-fam="" aria-pressed="true">All <span>${ref.rules.length}</span></button>
          ${fams.map((f) => raw(html`<button class="chip-btn" type="button" data-fam="${f.scope}" aria-pressed="false">${f.name} <span>${f.count}</span></button>`))}
        </div>
        <div class="rfilter__row" role="group" aria-label="Severity">
          <button class="chip-btn" type="button" data-sev="" aria-pressed="true">Any severity</button>
          ${SEV.map((s) => raw(html`<button class="chip-btn" type="button" data-sev="${s}" aria-pressed="false">${s}</button>`))}
          <label class="check rfilter__check"><input type="checkbox" data-rendered> Rendered only</label>
        </div>
        <p class="rfilter__count" role="status" data-count></p>
      </div>
      <div class="dtable dtable--rules"><table>
        <thead><tr><th scope="col">Rule</th><th scope="col">Severity</th><th scope="col">What it flags</th></tr></thead>
        <tbody data-rows>
          ${ref.rules.map((r) => raw(html`
          <tr data-scope="${r.scope}" data-sev="${r.severity}" data-rendered="${r.rendered}" data-text="${`${r.id} ${r.message} ${r.fix} ${famName.get(r.scope)}`.toLowerCase()}">
            <th scope="row"><code>${r.id}</code><span>${famName.get(r.scope)}</span></th>
            <td><span class="sev sev--${r.severity.toLowerCase()}">${r.severity}</span></td>
            <td><p>${r.message}</p>${r.fix ? raw(html`<details><summary>How to fix</summary><p>${raw(md(r.fix))}</p></details>`) : ''}</td>
          </tr>`))}
        </tbody>
      </table></div>
      <p class="rfilter__none" hidden data-none>No rule matches. Clear the search or pick another family.</p>

      <h2 id="severity">Severities</h2>
      <ul>
        <li><span class="sev sev--p0">P0</span> breaks the page for someone: no viewport meta, no reduced-motion branch at all.</li>
        <li><span class="sev sev--p1">P1</span> fails a visitor or a jury rule outright: contrast, focus, missing names, uncapped pixel ratios.</li>
        <li><span class="sev sev--p2">P2</span> a craft fault a juror will see: a layout, motion or slop habit.</li>
        <li><span class="sev sev--p3">P3</span> a note for the jury: polish and browser surfaces.</li>
      </ul>
      <p>Ship needs no P0 or P1 finding; the rest are fixed or excepted with a reason. The slop scan’s rules are the deterministic half of the jury’s slop scan: what a generator does when nobody decided.</p>`,
    mount(node) {
      const box = node.querySelector('[data-rfilter]');
      const rows = [...node.querySelectorAll('[data-rows] tr')];
      const state = { fam: '', sev: '', rendered: false, q: '' };
      const apply = () => {
        const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
        let n = 0;
        for (const r of rows) {
          const hit = (!state.fam || r.dataset.scope === state.fam) && (!state.sev || r.dataset.sev === state.sev)
            && (!state.rendered || r.dataset.rendered === 'true') && terms.every((t) => r.dataset.text.includes(t));
          r.hidden = !hit;
          if (hit) n++;
        }
        node.querySelector('[data-count]').textContent = `Showing ${n} of ${rows.length} rules.`;
        node.querySelector('[data-none]').hidden = n > 0;
      };
      const press = (attr, value) => box.querySelectorAll(`[data-${attr}]`).forEach((b) => b.tagName === 'BUTTON' && b.setAttribute('aria-pressed', String(b.dataset[attr] === value)));
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if ('fam' in b.dataset) { state.fam = b.dataset.fam; press('fam', state.fam); }
        if ('sev' in b.dataset) { state.sev = b.dataset.sev; press('sev', state.sev); }
        apply();
      });
      box.querySelector('[data-rendered]').addEventListener('change', (e) => { state.rendered = e.target.checked; apply(); });
      const onInput = debounce((v) => { state.q = v; apply(); }, 80);
      box.querySelector('[data-q]').addEventListener('input', (e) => onInput(e.target.value));
      apply();
      return () => onInput.cancel();
    },
  };
}

const CONF = { high: 'Live site rendered and its source read; award entry read from the entry page.', medium: 'Award pages and galleries read through search extraction.', low: 'Recalled only.' };

export function corpus(core, ref) {
  const sites = ref.sites;
  const opts = (key) => [...new Set(sites.map((s) => s[key].split(/[,;(]/)[0].trim()))].filter(Boolean).sort();
  const select = (key, label) => html`<label class="rselect"><span>${label}</span><select class="field" data-by="${key}"><option value="">Any</option>${opts(key).map((o) => raw(html`<option>${o}</option>`))}</select></label>`;
  return {
    sources: ['references/sites/_index.md', 'references/patterns/'],
    lede: `${core.counts.sites} award sites read in depth, one clone-level reference, and ${core.counts.patterns} pattern files that turn them into rules. A build reads its three nearest cards for their principles and refuses their literal moves.`,
    body: html`
      <h2 id="how">How a card is used</h2>
      <p>Concept picks the three cards nearest to a new brief by class, visitor mode, WebGL dosage and budget, and writes the <strong>DIVERGENCE</strong> block of the contract from them: the principle taken from each and the literal move refused. Everything else on a card is evidence, never a plan. The jury then checks that no juror could name the source site from the first screen.</p>
      <p>Every fact on a card carries a label: <strong>verified</strong>, <strong>recalled</strong>, <strong>inferred</strong> or <strong>unknown</strong>. Site copy is quoted in fragments of at most 25 words, and research honours each site owner’s stated policy; captures of other people’s work are kept as evidence and never published. A card’s overall confidence:</p>
      <ul>${Object.entries(CONF).map(([k, v]) => raw(html`<li><span class="conf conf--${k}">${k}</span> ${v}</li>`))}</ul>

      <h2 id="cards">The cards</h2>
      <div class="rfilter" data-cfilter>
        <div class="field-icon rfilter__q">${raw(icon('search', { size: 16 }))}<input class="field" type="search" placeholder="Search sites, palettes, type…" aria-label="Search the corpus" data-q></div>
        <div class="rfilter__selects">${raw(select('class', 'Class'))}${raw(select('mode', 'Visitor mode'))}${raw(select('dosage', 'WebGL dosage'))}</div>
        <p class="rfilter__count" role="status" data-count></p>
      </div>
      <ul class="cards" role="list" data-cards>
        ${sites.map((s) => raw(html`
        <li data-text="${`${s.site} ${s.id} ${s.class} ${s.industry} ${s.mode} ${s.narrative} ${s.dosage} ${s.palette} ${s.type} ${s.awards}`.toLowerCase()}" data-class="${s.class}" data-mode="${s.mode}" data-dosage="${s.dosage}">
          <details class="ccard">
            <summary>
              <span class="ccard__name"><b>${s.site}</b><span>${s.class} · ${s.industry}${s.clone ? ' · clone-level' : ''}</span></span>
              <span class="ccard__aw">${s.awards}</span>
              <span class="conf conf--${s.confidence}">${s.confidence}</span>
            </summary>
            <dl class="ccard__body">
              <div><dt>Visitor mode</dt><dd>${s.mode}</dd></div>
              <div><dt>Narrative</dt><dd>${s.narrative}</dd></div>
              <div><dt>WebGL</dt><dd>${s.dosage}</dd></div>
              <div><dt>Scroll</dt><dd>${raw(md(s.scroll))}</dd></div>
              <div><dt>Palette</dt><dd>${raw(md(s.palette))}</dd></div>
              <div><dt>Type</dt><dd>${raw(md(s.type))}</dd></div>
              <div><dt>Routes read</dt><dd>${s.routes}</dd></div>
              <div><dt>Last verified</dt><dd>${s.verified}${s.skeleton ? ' · with a composition skeleton' : ''}</dd></div>
            </dl>
            <p class="ccard__links"><a href="${pluginFile(core, `references/sites/${s.id}.md`)}" target="_blank" rel="noopener" data-external>The card ${raw(icon('arrowUpRight', { size: 13 }))}</a>${s.url ? raw(html`<a href="${s.url}" target="_blank" rel="noopener" data-external>The site ${raw(icon('arrowUpRight', { size: 13 }))}</a>`) : ''}</p>
          </details>
        </li>`))}
      </ul>
      <p class="rfilter__none" hidden data-none>No card matches.</p>

      <h2 id="patterns">Pattern files</h2>
      <p>The cards turned into rules a build can apply, each citing the cards it came from.</p>
      <ul class="pats" role="list">
        ${ref.patterns.map((p) => raw(html`
        <li>
          <a href="${pluginFile(core, `references/patterns/${p.id}.md`)}" target="_blank" rel="noopener" data-external><b>${p.title}</b>${raw(icon('arrowUpRight', { size: 13 }))}</a>
          <p>${raw(md(p.lead.length > 260 ? `${p.lead.slice(0, p.lead.lastIndexOf(' ', 250))} …` : p.lead))}</p>
        </li>`))}
      </ul>`,
    mount(node) {
      const box = node.querySelector('[data-cfilter]');
      const items = [...node.querySelectorAll('[data-cards] > li')];
      const state = { q: '', class: '', mode: '', dosage: '' };
      const apply = () => {
        const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
        let n = 0;
        for (const li of items) {
          const hit = ['class', 'mode', 'dosage'].every((k) => !state[k] || li.dataset[k].startsWith(state[k])) && terms.every((t) => li.dataset.text.includes(t));
          li.hidden = !hit;
          if (hit) n++;
        }
        node.querySelector('[data-count]').textContent = `Showing ${n} of ${items.length} cards.`;
        node.querySelector('[data-none]').hidden = n > 0;
      };
      box.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { state[s.dataset.by] = s.value; apply(); }));
      const onInput = debounce((v) => { state.q = v; apply(); }, 80);
      box.querySelector('[data-q]').addEventListener('input', (e) => onInput(e.target.value));
      apply();
      return () => onInput.cancel();
    },
  };
}
