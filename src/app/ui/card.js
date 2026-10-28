// The component card used on the welcome and browse pages.
import { html, raw, href } from '../dom.js';
import { frameImg } from '../frames.js';
import { labelChips } from '../layout.js';
import { TECH_LABELS } from '../../registry/normalize.js';

export function card(c, { eager = false, showCategory = true } = {}) {
  const tech = c.tech.length ? c.tech.map((t) => TECH_LABELS[t] || t).join(' · ') : 'CSS';
  return html`
    <a class="card" href="${href(`/components/${c.id}/`)}" data-id="${c.id}">
      <span class="card__media">${raw(frameImg(c.id, { eager, alt: '' }))}</span>
      <span class="card__body">
        <span class="card__top"><span class="card__title">${c.title}</span><span class="labels">${raw(labelChips(c, { max: 2, only: ['new', 'updated', 'experimental', 'featured'] }))}</span></span>
        <span class="card__sum">${c.summary}</span>
        <span class="card__foot">${showCategory ? raw(html`<span>${c.categoryTitle}</span><span aria-hidden="true">·</span>`) : ''}<span>${tech}</span></span>
      </span>
    </a>`;
}
