// Docs, Start: the overview, install, a first build and the component library.
import { components as library, loadComponent } from '../../../registry/index.js';
import { docBySlug, docPath } from '../../../registry/docs.js';
import { resolve } from '../../../registry/options.js';
import { buildPrompt } from '../../../registry/prompt.js';
import { score, longDate } from '../../../registry/plugin.js';
import { site } from '../../../registry/site.js';
import { html, raw, href } from '../../dom.js';
import { icon } from '../../icons.js';
import { commandBlock } from '../../ui/plugin-bits.js';

const ext = (url, label) => html`<a href="${url}" target="_blank" rel="noopener" data-external>${label}</a>`;
const docLink = (slug, label) => html`<a href="${href(docPath(slug))}">${label || docBySlug.get(slug).title}</a>`;

export function overview(core) {
  const c = core.counts;
  const cards = ['install', 'first-build', 'components', 'skills', 'flow', 'jury', 'audit', 'corpus', 'scripts'];
  return {
    heading: 'The awards docs',
    lede: `awards is a plugin for Claude Code and Codex that designs, builds and judges websites the way award-winning ones are made. These pages cover the plugin, version ${core.plugin.version}, and the component library built from its recipes.`,
    sources: ['.claude-plugin/plugin.json'],
    body: html`
      <h2 id="two-ways">Two ways in</h2>
      <p><strong>A whole site.</strong> Ask for it in your own words, or start with <code>/awards:craft</code> in Claude Code and <code>$awards:craft</code> in Codex. The plugin asks at most three questions about the brief, deals three directions to choose from, then runs every phase from concept to ship and hands the result to a juror in a separate session. ${raw(docLink('first-build', 'Your first build'))} walks through one.</p>
      <p><strong>One component in a site you have.</strong> <code>/awards:component</code> builds one element (a hero, a menu, a cursor, a gallery) inside the site’s own world. The <a href="${href('/components/')}">component library</a> holds ${library.length} of them, each tuned live and copied as a prompt: ${raw(docLink('components', 'use a component'))}.</p>

      <h2 id="inside">What is in the plugin</h2>
      <ul>
        <li><strong>${c.skills} skills</strong>, each triggered by its own kind of request; <code>craft</code> drives the others in order for a whole site. ${raw(docLink('skills', 'Skills'))}</li>
        <li><strong>A jury agent</strong> that scores a page from its screenshots in a forked context: Design, Usability, Creativity and Content, the six developer criteria, and one word at the end. ${raw(docLink('jury', 'The jury'))}</li>
        <li><strong>${c.recipes} recipes</strong>, ${c.recipes - c.compositions} focused ones and ${c.compositions} complete compositions, each a small Vite page with a verifier that drives it in headless Chromium. <a href="${href('/recipes/')}">Recipes</a></li>
        <li><strong>A corpus</strong> of ${c.sites} award-winning sites read in depth, and ${c.patterns} pattern files that turn them into rules. ${raw(docLink('corpus', 'Corpus'))}</li>
        <li><strong>An audit</strong> of ${c.rules} rules in eight families, with no model in the loop. ${raw(docLink('audit', 'The audit'))}</li>
        <li><strong>Scripts</strong> for the environment check, captures, the seeded roll, fonts, pictures and verification. ${raw(docLink('scripts', 'Scripts'))}</li>
        <li><strong>Four hooks</strong> in Claude Code: an audit after each edit, a routing hint, a state card after compaction and a check on the juror’s last line. ${raw(docLink('hooks', 'Hooks and settings'))}</li>
        <li><strong>An eval suite</strong> of ${c.evals} cases for <code>claude plugin eval</code>, from routing checks to full builds.</li>
      </ul>

      <h2 id="pages">The pages</h2>
      <div class="dcards">
        ${cards.map((slug) => raw(html`<a class="dcard" href="${href(docPath(slug))}"><span class="dcard__t">${docBySlug.get(slug).title}${raw(icon('arrowRight', { size: 15 }))}</span><span class="dcard__b">${docBySlug.get(slug).description}</span></a>`))}
      </div>

      <h2 id="source">Where these pages come from</h2>
      <p>Every count, command, skill description, rule, jury term, corpus row and release note here is read from the plugin’s own files by <code>npm run sync-plugin</code>, then committed with the site. The pages say which file they read at the foot; this snapshot is awards ${core.plugin.version}, synced ${longDate(core.synced)}. The plugin itself lives at ${raw(ext(core.plugin.repository, 'github.com/BurgiSimon/awards'))} under the ${core.plugin.license} licence.</p>`,
  };
}

export function install(core) {
  return {
    sources: ['/README.md', 'references/stacks/versions.md'],
    body: html`
      <h2 id="clients">In Claude Code or Codex</h2>
      <p>Install it once per machine. The plugin installs as one folder: the skills, the jury agent, the hooks, the corpus, the recipes and the scripts they share.</p>
      ${raw(commandBlock(core.install.claude, { label: 'Claude Code' }))}
      ${raw(commandBlock(core.install.codex, { label: 'Codex' }))}
      <p>Start a new session afterwards. Claude Code names the skills <code>/awards:&lt;name&gt;</code>, Codex <code>$awards:&lt;name&gt;</code>; both also pick a skill on their own from what you ask. Install the whole plugin rather than copying single skill folders: they share the corpus, recipes, scripts and templates at the plugin’s root.</p>

      <h2 id="requirements">What a build needs</h2>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Needs</th><th scope="col">Version</th><th scope="col">For</th></tr></thead>
        <tbody>
          <tr><th scope="row">Node</th><td>22 LTS (22.12 or later) or 24 LTS</td><td>Builds and every script. 20.19 still runs the scripts but reached end of life on 30 April 2026, and current Astro, Nuxt and SvelteKit releases refuse it.</td></tr>
          <tr><th scope="row">Playwright with Chromium</th><td>${core.pins.playwright}</td><td>Captures, the rendered audit and the jury’s evidence. Install it before the first build: the hero is captured in phase 3, before the project has a <code>package.json</code>.</td></tr>
          <tr><th scope="row">npm and network access</th><td>any current npm</td><td>Installing the website project’s own dependencies.</td></tr>
        </tbody>
      </table></div>
      ${raw(commandBlock(core.install.browser, { label: 'Playwright and Chromium, once' }))}
      <p>A project-local install (<code>npm install --save-dev playwright@${core.pins.playwright}</code>) works too once the project exists. To use a Playwright installed elsewhere, point <code>AWARDS_PLAYWRIGHT</code> at its project folder; <code>AWARDS_CHROMIUM</code> can name a Chromium executable. Linux and cloud hosts may need the browser’s system libraries: <code>npx playwright install --with-deps chromium</code>. The static audit and the scaffold run without a browser.</p>

      <h2 id="doctor">Check the machine</h2>
      <p>Before a build, the environment check reports what is missing, from the website project’s folder. It installs nothing and changes no configuration, and it launches a real browser to prove captures will work. Exit code 2 names missing prerequisites; warnings separate an unconfigured build or unavailable WebGL from a browser failure.</p>
      ${raw(commandBlock('node <path to awards>/plugins/awards/scripts/doctor.mjs . --json'))}

      <h2 id="cloud">Cloud sessions</h2>
      <p>Claude Code cloud sessions do not inherit plugins enabled only in your local settings. In the website repository, merge this into <code>.claude/settings.json</code> and commit it, then provision Node and the browser dependencies in that environment too.</p>
      ${raw(commandBlock(JSON.stringify({ extraKnownMarketplaces: { awards: { source: { source: 'github', repo: 'burgisimon/awards' } } }, enabledPlugins: { 'awards@awards': true } }, null, 2), { label: '.claude/settings.json' }))}

      <h2 id="cowork">Cowork</h2>
      <p>Install the whole plugin through Customize, then Plugins, as a custom upload or from a marketplace. A terminal install does not reach Cowork, and single skill folders do not work alone. From a checkout of the plugin repository, a clean upload of the committed files is one command:</p>
      ${raw(commandBlock('git archive --format=zip --output=/tmp/awards.zip HEAD:plugins/awards'))}

      <h2 id="local">From a local copy</h2>
      <p>To try a checkout without the marketplace, load the plugin folder for one session, or add the checkout as a local marketplace.</p>
      ${raw(commandBlock(['git clone https://github.com/burgisimon/awards', 'claude --plugin-dir awards/plugins/awards'], { label: 'Claude Code, one session' }))}
      ${raw(commandBlock(['codex plugin marketplace add /absolute/path/to/awards', 'codex plugin add awards@awards'], { label: 'Codex, local marketplace' }))}

      <h2 id="permissions">Permissions</h2>
      <p>A build runs <code>node</code> scripts, <code>npm install</code>, <code>npm run build</code> and captures many times. The skills pre-approve their own scripts and those build commands. For the rest, Claude Code’s auto mode keeps prompts rare while a classifier checks each action; <code>acceptEdits</code> works too, with more prompts. Use <code>bypassPermissions</code> only in a disposable container or virtual machine.</p>`,
  };
}

export function firstBuild(core) {
  const phases = core.phases.flatMap((r) => r.phases);
  const SAMPLE = 'Build an award-worthy site for Saltglaze, a two-person stoneware studio. Collectors and restaurant buyers, often on a phone. The goal is enquiries for the next kiln opening.';
  const floor = core.jury.floor;
  return {
    sources: ['skills/craft/SKILL.md', '/README.md'],
    body: html`
      <h2 id="ask">Ask for the site</h2>
      <p>Open an empty folder, start a session there and say what the site is for, in your own words: the subject, who it is for, and what a visitor should do. For example:</p>
      ${raw(commandBlock(SAMPLE, { label: 'A brief' }))}
      <p><code>/awards:craft</code> is the explicit entry point. A request that asks for award-level work reaches it on its own; in Claude Code a hook adds one routing line to such a prompt.</p>

      <h2 id="questions">What it asks you</h2>
      <p>At most three questions about the brief: what only this subject can prove, who reads it and where, and what a visitor should do. Then once more, to choose between three directions dealt from seven candidate worlds by a seeded roll, or a conventional exit. Everything else is decided and written down in <code>AWARDS.md</code> and <code>DESIGN.md</code>, where you can change it.</p>

      <h2 id="phases">What happens next</h2>
      <ol class="dsteps">
        ${phases.map((p) => raw(html`<li><p><strong>${p.name}</strong> <a href="${href(`/docs/skills/${p.skill}/`)}"><code>awards:${p.skill}</code></a></p><p>${p.does} <span class="dmuted">Writes ${p.file}.</span></p></li>`))}
      </ol>

      <h2 id="time">How long it runs</h2>
      <p>A full build runs every phase and takes long: the reference build took about 45 minutes and 150 turns, and roughly $27 of API usage at the eval runner’s rates. Expect an unattended run, not a chat. ${raw(docLink('modes', 'Quick mode'))} builds one landing page with one jury round.</p>

      <h2 id="verdict">The first verdict</h2>
      <p>It is usually <span class="vchip vchip--fix">fix</span>, with a short list of located fixes. The juror is calibrated about 0.7 below the real award on purpose, so <code>fix</code> on good work is the expected result. Ship applies the list in one batch and the jury checks once more. A build ships at ${score(floor.weighted)} weighted with no axis under ${score(floor.axis)}; ${raw(docLink('jury', 'the jury'))} has the whole rule, and the <a href="${href('/showcase/')}">showcase</a> every round of ${core.builds.length} real builds.</p>

      <h2 id="result">What you get</h2>
      <ul>
        <li>The site, in the folder, on the stack the brief needed (Vite unless something else is called for).</li>
        <li><code>AWARDS.md</code>: the brief, the direction contract, the page map, the motion score, the budgets, the jury and ship logs and every accepted exception.</li>
        <li><code>DESIGN.md</code> and <code>tokens.css</code>: the visual system, with identical values.</li>
        <li><code>.awards/</code>: captures, the audit and the jury and ship reports. Keep it out of version control.</li>
      </ul>
      <p>${raw(docLink('project-files', 'Project files'))} describes each one.</p>

      <h2 id="resume">Stopping and resuming</h2>
      <p>Nothing lives only in the conversation. <code>AWARDS.md</code> opens with a <code>## Status</code> checklist, and a new session resumes from the first unticked line: <code>/awards:craft resume</code>, or <code>/awards:craft status</code> to read where it stands. In Claude Code, after a context compaction a hook re-attaches a short state card from the same file.</p>`,
  };
}

export async function components(core) {
  const example = await loadComponent('magnetic-button') || await loadComponent(library[0]?.id);
  const sample = example
    ? buildPrompt(example, { ...resolve(example, {}), ...Object.fromEntries((example.controls || []).slice(0, 1).map((c) => [c.id, c.type === 'range' ? c.max : c.default])) }, { target: 'the “Book a call” button in the hero', url: `${location.origin}${href(`/components/${example.id}/`)}` }).text
    : '';
  return {
    heading: 'Use a component',
    lede: `Every component in the library ends in a prompt for an agent with the awards plugin installed, working inside your own project. ${library.length} of them, one for each recipe.`,
    sources: ['skills/component/SKILL.md'],
    body: html`
      <h2 id="use">Tune it, copy it, paste it</h2>
      <ol>
        <li>Open a component and try it in the preview. The toolbar switches to tablet and phone widths, previews reduced motion, restarts the demo or opens it alone in a tab.</li>
        <li>Tune it under <strong>Customize</strong>. Changed controls are marked; double-click a label to reset one. The address keeps your settings, so a link shares the exact setup.</li>
        <li>Optionally say where it goes (“the hero on /about”). That names your element in the prompt instead of a placeholder.</li>
        <li>Pick your agent, copy the prompt and paste it into a session started in your project’s folder.</li>
        <li>Shortlisting for one project? <strong>Save</strong> beside a component’s title keeps it in this browser; <strong>Saved</strong> on the components page and the search palette list them again.</li>
      </ol>

      <h2 id="prompt">What a prompt says</h2>
      <p>A prompt is short on purpose. It names the skill, the job, the recipe to start from and only the settings you changed; the plugin knows the rest.</p>
      <pre class="prompt-sample"><code>${sample}</code></pre>
      <ul>
        <li><strong>The command:</strong> <code>/awards:component</code> in Claude Code, <code>$awards:component</code> in Codex. A few components route to <code>motion</code>, <code>webgl</code> or <code>stack</code> instead.</li>
        <li><strong>The job:</strong> one sentence with your target, or a bracketed placeholder to replace.</li>
        <li><strong>The recipe:</strong> the verified implementation the agent adapts. It is renamed, re-tokened and re-timed for your project, never pasted. <a href="${href('/recipes/')}">All recipes</a></li>
        <li><strong>Your settings:</strong> each changed control as a plain sentence, with its default for context.</li>
        <li><strong>A reference link</strong> back to this exact setup, which you can turn off.</li>
      </ul>

      <h2 id="after">What the plugin does with it</h2>
      <p>The <a href="${href('/docs/skills/component/')}"><code>component</code> skill</a> reads your project first: <code>DESIGN.md</code> and <code>AWARDS.md</code> if the plugin built the site, otherwise the tokens, fonts and motion library already in your CSS and <code>package.json</code>. It writes a six-line contract (job, signature, material, states, paths, cost), adapts the recipe, and proves the result in a browser capture with keyboard, touch and reduced-motion paths. It never brings a second motion library or a new palette into an existing site.</p>

      <h2 id="keys">Keyboard</h2>
      <div class="dtable"><table class="keys">
        <tbody>
          <tr><td><kbd class="kbd">⌘ K</kbd> / <kbd class="kbd">Ctrl K</kbd></td><td>Search components, docs, skills and builds</td></tr>
          <tr><td><kbd class="kbd">/</kbd></td><td>Filter the sidebar (or search, on pages without one)</td></tr>
          <tr><td><kbd class="kbd">↑</kbd> <kbd class="kbd">↓</kbd> <kbd class="kbd">↵</kbd></td><td>Move through results and open one</td></tr>
          <tr><td><kbd class="kbd">Esc</kbd></td><td>Close search or the menu, or clear the filter</td></tr>
        </tbody>
      </table></div>

      <h2 id="questions">Questions</h2>
      <h3>Can I copy the code instead?</h3>
      <p>Each component page shows its demo source under <em>Demo source</em>, and the recipes are MIT-licensed. The prompt is still the better route: the demo is written for this library’s theme, and the plugin fits the recipe to yours.</p>
      <h3>Do the prompts work without the plugin?</h3>
      <p>An agent without it will try, but it cannot read the recipe the prompt names. ${raw(docLink('install', 'Install the plugin'))} first.</p>
      <h3>Are the pictures included?</h3>
      <p>No. Demo pictures are public-domain or CC0 works from open collections, credited on each page and in ${raw(ext(`${site.repo}/blob/main/CREDITS.md`, 'CREDITS.md'))}. Your project brings its own.</p>
      <h3>Which browsers?</h3>
      <p>Current Chrome, Edge, Safari and Firefox. Components that rely on a newer feature say so in a label and ship a fallback: WebGL ones draw a still or a DOM version, scroll-driven CSS falls back to script, and view transitions fall back to plain navigation.</p>

      <h2 id="contribute">Adding components</h2>
      <p>A component is one folder, <code>components/&lt;id&gt;/</code>, with <code>meta.js</code>, <code>demo.js</code> and <code>demo.css</code>. It appears in the sidebar, search, the components page, the changelog and the prompt builder with no other edit. <code>npm run new -- &lt;id&gt; --recipe &lt;recipe-id&gt;</code> scaffolds one, <code>npm run check</code> validates it and <code>npm run frames -- --only &lt;id&gt;</code> captures its preview. The full guide is ${raw(ext(`${site.repo}/blob/main/docs/authoring.md`, 'docs/authoring.md'))}.</p>`,
  };
}

