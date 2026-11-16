#!/usr/bin/env node
// Snapshot what the plugin pages print from the awards repository, so this repository stands alone and its pages
// cannot drift from the plugin: every count, command, skill, rule, jury term, corpus row, release note and showcase
// verdict is read here. Two files, both generated (never edit them by hand):
//   src/registry/plugin.json      the core facts the home page and most docs pages need (loaded with the page)
//   src/registry/plugin-ref.json  the long tables: rules, corpus, patterns, recipe details, releases (loaded on demand)
// and public/builds/<id>-desktop.webp, the showcase builds' first screens, copied from the awards site when it has one
// (`npm run builds` captures the others). Anything this script cannot read stops it with the file it needed.
// Usage: node scripts/sync-plugin.mjs [--awards <path to the awards repository>]   (default: ../awards or $AWARDS_DIR)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { BUILDS } from './data/builds.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argIndex = process.argv.indexOf('--awards');
const awards = path.resolve(root, argIndex > -1 ? process.argv[argIndex + 1] : process.env.AWARDS_DIR || '../awards');
const plugin = path.join(awards, 'plugins/awards');

const fail = (message) => { console.error(`sync-plugin: ${message}`); process.exit(1); };
if (!fs.existsSync(path.join(plugin, '.claude-plugin/plugin.json'))) fail(`no plugin at ${plugin}; pass --awards <path to the awards repository>`);
const read = (rel, base = plugin) => {
  const abs = path.join(base, rel);
  if (!fs.existsSync(abs)) fail(`needs ${path.relative(awards, abs)}, which is not on disk`);
  return fs.readFileSync(abs, 'utf8');
};
const json = (rel, base) => JSON.parse(read(rel, base));
const section = (text, name, file) => text.split(/^## /m).find((s) => s.startsWith(name)) ?? fail(`${file} has no "## ${name}"`);
const cells = (row) => row.split('|').slice(1, -1).map((c) => c.trim());
// Markdown table rows under a heading (skips the header and the rule).
const tableRows = (text) => text.split('\n').filter((l) => l.startsWith('|')).slice(2).map(cells);

// ---- The manifest, the install commands, the pins ------------------------------------------------------------------

const manifest = json('.claude-plugin/plugin.json');
const codexManifest = fs.existsSync(path.join(plugin, '.codex-plugin/plugin.json')) ? json('.codex-plugin/plugin.json') : null;
const repository = String(manifest.repository || '').replace(/\.git$/, '').replace('github.com/burgisimon/', 'github.com/BurgiSimon/');

// Fenced code blocks of one `### heading` inside `## Install` of the repository README: the published repository's
// commands, never the local-checkout form with an absolute path in it.
function installCommands() {
  const text = read('README.md', awards);
  const install = section(text, 'Install', 'README.md');
  const blocksUnder = (heading) => {
    const part = install.split(/^### /m).find((s) => s.startsWith(heading)) ?? fail(`README.md "## Install" has no "### ${heading}"`);
    return [...part.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1].split('\n').map((l) => l.trim()).filter(Boolean));
  };
  const pick = (heading, re) => blocksUnder(heading).find((lines) => lines.length && lines.every((l) => re.test(l)) && !lines.some((l) => l.includes('/absolute/path')))
    ?? fail(`README.md "### ${heading}" has no published-repository command block`);
  const browser = blocksUnder('Runtime requirements').find((lines) => lines.some((l) => l.startsWith('npm install --global playwright'))) ?? fail('README.md has no Playwright install block');
  return { claude: pick('Claude Code', /^\/plugin /), codex: pick('Codex', /^codex plugin /), browser };
}

function pins() {
  const text = read('references/stacks/versions.md');
  const out = {};
  for (const pkg of ['playwright', 'gsap', 'lenis', 'three', 'vite', 'ogl', 'animejs', 'postprocessing']) {
    const row = text.split('\n').find((l) => l.startsWith(`| ${pkg} |`));
    const v = row && cells(row)[1];
    if (pkg === 'playwright' && !v) {
      // Playwright is pinned in the recipes' package.json rather than the library table.
      out[pkg] = json('recipes/package.json').devDependencies?.playwright ?? json('recipes/package.json').dependencies?.playwright ?? fail('no Playwright pin');
    } else if (v) out[pkg] = v;
  }
  return out;
}

// ---- Skills --------------------------------------------------------------------------------------------------------

const frontmatter = (text) => {
  const head = text.split(/^---$/m)[1] ?? '';
  const field = (name) => {
    const m = new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(head);
    if (!m) return null;
    let v = m[1].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
    return v;
  };
  return { name: field('name'), description: field('description'), hint: field('argument-hint'), context: field('context'), agent: field('agent'), effort: field('effort') };
};
const firstSentence = (s) => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s).trim();
const bullets = (block) => block.split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2).trim());

// The order a build meets them; research last because it feeds the corpus rather than a build.
const SKILL_ORDER = ['craft', 'concept', 'system', 'structure', 'stack', 'motion', 'webgl', 'component', 'jury', 'ship', 'research'];
// One line per skill for lists where the full description is too long. A new skill needs its line here.
const SKILL_SHORT = {
  craft: 'Builds a whole site end to end and owns AWARDS.md; the entry point when you are unsure which skill applies.',
  concept: 'Finds the one idea, the story and the signature; deals three directions and writes the direction contract.',
  system: 'The type contract, the colour strategy and the tokens; writes DESIGN.md and tokens.css.',
  structure: 'The page map, the hero archetype, the components and the semantic skeleton, 404 included.',
  stack: 'Scaffolds Vite, Next, Nuxt, Astro or SvelteKit with Lenis and GSAP on one ticker.',
  motion: 'The motion score: preloader, reveals, scrubs, cursor, transitions and reduced-motion tiers.',
  webgl: 'The GL layer in Three.js, OGL or React Three Fiber, with quality tiers and a page that works without it.',
  component: 'One award-level component inside a site that already exists, inheriting its world.',
  jury: 'Scores the page from screenshots in a fresh context, then returns ordered fixes and one word.',
  ship: 'Applies the fixes in one batch, then runs the audit, captures, budgets and meta checks.',
  research: 'Turns a reference site into a case-study card in the corpus format.',
};

function skills() {
  const dirs = fs.readdirSync(path.join(plugin, 'skills')).filter((d) => fs.existsSync(path.join(plugin, 'skills', d, 'SKILL.md')));
  for (const d of dirs) if (!SKILL_ORDER.includes(d)) fail(`skill "${d}" has no place in SKILL_ORDER (scripts/sync-plugin.mjs)`);
  return SKILL_ORDER.filter((d) => dirs.includes(d)).map((id) => {
    const file = `skills/${id}/SKILL.md`;
    const text = read(file);
    const fm = frontmatter(text);
    if (!fm.description) fail(`${file} has no description`);
    const body = text.split(/^---$/m).slice(2).join('---');
    const h1 = /^# awards:[a-z]+(?:\s+—\s+(.+))?$/m.exec(body);
    // The first paragraph after the title that speaks about the skill (not the Codex note, not an argument list,
    // not the jury's instruction to itself).
    const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const start = paras.findIndex((p) => p.startsWith('# '));
    const intro = paras.slice(start + 1).find((p) => !/^(Codex:|Arguments:|- |## |You are)/.test(p)) ?? null;
    const sections = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    const refuse = /^## Refuse\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(body);
    const next = [...new Set([...body.matchAll(/Invoke the `awards:([a-z]+)` skill/g)].map((m) => m[1]).filter((n) => n !== id))];
    if (!SKILL_SHORT[id]) fail(`skill "${id}" has no line in SKILL_SHORT (scripts/sync-plugin.mjs)`);
    return {
      id,
      short: SKILL_SHORT[id],
      title: h1?.[1]?.trim() ?? null,
      description: fm.description,
      lead: firstSentence(fm.description),
      intro: intro && intro.startsWith('#') ? null : intro,
      hint: fm.hint,
      forked: fm.context === 'fork' ? fm.agent : null,
      effort: fm.effort,
      sections: sections.filter((s) => !['Setup', 'Verify', 'Hand-off', 'Refuse'].includes(s)),
      refuse: refuse ? bullets(refuse[1]) : [],
      next,
      file,
    };
  });
}

// ---- Jury ------------------------------------------------------------------------------------------------------------

const DISPOSITIONS = ['ship', 'fix', 'rebuild', 'recapture'];
function jury() {
  const agent = read('agents/awards-jury.md');
  const disp = section(agent, 'Dispositions', 'agents/awards-jury.md');
  const lines = new Map([...disp.matchAll(/^- `([a-z]+)` — (.+)$/gm)].map((m) => [m[1], m[2].trim()]));
  for (const d of DISPOSITIONS) if (!lines.has(d)) fail(`agents/awards-jury.md ## Dispositions has no line for \`${d}\``);
  const rubric = read('references/jury/rubric.md');
  const axesPart = section(rubric, 'Axes and weights', 'rubric.md');
  const axes = tableRows(axesPart.split('\n\n').find((p) => p.startsWith('| Axis | Weight'))).map(([axis, weight, measures]) => ({ axis, weight: Number(weight), measures }));
  if (axes.length !== 4 || axes.reduce((s, a) => s + a.weight, 0) !== 100) fail('rubric.md axes do not add up to four axes and 100');
  const calib = tableRows(axesPart.split('\n\n').find((p) => p.startsWith('| Axis | min'))).map(([axis, min, median, max]) => ({ axis, min: +min, median: +median, max: +max }));
  const dev = tableRows(section(rubric, 'Developer criteria', 'rubric.md').split('\n\n').find((p) => p.startsWith('| Criterion'))).map(([name, high, mid, low]) => ({ name, high, mid, low }));
  const raise = tableRows(section(rubric, 'What moves each axis', 'rubric.md')).map(([axis, does, not]) => ({ axis, do: does, not }));
  const honest = section(rubric, 'How to score honestly', 'rubric.md').split('\n').filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, ''));
  // The ship floor, read from the ship disposition so the pages print what the juror applies.
  const floor = /weighted ([\d.]+) or higher, no axis below ([\d.]+)/.exec(lines.get('ship')) ?? fail('the ship disposition no longer names its floor');
  // The caps the juror applies after scoring, as the agent states them.
  const caps = /^- Apply the caps mechanically: (.+)$/m.exec(agent)?.[1] ?? fail('agents/awards-jury.md no longer states its caps');
  return {
    axes,
    calibration: calib,
    developer: dev,
    raise,
    honest,
    dispositions: DISPOSITIONS.map((id) => ({ id, rule: lines.get(id) })),
    order: 'recapture, rebuild, fix, ship',
    floor: { weighted: +floor[1], axis: +floor[2] },
    caps: caps.charAt(0).toUpperCase() + caps.slice(1),
  };
}

// ---- Audit rules -----------------------------------------------------------------------------------------------------

const FAMILIES = [
  ['fonts', 'Type', 'T'],
  ['contrast', 'Colour', 'C'],
  ['motion', 'Motion', 'M'],
  ['a11y', 'Accessibility', 'A'],
  ['layout', 'Layout', 'L'],
  ['perf', 'Performance', 'P'],
  ['surfaces', 'Browser surfaces', 'S'],
  ['slop', 'Slop scan', 'X'],
];
function rules() {
  const byId = json('scripts/data/rules.json');
  const list = Object.entries(byId).map(([id, r]) => ({ id, severity: r.severity, scope: r.scope, message: r.message, fix: r.fix || '', rendered: /\(rendered\b/.test(r.message) }));
  for (const r of list) if (!FAMILIES.some(([s]) => s === r.scope)) fail(`rule ${r.id} has scope "${r.scope}", which has no family name here`);
  return list;
}

// ---- Corpus ----------------------------------------------------------------------------------------------------------

function corpus() {
  const text = read('references/sites/_index.md');
  const table = text.split('<!-- index:start')[1]?.split('<!-- index:end')[0] ?? fail('references/sites/_index.md has no generated index block');
  const rows = table.split('\n').filter((l) => l.startsWith('| `'));
  const skeletonDir = path.join(plugin, 'references/sites/skeletons');
  const skeletons = new Set(fs.existsSync(skeletonDir) ? fs.readdirSync(skeletonDir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)) : []);
  const sites = rows.map((row) => {
    const [slug, site, cls, industry, routes, mode, narrative, dosage, scroll, palette, type, awardsCell, confidence, verified] = cells(row);
    const id = slug.replace(/`/g, '');
    const card = fs.existsSync(path.join(plugin, `references/sites/${id}.md`)) ? read(`references/sites/${id}.md`) : '';
    const url = /^# .+? — (https?:\/\/\S+)/m.exec(card)?.[1] ?? null;
    return {
      id, site, class: cls, industry, routes, mode, narrative, dosage, scroll: scroll.replace(/ …$/, '…'), palette, type,
      awards: awardsCell, confidence: confidence.split(/[\s(]/)[0], verified, url,
      skeleton: skeletons.has(id), clone: id === 'floema-jewelry',
    };
  });
  const patterns = fs.readdirSync(path.join(plugin, 'references/patterns')).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const t = read(`references/patterns/${f}`);
    const title = /^# (.+)$/m.exec(t)?.[1]?.trim() ?? f;
    const lead = t.split(/\n{2,}/).map((p) => p.trim()).find((p) => p && !p.startsWith('#') && !p.startsWith('<!--') && !p.startsWith('|'));
    const contents = [...t.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()).filter((h) => h !== 'Contents');
    return { id: f.slice(0, -3), title, lead: lead ? lead.replace(/^What this file is for:\s*/i, '').replace(/\s+/g, ' ') : '', sections: contents.slice(0, 14) };
  });
  return { sites, patterns, skeletons: sites.filter((s) => s.skeleton).length };
}

// ---- Recipes -------------------------------------------------------------------------------------------------------

function recipes() {
  const dir = path.join(plugin, 'recipes');
  const vocab = json('scripts/data/recipe-tags.json');
  const items = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && fs.existsSync(path.join(dir, d.name, 'recipe.json')))
    .map((d) => json(`recipes/${d.name}/recipe.json`))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({ id: r.id, title: r.title, intent: r.intent || '', group: r.group, summary: r.summary || '', tags: r.tags || [], tier: r.tier, deps: r.deps || [], seenIn: r.seenIn || [], verified: r.verified?.date || null, added: r.added || null }));
  for (const r of items) if (!vocab.groups[r.group]) fail(`recipe ${r.id} has group "${r.group}", which recipe-tags.json does not define`);
  const groups = Object.entries(vocab.groups).map(([id, g]) => ({ id, title: g.title, about: g.about || '', count: items.filter((r) => r.group === id).length }));
  const drafts = fs.existsSync(path.join(dir, '_drafts')) ? fs.readdirSync(path.join(dir, '_drafts')).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(dir, '_drafts', d, 'recipe.json'))).length : 0;
  return { groups, items, drafts };
}

// ---- Showcase records ------------------------------------------------------------------------------------------------

// One `## Jury log` line → a round. Formats (awards:jury): `date · [component <sel> · | verdict · | baseline ·]
// <disposition> · D a / U b / C c [/ Co d] → [mean ]w · [dev … → m ·] [resolved … ·] … [· .awards/jury/<file>.md]`.
const LINE = /^- (\d{4}-\d{2}-\d{2}) · (?:component ([^·]+?) · |(verdict) · |(baseline) · )?(ship|fix|rebuild|recapture) · D ([\d.]+) \/ U ([\d.]+) \/ C ([\d.]+)(?: \/ Co ([\d.]+))? → (?:mean )?([\d.]+)(.*)$/;
const DEV = /dev seo ([\d.]+) \/ anim ([\d.]+) \/ a11y ([\d.]+) \/ wpo ([\d.]+) \/ resp ([\d.]+) \/ meta ([\d.]+) → ([\d.]+)/;
const VERDICT = /resolved (\d+) \/ partial (\d+) \/ unresolved (\d+) · regressions (\d+)/;

// "1) … 2) … 3) …" → the items, splitting only on the next number in sequence at a word boundary, so a file
// reference such as `index.html:27)` never starts an item.
function numbered(line) {
  if (!line) return [];
  const starts = [];
  let from = 0;
  for (let n = 1; n < 10; n++) {
    const re = new RegExp(`(^|\\s)${n}\\) `, 'g');
    re.lastIndex = from;
    const m = re.exec(line);
    if (!m) break;
    starts.push(m.index + m[1].length);
    from = m.index + m[0].length;
  }
  return starts.map((at, i) => line.slice(at, starts[i + 1] ?? line.length).replace(/^\d\)\s*/, '').trim().replace(/[;,]?\s+(then|also)\b.*$/, '').replace(/[;,]$/, '')).filter(Boolean);
}

function rounds(text, file) {
  const log = section(text, 'Jury log', file);
  const lines = log.split('\n');
  const out = [];
  lines.forEach((raw, i) => {
    if (!raw.startsWith('- 2')) return;
    const m = LINE.exec(raw);
    if (!m) fail(`${file}: a Jury log line the record cannot read: ${raw.slice(0, 90)}`);
    const [, date, component, verdict, baseline, word, d, u, c, co, w, rest] = m;
    const kind = component ? 'component' : verdict ? 'verdict' : baseline ? 'baseline' : 'page';
    const dev = DEV.exec(rest);
    const v = VERDICT.exec(rest);
    const fixesLine = lines[i + 1]?.trim().startsWith('top fixes') ? lines[i + 1].trim().replace(/^top fixes(?: \([^)]*\))?:\s*/, '') : '';
    const fixes = numbered(fixesLine).slice(0, 3);
    out.push({
      date, kind, target: component?.trim() || null, word, d: +d, u: +u, c: +c, co: co ? +co : null, w: +w,
      dev: dev ? { seo: +dev[1], anim: +dev[2], a11y: +dev[3], wpo: +dev[4], resp: +dev[5], meta: +dev[6], mean: +dev[7] } : null,
      resolved: v ? { resolved: +v[1], partial: +v[2], unresolved: +v[3], regressions: +v[4] } : null,
      report: /\.awards\/jury\/([\w.-]+\.md)/.exec(rest)?.[1] ?? null,
      fixes,
    });
  });
  return out;
}

// The first paragraph line under a report's `## Memory test` (written before the juror read the contract).
function memory(rel) {
  const text = read(rel, awards);
  const sec = text.split(/^## /m).find((s) => s.startsWith('Memory test')) ?? fail(`${rel} has no "## Memory test"`);
  const line = sec.split('\n').slice(1).map((l) => l.trim()).find((l) => l && !/^[(|-]/.test(l)) ?? fail(`${rel}: no memory sentence`);
  const quoted = /^["“](.+?)["”](?=\s|$)/.exec(line);
  return quoted ? quoted[1] : line;
}

function builds() {
  const framesSrc = path.join(awards, 'site/public/builds');
  const framesOut = path.join(root, 'public/builds');
  fs.mkdirSync(framesOut, { recursive: true });
  return BUILDS.map((b) => {
    const text = read(b.awards, awards);
    let trail = rounds(text, b.awards);
    if (b.skipFirstBaseline && trail[0]?.kind === 'baseline') trail = trail.slice(1);
    // A baseline inside a trail is kept only as its last line: a later jury re-scoring the finished build.
    trail = trail.filter((r, i) => r.kind !== 'baseline' || i === trail.length - 1);
    for (const r of trail) {
      if (!r.report && r.kind === 'verdict' && fs.existsSync(path.join(awards, b.reports, `${r.date}-verdict.md`))) r.report = `${r.date}-verdict.md`;
    }
    const scored = trail.filter((r) => r.kind !== 'component');
    if (!scored.length) fail(`${b.awards}: no page round in the Jury log`);
    const first = scored.find((r) => r.kind === 'page' && r.report) ?? fail(`${b.awards}: no page round names its report`);
    const frame = `builds/${b.id}-desktop.webp`;
    const src = path.join(framesSrc, `${b.id}-desktop.webp`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(root, 'public', frame));
    const hasFrame = fs.existsSync(path.join(root, 'public', frame));
    if (!hasFrame) console.warn(`sync-plugin: public/${frame} is missing; run npm run builds -- --only ${b.id}`);
    const sha = (() => { try { return execFileSync('git', ['log', '-1', '--format=%h', '--', b.folder], { cwd: awards, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch { return null; } })();
    const { awards: _a, skipFirstBaseline: _s, ...authored } = b;
    return {
      ...authored,
      awardsMd: b.awards,
      source: `${repository}/tree/main/${b.folder}`,
      commit: sha,
      trail,
      last: scored[scored.length - 1],
      first: scored[0],
      memory: { text: memory(`${b.reports}/${first.report}`), date: first.date },
      rounds: trail.length,
      frame: hasFrame ? frame : null,
    };
  });
}

// ---- How a build goes: one real line per phase, from the Museum of Extinct Colours ----------------------------------

function clip(text, max = 25) {
  const clean = text.replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  if (words.length <= max) return clean.replace(/[;,:]$/, '');
  let cut = words.slice(0, max).join(' ');
  const stop = Math.max(cut.lastIndexOf(';'), cut.lastIndexOf(':'), cut.lastIndexOf(','));
  if (stop > cut.length * 0.55) cut = cut.slice(0, stop);
  return `${cut.replace(/[;,:(]\s*$/, '')} …`;
}

function phases() {
  const DIR = 'showcase/extinct';
  const awardsMd = read(`${DIR}/AWARDS.md`, awards);
  const design = read(`${DIR}/DESIGN.md`, awards);
  const sec = (name) => section(awardsMd, name, `${DIR}/AWARDS.md`);
  const field = (name) => new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, 'm').exec(awardsMd)?.[1] ?? fail(`${DIR}/AWARDS.md has no "${name}" line`);
  const pageRows = sec('Page map').split('\n').filter((l) => /^\| (\d+|—) \|/.test(l));
  const scoreRows = sec('Motion score').split('\n').filter((l) => /^\| (?!Moment|---)/.test(l));
  const juryLine = sec('Jury log').split('\n').find((l) => / · rebuild · /.test(l)) ?? fail('no rebuild line in the extinct Jury log');
  const shipLine = sec('Ship log').split('\n').find((l) => l.startsWith('- 2')) ?? fail('no Ship log line in the extinct AWARDS.md');
  const budgets = sec('Budgets & tiers');
  const gl = /GL chunk \(gz\): ([^·]+)/.exec(budgets)?.[1] ?? fail('no GL chunk figure in the extinct budgets');
  const stack = /^- Stack: (.+)$/m.exec(budgets)?.[1] ?? fail('no Stack line in the extinct budgets');
  const strategy = /^- \*\*Colour strategy:\*\* (.+)$/m.exec(design)?.[1] ?? fail('no colour strategy in the extinct DESIGN.md');
  const signature = /^- \*\*SIGNATURE:\*\* (.+)$/m.exec(awardsMd)?.[1] ?? fail('no SIGNATURE in the extinct AWARDS.md');
  return [
    { name: 'Decide', phases: [
      { id: 'brief', name: 'Brief', skill: 'craft', does: 'At most three questions: what only this subject can prove, who reads it and where, and what a visitor should do.', file: 'AWARDS.md · Brief', quote: clip(field('Stakes and conversion \\(what a visitor should do, matched to the price of the decision\\)')) },
      { id: 'concept', name: 'Concept', skill: 'concept', does: 'Seven candidate worlds, three dealt by a seeded roll, one locked and written down as a direction contract.', file: 'AWARDS.md · Direction contract', quote: clip(field('THESIS')) },
      { id: 'system', name: 'System', skill: 'system', does: 'One type contract, two to four colour tokens under a named strategy, self-hosted faces, every browser surface themed.', file: 'DESIGN.md · tokens.css', quote: clip(strategy) },
    ] },
    { name: 'Build', phases: [
      { id: 'structure', name: 'Structure', skill: 'structure', does: 'Chapters with beats, one interruption and a designed close, as semantic HTML before any motion. The hero is built and judged first.', file: 'AWARDS.md · Page map', quote: `${pageRows.length} rows, the 404 among them: ${clip(pageRows.map((r) => cells(r)[1]).join(' · '), 22)}` },
      { id: 'stack', name: 'Stack', skill: 'stack', does: 'Vite by default; Lenis and GSAP on one ticker, and a hook that lets captures drive the page.', file: 'AWARDS.md · Budgets & tiers', quote: clip(stack) },
      { id: 'motion', name: 'Motion', skill: 'motion', does: 'One authored moment per chapter, each with a reduced-motion tier, never a global animation kill.', file: 'AWARDS.md · Motion score', quote: `${scoreRows.length} rows. ${clip(cells(scoreRows.find((r) => /Signature/.test(r)) ?? scoreRows[0]).slice(0, 2).join(': '), 20)}` },
      { id: 'webgl', name: 'WebGL', skill: 'webgl', does: 'Only where a beat needs depth: its own lazy chunk, a DOM mirror, and a page that works without it.', file: 'the GL chunk, or a written decline', quote: clip(`GL chunk: ${gl.trim()}. ${signature}`, 24) },
    ] },
    { name: 'Judge', phases: [
      { id: 'jury', name: 'Jury', skill: 'jury', does: 'A juror in a separate session reads the captures before the contract, scores four axes and ends on one word.', file: '.awards/jury/ · Jury log', quote: clip(juryLine.replace(/^- /, '').replace(/ · \.awards\/jury\/\S+$/, '')) },
      { id: 'ship', name: 'Ship', skill: 'ship', does: 'The fixes in one batch, the audit clean or every exception explained, the performance measured.', file: '.awards/ship/ · Ship log', quote: clip(shipLine.replace(/^- /, '').replace(/ · \.awards\/ship\/\S+$/, '').replace(/ from \S+manifest\.json/, '')) },
    ] },
  ];
}

// A finished build's `## Status` checklist, for the home page: what a build's memory looks like at the end.
function statusSample() {
  const file = 'showcase/wrenmouth-lido/AWARDS.md';
  const lines = section(read(file, awards), 'Status', file).split('\n').filter((l) => /^- \[[ x]\] /.test(l));
  if (!lines.length) fail(`${file} ## Status has no checklist`);
  return { build: 'The Wrenmouth Lido', file, lines: lines.map((l) => ({ done: l[3] === 'x', text: l.slice(6).split(' — ')[0].trim() })) };
}

// The project templates: AWARDS.md's sections and the direction contract's blocks, DESIGN.md's sections.
function templates() {
  const awardsMd = read('assets/templates/AWARDS.md');
  const designMd = read('assets/templates/DESIGN.md');
  const contract = [...section(awardsMd, 'Direction contract', 'assets/templates/AWARDS.md').matchAll(/^- \*\*([A-Z &]+):\*\*\s*(.+)$/gm)].map((m) => ({ block: m[1], rule: m[2].trim() }));
  if (contract.length < 8) fail('assets/templates/AWARDS.md ## Direction contract lists fewer than eight blocks');
  return {
    awards: [...awardsMd.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()),
    design: [...designMd.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()),
    contract,
  };
}

// ---- Release notes ---------------------------------------------------------------------------------------------------

function releases() {
  const text = read('CHANGELOG.md', awards);
  return text.split(/^## /m).slice(1).map((block) => {
    const [head, ...lines] = block.split('\n');
    const m = /^(\S+)(?: — (\d{4}-\d{2}-\d{2}))?/.exec(head.trim());
    const body = lines.join('\n').trim();
    const paras = body.split(/\n{2,}/);
    const intro = paras.filter((p) => !p.startsWith('- ')).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const items = body.split('\n').filter((l) => l.startsWith('- ')).map((l) => {
      const im = /^- \*\*(.+?)\*\*\s*(.*)$/.exec(l);
      return im ? { title: im[1].replace(/\.$/, ''), body: im[2].trim() } : { title: '', body: l.slice(2).trim() };
    });
    return { version: m?.[1] ?? head.trim(), date: m?.[2] ?? null, intro, items };
  });
}

// ---- Scripts and hooks: what each one is for is authored; that it exists is checked ---------------------------------

const SCRIPTS = [
  ['doctor.mjs', '<project> [--json]', 'Checks Node, npm, the dependencies, Playwright and an actual browser launch before a build. Installs nothing and changes no configuration; exit 2 names what is missing.', 'Setup'],
  ['new-project.mjs', '--stack vite|next|nuxt|astro|sveltekit --name <dir> [--webgl]', 'Copies a scaffold with one ticker and the capture hook already wired.', 'Setup'],
  ['roll.mjs', '--deal 3 --of 7 [--seed <key>] [--engines …] | --stimulus 2 | --choose a,b,c', 'The seeded roll the concept skill deals directions, outside stimuli, colour strategies and hero archetypes with.', 'Decide'],
  ['fonts.mjs', 'search --category <class> | specimen --fonts <ids> --text "<headline>" | fetch --font <id>', 'Faces chosen by character from the open Fontsource catalogue: a seeded pull, a rendered specimen of your own headline, then the files and their licence.', 'Decide'],
  ['design-md.mjs', 'lint | export --format dtcg|css-tailwind|json-tailwind | snapshot | diff', 'DESIGN.md through Google’s design.md tools: lint it, export its tokens, or diff them between rounds.', 'Decide'],
  ['assets.mjs', 'search "<query>" | get <ref> | add --file <f> --kind … | check | credits', 'Real pictures from open collections (public domain, CC0, CC BY, CC BY-SA only) and the project’s asset and licence log.', 'Build'],
  ['audit.mjs', '<dir|file|url> [--render] [--json] [--quick]', 'The craft-floor audit: rules in eight families, static by default; --render opens the page at desktop, tablet and phone widths.', 'Judge'],
  ['capture.mjs', '<url|file|dir> [--states <json>] [--walk] [--timeline …] [--video] [--throttle]', 'Jury evidence: scroll positions at three widths, accessibility trees, reduced motion, scripted states and a keyboard walk; timelines, video and throttled passes on request.', 'Judge'],
  ['skeleton.mjs', '<url|dir> --out <file.png>', 'The composition block map and measured fingerprint of one page.', 'Judge'],
  ['crux.mjs', '<url> [--origin]', 'Chrome UX Report field data (p75) for a live site. Needs CRUX_API_KEY.', 'Judge'],
  ['house-ledger.mjs', '[build dirs…] [--against AWARDS.md]', 'What the plugin’s own finished builds share, so a new contract can refuse the plugin’s own rut.', 'Judge'],
  ['verify-recipes.mjs', '[--only <ids>] [--pseudo] [--json]', 'Builds every recipe and drives its verifier in headless Chromium with WebGL.', 'Maintain'],
  ['check-sync.mjs', '', 'Manifest versions, pins against versions.md, shared copies, licence files and every count the descriptions quote.', 'Maintain'],
  ['check-versions.mjs', '[--json] [--strict]', 'Every pinned library against the npm registry’s latest, without installing anything.', 'Maintain'],
  ['calibration.mjs', '[--since 2021] [--json]', 'The score figures the rubric quotes, recomputed from the site cards.', 'Maintain'],
  ['lint-refs.mjs', '', 'Every [site:], [recipe:] and [pattern:] reference resolves to a real file.', 'Maintain'],
];
const HOOK_NOTES = {
  PostToolUse: 'Runs the quick audit on the file just edited or written. Silent unless the project has an AWARDS.md.',
  UserPromptSubmit: 'Adds one routing line when a prompt carries explicit award framing; a hint, never a gate.',
  SessionStart: 'After a compaction, re-attaches a short state card from an unfinished build’s AWARDS.md: phase, next skill, deep modes, last jury and ship lines.',
  SubagentStop: 'Sends the juror’s reply back once when it lacks its literal disposition line, which craft routes on.',
};
function scriptsAndHooks() {
  const scripts = SCRIPTS.map(([file, usage, what, stage]) => {
    if (!fs.existsSync(path.join(plugin, 'scripts', file))) fail(`scripts/${file} is listed in SCRIPTS but not in the plugin`);
    return { file: `scripts/${file}`, usage, what, stage };
  });
  const hooksJson = json('hooks/hooks.json').hooks;
  const hooks = Object.entries(hooksJson).map(([event, entries]) => {
    if (!HOOK_NOTES[event]) fail(`hooks.json has a ${event} hook with no note in HOOK_NOTES`);
    const entry = entries[0];
    const command = entry.hooks[0].command.replace(/"?\$\{CLAUDE_PLUGIN_ROOT\}\//, '').replace(/^node "?/, 'node ').replace(/"/g, '');
    return { event, matcher: entry.matcher || null, command, what: HOOK_NOTES[event] };
  });
  return { scripts, hooks };
}

function evals() {
  const dir = path.join(plugin, 'evals');
  const tags = {};
  let cases = 0;
  for (const d of fs.readdirSync(dir)) {
    const file = path.join(dir, d, 'case.yaml');
    if (!fs.existsSync(file)) continue;
    cases++;
    const m = /^tags:\s*\[([^\]]*)\]/m.exec(fs.readFileSync(file, 'utf8'));
    for (const t of (m?.[1] || '').split(',').map((s) => s.trim()).filter(Boolean)) tags[t] = (tags[t] || 0) + 1;
  }
  return { cases, tags };
}

// ---- Write --------------------------------------------------------------------------------------------------------------

const skillList = skills();
const ruleList = rules();
const corpusData = corpus();
const recipeData = recipes();
const showcase = builds();
const { scripts, hooks } = scriptsAndHooks();
const releaseList = releases();
const synced = new Date().toISOString().slice(0, 10);
const head = { about: 'Generated by scripts/sync-plugin.mjs from the awards repository. Do not edit by hand.', synced, version: manifest.version };

const core = {
  ...head,
  plugin: {
    name: manifest.name,
    displayName: manifest.displayName,
    version: manifest.version,
    description: manifest.description,
    license: manifest.license,
    repository,
    keywords: manifest.keywords || [],
    codex: codexManifest ? { prompts: codexManifest.interface?.defaultPrompt || codexManifest.interface?.starterPrompts || [] } : null,
    config: Object.entries(manifest.userConfig || {}).map(([id, c]) => ({ id, title: c.title, description: c.description, type: c.type, default: c.default, options: c.options || null })),
  },
  install: installCommands(),
  pins: pins(),
  counts: {
    skills: skillList.length,
    rules: ruleList.length,
    rulesP0P1: ruleList.filter((r) => r.severity === 'P0' || r.severity === 'P1').length,
    rulesRendered: ruleList.filter((r) => r.rendered).length,
    rulesSlop: ruleList.filter((r) => r.scope === 'slop').length,
    recipes: recipeData.items.length,
    compositions: recipeData.items.filter((r) => r.group === 'compositions').length,
    recipesVerified: recipeData.items.filter((r) => r.verified).length,
    drafts: recipeData.drafts,
    sites: corpusData.sites.filter((s) => !s.clone).length,
    skeletons: corpusData.skeletons,
    patterns: corpusData.patterns.length,
    builds: showcase.length,
    ...(() => { const e = evals(); return { evals: e.cases, evalTags: e.tags }; })(),
  },
  families: FAMILIES.map(([scope, name, prefix]) => ({ scope, name, prefix, count: ruleList.filter((r) => r.scope === scope).length, p0p1: ruleList.filter((r) => r.scope === scope && /P[01]/.test(r.severity)).length })),
  skills: skillList,
  // The highest Site of the Day scores in the corpus, for the home page's corpus block.
  corpusTop: corpusData.sites
    .filter((x) => !x.clone && /SOTD|Site of the Day/.test(x.awards))
    .map((x) => ({ id: x.id, site: x.site.replace(/\s*\(.*\)$/, ''), class: x.class, score: Number(/\b([6-9]\.\d{1,2})\b/.exec(x.awards)?.[1] ?? NaN), awards: x.awards }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ awards: _a, ...x }) => x),
  jury: jury(),
  phases: phases(),
  status: statusSample(),
  templates: templates(),
  builds: showcase,
  scripts,
  hooks,
  latest: releaseList.find((r) => r.date) ? { version: releaseList.find((r) => r.date).version, date: releaseList.find((r) => r.date).date } : null,
};

const ref = {
  ...head,
  rules: ruleList,
  sites: corpusData.sites,
  patterns: corpusData.patterns,
  recipeGroups: recipeData.groups,
  recipes: recipeData.items,
  releases: releaseList,
};

const write = (rel, data) => fs.writeFileSync(path.join(root, rel), JSON.stringify(data, null, 1) + '\n');
write('src/registry/plugin.json', core);
write('src/registry/plugin-ref.json', ref);
console.log(`awards ${manifest.version}: ${skillList.length} skills, ${ruleList.length} rules, ${recipeData.items.length} recipes, ${core.counts.sites} site cards, ${corpusData.patterns.length} patterns, ${showcase.length} builds, ${releaseList.length} releases → src/registry/plugin.json, plugin-ref.json`);
