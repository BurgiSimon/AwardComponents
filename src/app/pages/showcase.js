// The showcase: the sites the awards plugin built from a written brief, each with what its jury said, round by
// round. The index lists them newest first; a build's own page has its first screen, the memory sentence, a chart
// of its weighted score against the floor, and every round with its scores and the juror's first fixes.
import { loadPlugin, AXES, ROUND_KINDS, score, longDate } from '../../registry/plugin.js';
import { site } from '../../registry/site.js';
import { html, raw, href } from '../dom.js';
import { icon } from '../icons.js';
import { verdictChip, trailDots } from '../ui/plugin-bits.js';
import notFound from './not-found.js';

const LO = 5;
const HI = 9;
const DEV = [['seo', 'Semantics and SEO'], ['anim', 'Animations'], ['a11y', 'Accessibility'], ['wpo', 'Performance'], ['resp', 'Responsive'], ['meta', 'Markup and meta']];

// The weighted score per round as a line against the ship floor; the rounds under it carry the same numbers. The
// SVG draws only lines (it stretches with the page); the labels and points are HTML placed in percentages, so text
// and circles never stretch with it.
function chart(b, floor) {
  const n = b.trail.length;
  const x = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v) => (1 - (v - LO) / (HI - LO)) * 100;
  const ticks = [5, 6, 7, 8, 9];
  const pts = b.trail.map((r, i) => `${x(i).toFixed(2)},${y(r.w).toFixed(2)}`).join(' ');
  const label = `Weighted score by round: ${b.trail.map((r, i) => `round ${i + 1} ${score(r.w)} ${r.word}`).join(', ')}. The ship floor is ${score(floor)}.`;
  return html`
    <figure class="schart" role="img" aria-label="${label}">
      <div class="schart__plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          ${ticks.map((t) => raw(html`<line class="schart__grid" x1="0" x2="100" y1="${y(t)}" y2="${y(t)}"/>`))}
          <line class="schart__floor" x1="0" x2="100" y1="${y(floor)}" y2="${y(floor)}"/>
          <polyline class="schart__line" points="${pts}"/>
        </svg>
        ${ticks.map((t) => raw(html`<span class="schart__tick" style="top:${y(t)}%" aria-hidden="true">${t}</span>`))}
        <span class="schart__floorlabel" style="top:${y(floor)}%" aria-hidden="true">ship floor ${score(floor)}</span>
        ${b.trail.map((r, i) => raw(html`<span class="schart__pt schart__pt--${r.word}${r.kind === 'component' ? ' schart__pt--part' : ''}" style="left:${x(i)}%;top:${y(r.w)}%" aria-hidden="true"></span><span class="schart__x" style="left:${x(i)}%" aria-hidden="true">${i + 1}</span>`))}
      </div>
    </figure>`;
}

function card(b) {
  return html`
    <li class="sbuild">
      <a class="sbuild__media" href="${href(`/showcase/${b.id}/`)}" tabindex="-1" aria-hidden="true">${b.frame ? raw(html`<img src="${href(b.frame)}" alt="" width="960" height="600" loading="lazy" decoding="async">`) : ''}</a>
      <div class="sbuild__body">
        <p class="sbuild__meta">${longDate(b.built)} · ${b.routes} route${b.routes > 1 ? 's' : ''} · ${b.fictional ? 'invented client' : 'the plugin’s own page'}</p>
        <h2 class="sbuild__t"><a href="${href(`/showcase/${b.id}/`)}">${b.name}</a></h2>
        <p class="sbuild__what">${b.what}</p>
        <blockquote class="sbuild__mem"><p>${b.memory.text}</p></blockquote>
        <p class="sbuild__memk">The juror’s memory of the first screen, written before it read the brief.</p>
        <div class="sbuild__verdict">
          ${raw(trailDots(b.trail))}
          <span class="sbuild__score"><b>${score(b.last.w)}</b> after ${b.rounds} round${b.rounds > 1 ? 's' : ''}</span>
          ${raw(verdictChip(b.last.word))}
        </div>
        <p class="way__links"><a class="arrow-link" href="${href(`/showcase/${b.id}/`)}">Every round ${raw(icon('arrowRight', { size: 15 }))}</a><a class="arrow-link" href="${b.source}" target="_blank" rel="noopener" data-external>Source ${raw(icon('arrowUpRight', { size: 15 }))}</a></p>
      </div>
    </li>`;
}

export default async function showcasePage() {
  const core = await loadPlugin();
  const f = core.jury.floor;
  const shipped = core.builds.filter((b) => b.last.word === 'ship').length;
  const node = document.createElement('div');
  node.className = 'showcase';
  node.innerHTML = html`
    <header class="page-head page-head--doc">
      <p class="crumbs"><a href="${href('/docs/')}">The plugin</a><span aria-hidden="true">/</span><span>Showcase</span></p>
      <h1 tabindex="-1">What the plugin built, and what its jury said</h1>
      <p class="page-head__lede">${core.builds.length} sites, each built by the awards plugin from a written brief and judged from its screenshots by a juror in a separate session. ${shipped} reached ship (${score(f.weighted)} weighted, no axis under ${score(f.axis)}); the others stopped at fix. None was entered for an award, and the clients are invented unless a build says otherwise.</p>
    </header>
    <ol class="sbuilds" role="list">${core.builds.map((b) => raw(card(b)))}</ol>
    <p class="recipes__foot">Each build’s contract, design system, jury reports and ship reports are in <a href="${core.plugin.repository}/tree/main/showcase" target="_blank" rel="noopener" data-external>the awards repository</a>. Scores are the plugin’s own jury, about 0.7 below what the award gives the same sites; <a href="${href('/docs/jury/')}">the jury</a> explains why.</p>`;
  return { node, title: `Showcase — ${site.name}`, layout: 'wide' };
}

export async function build({ params, query, url }) {
  const core = await loadPlugin();
  const i = core.builds.findIndex((b) => b.id === params[0]);
  if (i < 0) return notFound({ params, query, url });
  const b = core.builds[i];
  const f = core.jury.floor;
  const repo = core.plugin.repository;
  const file = (p) => `${repo}/blob/main/${p}`;
  const prev = core.builds[i - 1];
  const next = core.builds[i + 1];

  const round = (r, n) => html`
    <li class="round round--${r.word}">
      <header class="round__head">
        <p class="round__n">Round ${n + 1}</p>
        <p class="round__kind">${ROUND_KINDS[r.kind]}${r.target ? raw(html` <code>${r.target}</code>`) : ''} · ${longDate(r.date)}</p>
        <p class="round__score">${raw(verdictChip(r.word))}<b>${score(r.w)}</b></p>
      </header>
      <dl class="round__axes" style="--floor:${(f.axis - LO) / (HI - LO)}">
        ${AXES.map((a) => raw(html`<div class="axis${r[a.key] == null ? ' is-empty' : r[a.key] < f.axis ? ' is-low' : ''}" style="--v:${r[a.key] == null ? 0 : (r[a.key] - LO) / (HI - LO)}"><dt>${a.name}</dt><dd><span class="axis__track"><span class="axis__fill"></span></span><span class="axis__n">${r[a.key] == null ? 'not scored' : score(r[a.key])}</span></dd></div>`))}
      </dl>
      ${r.dev ? raw(html`<p class="round__dev"><b>Developer ${score(r.dev.mean)}</b> ${DEV.map(([k, l]) => `${l} ${score(r.dev[k])}`).join(' · ')}</p>`) : ''}
      ${r.resolved ? raw(html`<p class="round__res">From the round before: ${r.resolved.resolved} fixes resolved, ${r.resolved.partial} partly, ${r.resolved.unresolved} not; ${r.resolved.regressions} regression${r.resolved.regressions === 1 ? '' : 's'}.</p>`) : ''}
      ${r.fixes.length ? raw(html`<div class="round__fixes"><p>The juror’s first fixes</p><ol>${r.fixes.map((x) => raw(html`<li>${x.charAt(0).toUpperCase() + x.slice(1)}</li>`))}</ol></div>`) : ''}
      ${r.report ? raw(html`<p class="round__rep"><a href="${file(`${b.reports}/${r.report}`)}" target="_blank" rel="noopener" data-external>${raw(icon('file', { size: 13 }))}The report, ${r.report} ${raw(icon('arrowUpRight', { size: 13 }))}</a></p>`) : ''}
    </li>`;

  const node = document.createElement('div');
  node.className = 'showcase sbpage';
  node.innerHTML = html`
    <header class="page-head page-head--doc">
      <p class="crumbs"><a href="${href('/showcase/')}">Showcase</a><span aria-hidden="true">/</span><span>${b.name}</span></p>
      <h1 tabindex="-1">${b.name}</h1>
      <p class="page-head__lede">${b.what}</p>
      <p class="sbpage__meta">${b.client} Built ${longDate(b.built)}, ${b.routes} route${b.routes > 1 ? 's' : ''}, ${b.rounds} jury rounds.</p>
    </header>
    <div class="sbpage__top">
      <figure class="sbpage__shot">${b.frame ? raw(html`<img src="${href(b.frame)}" alt="The first screen of ${b.name} at 1440 by 900, as built by the plugin" width="960" height="600" decoding="async" fetchpriority="high">`) : ''}<figcaption>The first screen at 1440 × 900, captured from the build.</figcaption></figure>
      <aside class="sbpage__side">
        <div class="sbpage__final"><p>Last round</p><p class="sbpage__big">${score(b.last.w)}</p>${raw(verdictChip(b.last.word))}<p class="sbpage__axes">${AXES.map((a) => `${a.name} ${score(b.last[a.key])}`).join(' · ')}</p></div>
        <blockquote class="sbuild__mem"><p>${b.memory.text}</p></blockquote>
        <p class="sbuild__memk">The memory test, written on ${longDate(b.memory.date)} before the juror read the brief.</p>
        <ul class="sbpage__files" role="list">
          <li><a href="${file(b.awardsMd)}" target="_blank" rel="noopener" data-external>${raw(icon('file', { size: 13 }))}AWARDS.md</a></li>
          ${b.folder.startsWith('showcase/') || b.folder === 'site' ? raw(html`<li><a href="${file(`${b.folder}/DESIGN.md`)}" target="_blank" rel="noopener" data-external>${raw(icon('file', { size: 13 }))}DESIGN.md</a></li>`) : ''}
          <li><a href="${b.source}" target="_blank" rel="noopener" data-external>${raw(icon('code', { size: 13 }))}The source</a></li>
        </ul>
      </aside>
    </div>
    <section class="sbpage__sec" aria-labelledby="sb-chart">
      <h2 id="sb-chart" class="h2 h2--sm">The weighted score, round by round</h2>
      <p class="lede">Hollow points are component passes, which judge one part of the page (usually the first screen) before the rest is built. Ship needs ${score(f.weighted)} weighted and every axis at ${score(f.axis)} or more.</p>
      ${raw(chart(b, f.weighted))}
    </section>
    <section class="sbpage__sec" aria-labelledby="sb-rounds">
      <h2 id="sb-rounds" class="h2 h2--sm">Every round</h2>
      <ol class="rounds" role="list">${b.trail.map((r, n) => raw(round(r, n)))}</ol>
    </section>
    <nav class="dpager sbpage__pager" aria-label="Previous and next build">
      ${prev ? raw(html`<a class="dpager__link dpager__link--prev" href="${href(`/showcase/${prev.id}/`)}"><span class="dpager__k">${raw(icon('arrowLeft', { size: 14 }))}Newer</span><span class="dpager__t">${prev.name}</span></a>`) : raw('<span></span>')}
      ${next ? raw(html`<a class="dpager__link dpager__link--next" href="${href(`/showcase/${next.id}/`)}"><span class="dpager__k">Older${raw(icon('arrowRight', { size: 14 }))}</span><span class="dpager__t">${next.name}</span></a>`) : raw('<span></span>')}
    </nav>`;
  return { node, title: `${b.name} · Showcase — ${site.name}`, layout: 'wide' };
}

