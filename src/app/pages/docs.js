// Getting started: install the plugin, use a prompt, what a prompt contains, shortcuts, adding components.
import { components, loadComponent } from '../../registry/index.js';
import { site } from '../../registry/site.js';
import { resolve } from '../../registry/options.js';
import { buildPrompt } from '../../registry/prompt.js';
import { html, raw, href, escapeHTML } from '../dom.js';
import { icon } from '../icons.js';
import { bindCopy } from '../ui/copy.js';

export default async function docsPage() {
  const example = await loadComponent('magnetic-button') || await loadComponent(components[0]?.id);
  const sample = example
    ? buildPrompt(example, { ...resolve(example, {}), ...Object.fromEntries((example.controls || []).slice(0, 1).map((c) => [c.id, c.type === 'range' ? c.max : c.default])) }, { target: 'the “Book a call” button in the hero', url: `${location.origin}${href(`/components/${example.id}/`)}` }).text
    : '';
  const toc = [['install', 'Install the plugin'], ['use', 'Use a component'], ['prompt', 'What a prompt says'], ['after', 'What the plugin does with it'], ['keys', 'Keyboard'], ['faq', 'Questions'], ['contribute', 'Adding components']];
  const node = document.createElement('div');
  node.className = 'docs';
  node.innerHTML = html`
    <header class="page-head page-head--doc">
      <p class="eyebrow">Docs</p>
      <h1 tabindex="-1">Getting started</h1>
      <p class="page-head__lede">Every component here ends in a prompt. The prompt is for an AI coding agent — Claude Code or Codex — with the awards plugin installed, working inside your own project.</p>
    </header>
    <div class="doc">
      <nav class="doc__toc" aria-label="On this page"><p>On this page</p>${toc.map(([id, t]) => raw(html`<a href="#${id}">${t}</a>`))}</nav>
      <div class="prose doc__body">
        <h2 id="install">Install the plugin</h2>
        <p>Install it once per machine. In Claude Code:</p>
        <div class="cmd-card"><pre><code>${site.awards.install.claude.join('\n')}</code></pre><button class="icon-btn icon-btn--sm" type="button" data-copy="claude" aria-label="Copy">${raw(icon('copy', { size: 15 }))}</button></div>
        <p>In Codex:</p>
        <div class="cmd-card"><pre><code>${site.awards.install.codex.join('\n')}</code></pre><button class="icon-btn icon-btn--sm" type="button" data-copy="codex" aria-label="Copy">${raw(icon('copy', { size: 15 }))}</button></div>
        <p>The plugin verifies its work with screenshots, so install Playwright and Chromium once too (<code>npm install --global playwright</code>, then <code>npx playwright install chromium</code>). Builds need Node 22 or 24. The <a href="${site.awards.repo}" target="_blank" rel="noopener" data-external>plugin's README</a> has the details, cloud sessions and Cowork included.</p>

        <h2 id="use">Use a component</h2>
        <ol>
          <li>Open a component and try it in the preview. The toolbar switches to tablet and phone widths, previews reduced motion, restarts the demo or opens it alone in a tab.</li>
          <li>Tune it in <strong>Customize</strong>. Changed controls are marked; double-click a label to reset one. The URL keeps your settings.</li>
          <li>Optionally say where it goes (“the hero on /about”). That names your element in the prompt instead of a placeholder.</li>
          <li>Pick your agent, copy the prompt and paste it into a session started in your project's folder.</li>
          <li>Shortlisting for one project? <strong>Save</strong> beside a component's title keeps it in this browser; <strong>Saved</strong> on the components page and the search palette list them again.</li>
        </ol>

        <h2 id="prompt">What a prompt says</h2>
        <p>A prompt is short on purpose. It names the skill, the job, the recipe to start from and only the settings you changed — the plugin knows the rest.</p>
        <pre class="prompt-sample"><code>${sample}</code></pre>
        <ul>
          <li><strong>The command</strong> — <code>/awards:component</code> in Claude Code, <code>$awards:component</code> in Codex. A few components route to <code>motion</code>, <code>webgl</code> or <code>stack</code> instead.</li>
          <li><strong>The job</strong> — one sentence with your target, or a bracketed placeholder to replace.</li>
          <li><strong>The recipe</strong> — the verified implementation in the plugin the agent adapts. It is renamed, re-tokened and re-timed for your project, never pasted.</li>
          <li><strong>Your settings</strong> — each changed control as a plain sentence, with its default for context.</li>
          <li><strong>A reference link</strong> back to this exact setup, which you can turn off.</li>
        </ul>

        <h2 id="after">What the plugin does with it</h2>
        <p>The <code>component</code> skill reads your project first: <code>DESIGN.md</code> and <code>AWARDS.md</code> if the plugin built the site, otherwise the tokens, fonts and motion library already in your CSS and <code>package.json</code>. It writes a six-line contract (job, signature, material, states, paths, cost), adapts the recipe, and proves the result in a browser capture with keyboard, touch and reduced-motion paths. It never brings a second motion library or a new palette into an existing site.</p>

        <h2 id="keys">Keyboard</h2>
        <table class="keys">
          <tbody>
            <tr><td><kbd class="kbd">⌘ K</kbd> / <kbd class="kbd">Ctrl K</kbd></td><td>Search everything</td></tr>
            <tr><td><kbd class="kbd">/</kbd></td><td>Filter the sidebar (or search, on pages without one)</td></tr>
            <tr><td><kbd class="kbd">↑</kbd> <kbd class="kbd">↓</kbd> <kbd class="kbd">↵</kbd></td><td>Move through results and open one</td></tr>
            <tr><td><kbd class="kbd">Esc</kbd></td><td>Close search, the drawer, or clear the filter</td></tr>
          </tbody>
        </table>

        <h2 id="faq">Questions</h2>
        <h3>Can I copy the code instead?</h3>
        <p>Each page shows its demo source under <em>Demo source</em>, and the recipes are MIT-licensed. The prompt is still the better route: the demo is written for this library's theme, and the plugin fits the recipe to yours.</p>
        <h3>Do the prompts work without the plugin?</h3>
        <p>An agent without it will try, but it cannot read the recipe the prompt names. Install the plugin first.</p>
        <h3>Are the pictures included?</h3>
        <p>No. Demo pictures are public-domain or CC0 works from open collections, credited on each page and in <a href="${site.repo}/blob/main/CREDITS.md" target="_blank" rel="noopener" data-external>CREDITS.md</a>. Your project brings its own.</p>
        <h3>Which browsers?</h3>
        <p>Current Chrome, Edge, Safari and Firefox. Components that rely on a newer feature say so in a label and ship a fallback: WebGL ones draw a still or DOM version, scroll-driven CSS falls back to script, and view transitions fall back to plain navigation.</p>

        <h2 id="contribute">Adding components</h2>
        <p>A component is one folder, <code>components/&lt;id&gt;/</code>, with <code>meta.js</code>, <code>demo.js</code> and <code>demo.css</code>. It appears in the sidebar, search, browse page, changelog and prompt builder with no other edit. <code>npm run new -- &lt;id&gt; --recipe &lt;recipe-id&gt;</code> scaffolds one; <code>npm run check</code> validates it; <code>npm run frames -- --only &lt;id&gt;</code> captures its preview. The full guide is <a href="${site.repo}/blob/main/docs/authoring.md" target="_blank" rel="noopener" data-external>docs/authoring.md</a>.</p>
      </div>
    </div>`;
  node.querySelectorAll('[data-copy]').forEach((b) => bindCopy(b, () => site.awards.install[b.dataset.copy].join('\n'), { message: 'Commands copied' }));
  return { node, title: `Getting started — ${site.name}`, layout: 'wide' };
}
