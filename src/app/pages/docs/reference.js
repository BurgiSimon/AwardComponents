// Docs, Reference: the scripts, the hooks and settings, and questions.
import { docPath } from '../../../registry/docs.js';
import { score } from '../../../registry/plugin.js';
import { html, raw, href } from '../../dom.js';
import { commandBlock } from '../../ui/plugin-bits.js';

const doc = (slug, label) => html`<a href="${href(docPath(slug))}">${label}</a>`;

export function scripts(core) {
  const stages = [...new Set(core.scripts.map((s) => s.stage))];
  const about = { Setup: 'Before a build', Decide: 'While deciding', Build: 'While building', Judge: 'Evidence and judging', Maintain: 'Keeping the plugin honest' };
  return {
    sources: ['scripts/'],
    lede: 'The skills call these for you; each also runs on its own. Paths are relative to the plugin folder, and none of them needs a model.',
    body: html`
      ${stages.map((st) => raw(html`
      <h2 id="${st.toLowerCase()}">${about[st] || st}</h2>
      <dl class="dscripts">
        ${core.scripts.filter((s) => s.stage === st).map((s) => raw(html`<div><dt><code>${s.file}</code>${s.usage ? raw(html`<code class="dscripts__u">${s.usage}</code>`) : ''}</dt><dd>${s.what}</dd></div>`))}
      </dl>`))}
      <h2 id="evals">Evals</h2>
      <p>The plugin carries ${core.counts.evals} cases for <code>claude plugin eval</code>: ${Object.entries(core.counts.evalTags).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}`).join(', ')}. Routing cases check that each skill fires on its own kind of request and that ten near-misses do not; build cases run whole builds from fixtures. Free self-tests check that every grader fails on untouched input.</p>`,
  };
}

export function hooks(core) {
  const cfg = core.plugin.config;
  return {
    heading: 'Hooks and settings',
    sources: ['hooks/hooks.json', '.claude-plugin/plugin.json', 'references/codex.md'],
    body: html`
      <h2 id="hooks">Four hooks, Claude Code only</h2>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Event</th><th scope="col">Runs</th><th scope="col">What it does</th></tr></thead>
        <tbody>${core.hooks.map((h) => raw(html`<tr><th scope="row"><code>${h.event}</code>${h.matcher ? raw(html`<span class="dmuted"> on ${h.matcher}</span>`) : ''}</th><td><code>${h.command}</code></td><td>${h.what}</td></tr>`))}</tbody>
      </table></div>
      <p>There is no <code>Stop</code> hook by design. Set <code>AWARDS_HOOK=0</code> in the environment, or turn the plugin’s hooks setting off, to silence all four.</p>

      <h2 id="settings">Settings</h2>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Setting</th><th scope="col">Default</th><th scope="col">What it changes</th></tr></thead>
        <tbody>${cfg.map((c) => raw(html`<tr><th scope="row"><code>${c.id}</code><span class="dmuted"> ${c.title}</span></th><td><code>${String(c.default)}</code>${c.options ? raw(html`<span class="dmuted"> of ${c.options.join(', ')}</span>`) : ''}</td><td>${c.description}</td></tr>`))}</tbody>
      </table></div>

      <h2 id="codex">In Codex</h2>
      <ul>
        <li>The skills are named with a dollar sign: <code>$awards:craft</code>, <code>$awards:component</code>, <code>$awards:jury</code>.</li>
        <li>The Codex manifest declares no hooks, which keeps the plugin eligible for Codex’s public plugin directory; the audit runs when a skill calls it, after each batch of edits.</li>
        <li>A fresh-context jury needs delegation to be available. Without it, the report says it used the current context.</li>
        ${core.plugin.codex?.prompts?.length ? raw(html`<li>The starter prompts Codex shows: ${raw(core.plugin.codex.prompts.map((p) => html`<code>${p}</code>`).join(', '))}.</li>`) : ''}
      </ul>

      <h2 id="env">Environment variables</h2>
      <div class="dtable"><table>
        <tbody>
          <tr><th scope="row"><code>AWARDS_HOOK=0</code></th><td>Silences all four hooks.</td></tr>
          <tr><th scope="row"><code>AWARDS_PLAYWRIGHT</code></th><td>The project folder of a Playwright installed elsewhere.</td></tr>
          <tr><th scope="row"><code>AWARDS_CHROMIUM</code></th><td>A Chromium executable to use for captures.</td></tr>
          <tr><th scope="row"><code>CRUX_API_KEY</code></th><td>For <code>scripts/crux.mjs</code>, the Chrome UX Report field data.</td></tr>
        </tbody>
      </table></div>`,
  };
}

export function faq(core) {
  const f = core.jury.floor;
  const qa = [
    ['What does a build cost?', `The reference build took about 45 minutes, 150 turns and roughly $27 of API usage at the eval runner’s rates. Quick mode, one landing page with one jury round, costs much less. A single component is a short session.`],
    ['Why did my first verdict say fix?', `Because it usually does. The juror marks about 0.7 below the award on the same sites, so a page has to reach ${score(f.weighted)} weighted with no axis under ${score(f.axis)} on a stricter scale. Ship applies the located fixes in one batch and the jury checks once more.`],
    ['What if it says rebuild?', 'A rebuild means the idea did not hold: the weighted score is under the floor, a juror could name the site it came from, the memory test returned a mood, or the thesis is not visible on the first screen. Craft returns to concept when the thesis, world, signature or divergence failed, and to structure when the story or the first screen did; it never patches around one. The first screen is judged before the rest of the page exists, so a rebuild there costs one section.'],
    ['And recapture?', 'The evidence was missing or invalid: a blank or stale capture, a stuck preloader, or page errors. Check the machine with the doctor, then capture again.'],
    ['Can I use it on a site I already have?', html`Yes. <code>/awards:component</code> works inside an existing site and inherits its world; <code>/awards:craft redesign &lt;url or folder&gt;</code> rebuilds one on a branch, starting from a baseline jury of the old site.`],
    ['Does it need the network?', 'To install the project’s dependencies, to search open collections for pictures (turn that off with --no-found-pictures), and for crux.mjs. The audit, captures, the roll and the jury run locally.'],
    ['Does WebGL work in headless captures?', 'The recipes are verified in headless Chromium with SwiftShader WebGL. That proves them correct, not fast; capture.mjs has a GPU lane that refuses SwiftShader when frame times matter.'],
    ['What about fonts and pictures?', 'Faces are chosen by character from the open Fontsource catalogue and self-hosted with their licence. Pictures come from your own files first, then open collections (public domain, CC0, CC BY, CC BY-SA), and every one is logged with its credit in .awards/assets.json.'],
    ['Can it work beside other design skills?', 'Yes. Craft reads an existing PRODUCT.md for product truth and never overwrites it, and two eval cases check it beside GreenSock’s own GSAP skills.'],
    ['Is it affiliated with an award programme?', 'No. The rubric is calibrated against published award entries, read and labelled on each card, but the plugin and this site have no connection to any award programme.'],
  ];
  return {
    heading: 'Questions',
    sources: ['/README.md', 'references/jury/rubric.md'],
    body: html`
      ${qa.map(([q, a], i) => raw(html`<h2 id="q${i + 1}">${q}</h2><p>${a}</p>`))}
      <h2 id="more">Something else</h2>
      <p>Open an issue on <a href="${core.plugin.repository}/issues" target="_blank" rel="noopener" data-external>the plugin’s repository</a>. For the component library, see ${raw(doc('components', 'Use a component'))}.</p>`,
  };
}
