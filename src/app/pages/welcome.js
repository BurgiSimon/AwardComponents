// The welcome page: what the library is, how a prompt is made (a live, tunable example), the categories, a few
// featured components, anything new, and how to install the awards plugin.
import { components, groups, featured, loadComponent, byId } from '../../registry/index.js';
import { site } from '../../registry/site.js';
import { resolve, toParams } from '../../registry/options.js';
import { html, raw, href, reducedMotion } from '../dom.js';
import { icon } from '../icons.js';
import { frameImg } from '../frames.js';
import { card } from '../ui/card.js';
import { createPreview } from '../ui/preview.js';
import { createControls } from '../ui/controls.js';
import { createPromptPanel } from '../ui/prompt-panel.js';
import { bindCopy } from '../ui/copy.js';

const EXAMPLE = 'magnetic-button';

function wall() {
  // Featured first, then one from each category, then the rest, so the wall shows the range.
  const order = [...featured];
  for (const g of groups) for (const c of g.items) if (!order.includes(c)) { order.push(c); break; }
  for (const c of components) if (!order.includes(c)) order.push(c);
  const picks = order.slice(0, 24);
  const cols = [[], [], [], []];
  picks.forEach((c, i) => cols[i % 4].push(c));
  // Decorative: every tile is also linked from Featured, Categories and Browse, so the moving wall stays out of
  // the tab order and the accessibility tree; a visible button pauses it (WCAG 2.2.2).
  const tile = (c) => html`<a class="wall__tile" href="${href(`/components/${c.id}/`)}" tabindex="-1">${raw(frameImg(c.id, { size: 'sm', alt: '', sizes: '260px' }))}<span class="wall__name">${c.title}</span></a>`;
  return html`
    <div class="wall" aria-hidden="true">
      ${cols.map((col, i) => raw(html`<div class="wall__col" style="--dur:${[70, 86, 64, 92][i]}s" data-dir="${i % 2 ? 'down' : 'up'}"><div class="wall__track">${raw(col.map((c) => tile(c)).join(''))}${raw(col.map((c) => tile(c)).join(''))}</div></div>`))}
    </div>`;
}

export default function welcomePage() {
  const exampleId = byId.has(EXAMPLE) ? EXAMPLE : (featured[0] || components[0]).id;
  const exampleTitle = byId.get(exampleId)?.title || '';
  const fresh = components.filter((c) => c.labels.includes('new'));
  const picks = (featured.length ? featured : components).slice(0, 8);

  const node = document.createElement('div');
  node.className = 'welcome';
  node.innerHTML = html`
    <section class="hero">
      <div class="hero__copy">
        <p class="eyebrow"><span class="dot"></span>${components.length} components · built on the awards plugin</p>
        <h1 class="hero__title" tabindex="-1">Pick it.<br>Tune it.<br><em>Prompt it.</em></h1>
        <p class="hero__lede">Award-league web components — scroll set-pieces, cursors, loaders, WebGL surfaces — each with live controls and a prompt that rebuilds it inside your own project with the awards plugin for Claude Code and Codex.</p>
        <div class="hero__actions">
          <a class="btn btn--accent btn--lg" href="${href('/components/')}">Browse components ${raw(icon('arrowRight', { size: 16 }))}</a>
          <a class="btn btn--ghost btn--lg" href="#how">How prompts work</a>
        </div>
        <button class="install-chip" type="button" data-copy-install aria-label="Copy the install command">
          <span class="install-chip__k">Claude Code</span><code>${site.awards.install.claude[1]}</code>${raw(icon('copy', { size: 14 }))}
        </button>
      </div>
      ${raw(wall())}
      <button class="chip-btn wall-pause" type="button" aria-pressed="false" data-wall-pause>${raw(icon('motion', { size: 13 }))}<span>Pause the wall</span></button>
    </section>

    <section class="facts" aria-label="At a glance">
      <div><strong>${components.length}</strong><span>components, one per awards recipe</span></div>
      <div><strong>${groups.length}</strong><span>categories, from cursors to WebGL</span></div>
      <div><strong>${components.filter((c) => c.controlCount).length}</strong><span>with live controls</span></div>
      <div><strong>2</strong><span>agents: Claude Code and Codex</span></div>
    </section>

    <section class="how" id="how" aria-labelledby="how-title">
      <header class="section-head">
        <p class="eyebrow">How it works</p>
        <h2 id="how-title" class="section-title section-title--xl">A component becomes a prompt, not a paste.</h2>
        <p class="section-head__lede">Every demo here is rebuilt from a recipe the awards plugin has verified in a real browser. Tune it until it feels right; the prompt carries your settings, and the plugin rebuilds the move in your project's own tokens, type and stack.</p>
      </header>
      <ol class="steps">
        <li><span class="steps__n">1</span><div><h3>Pick</h3><p>Browse by category or press <kbd class="kbd">⌘ K</kbd>. Hover the sidebar to preview without opening.</p></div></li>
        <li><span class="steps__n">2</span><div><h3>Tune</h3><p>Every control is live. Your settings stay in the URL, so a link shares the exact setup.</p></div></li>
        <li><span class="steps__n">3</span><div><h3>Prompt</h3><p>Copy the prompt, paste it into your agent. It names the recipe and only the settings you changed.</p></div></li>
      </ol>
      <div class="how__bench" data-bench>
        <div class="how__stage" data-slot="preview"></div>
        <div class="how__panel" data-slot="controls"></div>
        <div class="how__prompt" data-slot="prompt"></div>
      </div>
      <p class="how__note">Try it: drag a slider and watch the prompt change. This is the <a href="${href(`/components/${exampleId}/`)}" data-example-link>${exampleTitle}</a>; the link keeps your settings.</p>
    </section>

    <section class="cats" aria-labelledby="cats-title">
      <header class="section-head section-head--row">
        <div><p class="eyebrow">Categories</p><h2 id="cats-title" class="section-title">Everything a page needs to be remembered.</h2></div>
        <a class="btn btn--ghost" href="${href('/components/')}">All ${components.length} ${raw(icon('arrowRight', { size: 15 }))}</a>
      </header>
      <div class="cats__grid">
        ${groups.map((g) => raw(html`
          <a class="cat-tile" href="${href(`/components/?cat=${g.id}`)}">
            <span class="cat-tile__frames">${raw(g.items.slice(0, 3).map((c) => frameImg(c.id, { size: 'sm', sizes: '200px' })).join(''))}</span>
            <span class="cat-tile__body">
              <span class="cat-tile__t">${raw(icon(g.icon, { size: 16 }))}${g.title}<span class="cat-tile__n">${g.items.length}</span></span>
              <span class="cat-tile__b">${g.blurb}</span>
            </span>
          </a>`))}
      </div>
    </section>

    ${fresh.length ? raw(html`
    <section class="picks" aria-labelledby="new-title">
      <header class="section-head section-head--row"><div><p class="eyebrow">Just added</p><h2 id="new-title" class="section-title">New in the library</h2></div><a class="btn btn--ghost" href="${href('/changelog/')}">Changelog ${raw(icon('arrowRight', { size: 15 }))}</a></header>
      <div class="grid">${raw(fresh.slice(0, 6).map((c) => card(c)).join(''))}</div>
    </section>`) : ''}

    <section class="picks" aria-labelledby="featured-title">
      <header class="section-head section-head--row"><div><p class="eyebrow">Featured</p><h2 id="featured-title" class="section-title">Start with these</h2></div></header>
      <div class="grid">${raw(picks.map((c) => card(c)).join(''))}</div>
    </section>

    <section class="install" aria-labelledby="install-title">
      <div class="install__copy">
        <p class="eyebrow">The awards plugin</p>
        <h2 id="install-title" class="section-title">The prompts need the plugin. It takes two lines.</h2>
        <p>The awards plugin teaches Claude Code and Codex how award-winning sites are built: a reference corpus, the recipes these components come from, a craft-floor audit and a jury that scores the result. Install it once; every prompt here then works in any project.</p>
        <p><a class="arrow-link" href="${site.awards.repo}" target="_blank" rel="noopener" data-external>The plugin on GitHub ${raw(icon('arrowUpRight', { size: 15 }))}</a> <a class="arrow-link" href="${href('/docs/')}">Getting started ${raw(icon('arrowRight', { size: 15 }))}</a></p>
      </div>
      <div class="install__cmds">
        ${raw(['claude', 'codex'].map((k) => html`
          <div class="cmd-card">
            <p class="cmd-card__k">${k === 'claude' ? 'Claude Code' : 'Codex'}</p>
            <pre><code>${site.awards.install[k].join('\n')}</code></pre>
            <button class="icon-btn icon-btn--sm" type="button" data-copy-cmd="${k}" aria-label="Copy the ${k === 'claude' ? 'Claude Code' : 'Codex'} commands">${raw(icon('copy', { size: 15 }))}</button>
          </div>`).join(''))}
      </div>
    </section>`;

  bindCopy(node.querySelector('[data-copy-install]'), () => site.awards.install.claude.join('\n'), { message: 'Install commands copied' });
  node.querySelectorAll('[data-copy-cmd]').forEach((b) => bindCopy(b, () => site.awards.install[b.dataset.copyCmd].join('\n'), { message: 'Commands copied' }));

  // The live example: the same preview, controls and prompt the component pages use. The page renders at once;
  // the example's full meta (controls, prompt) arrives a moment later and fills the bench.
  let preview = null;
  let prompt = null;
  let gone = false;
  loadComponent(exampleId).then((example) => {
    if (gone || !example) return;
    let values = resolve(example, {});
    const link = node.querySelector('[data-example-link]');
    preview = createPreview(example, () => values, { compact: true, height: 380 });
    prompt = createPromptPanel(example, () => values, { compact: true });
    const controls = createControls(example, values, {
      onChange(next) {
        values = next;
        preview.setValues(values);
        prompt.update();
        // The link to the component page carries what the visitor tuned here.
        const q = toParams(example, values).toString();
        link.href = href(`/components/${example.id}/`) + (q ? `?${q}` : '');
      },
    });
    node.querySelector('.how [data-slot="preview"]').append(preview.el);
    node.querySelector('.how [data-slot="controls"]').append(controls.el);
    node.querySelector('.how [data-slot="prompt"]').append(prompt.el);
  });

  // The wall drifts only while the hero is on screen, motion is allowed and the visitor has not paused it.
  const wallEl = node.querySelector('.wall');
  const pauseBtn = node.querySelector('[data-wall-pause]');
  let userPaused = false;
  let onScreen = true;
  const syncWall = () => wallEl.classList.toggle('is-paused', userPaused || !onScreen || reducedMotion());
  pauseBtn.hidden = reducedMotion();
  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseBtn.querySelector('span').textContent = userPaused ? 'Play the wall' : 'Pause the wall';
    syncWall();
  });
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; syncWall(); }, { threshold: 0 });
  io.observe(wallEl);

  return {
    node,
    title: `${site.name} — award-league components you can prompt`,
    layout: 'wide',
    destroy() { gone = true; io.disconnect(); preview?.destroy(); prompt?.destroy(); },
  };
}
