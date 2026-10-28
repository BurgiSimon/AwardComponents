// Autoplay tabs — built from the awards recipe `autoplay-tabs-progress`: Auto-advancing tabs with a visible clock.
// Contract: docs/authoring.md. Render into root, read options, clean up through ctx (signal, onCleanup).
import './demo.css';
import { on, html, content } from '../../src/demo-kit/index.js';

export default function mount(root, options, ctx) {
  root.className = 'at';
  root.innerHTML = html`
    <section class="ac-section ac-wrap">
      <p class="ac-label">${content.studio.name}</p>
      <h1 class="ac-h1">Autoplay tabs</h1>
    </section>`;

  // ctx.motion is 'full' | 'reduced' | 'static'. Under reduced: no spatial movement; under static: settled at once.

  return {
    update(next, changed) {
      // Apply live; return false to ask the runtime for a re-mount instead.
      return false;
    },
  };
}
