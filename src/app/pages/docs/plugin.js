// Docs, The plugin: the skills (an index and a page each), how a build runs, the modes and the project files.
import { docPath } from '../../../registry/docs.js';
import { md } from '../../../registry/plugin.js';
import { html, raw, href } from '../../dom.js';
import { icon } from '../../icons.js';
import { commandBlock } from '../../ui/plugin-bits.js';

const doc = (slug, label) => html`<a href="${href(docPath(slug))}">${label}</a>`;
const skillLink = (id) => html`<a href="${href(`/docs/skills/${id}/`)}"><code>awards:${id}</code></a>`;

export function skills(core) {
  const deep = [
    ['motion --gsap', 'motion', 'Timeline-led sites: one master timeline, labels per chapter, the GSAP choreography playbook.'],
    ['webgl --shader', 'webgl', 'A page-wide or signature shader: the shader playbook, its passes, uniforms and fallbacks.'],
    ['webgl --3d', 'webgl', 'One hero object or a scene: the 3D playbook, the glTF, Draco and KTX2 pipeline and the camera rig.'],
  ];
  return {
    heading: `The ${core.skills.length} skills`,
    lede: 'Each skill answers its own kind of request, and craft drives them in order for a whole site. Claude Code writes them /awards:<name>, Codex $awards:<name>.',
    sources: ['skills/'],
    body: html`
      <h2 id="handoffs">Hand-offs, not calls</h2>
      <p>Skills cannot call each other. Each phase ends with a written hand-off: a literal instruction to invoke the next skill, and the file it should read. That keeps every phase answerable on its own (“add a custom cursor”, “judge this page”, “set up Vite with GSAP and Three”) and lets a build stop and resume from <code>AWARDS.md</code> in a new session.</p>

      <h2 id="list">Every skill</h2>
      <ul class="dskills" role="list">
        ${core.skills.map((s) => raw(html`
        <li>
          <a class="dskill" href="${href(`/docs/skills/${s.id}/`)}">
            <span class="dskill__id"><code>awards:${s.id}</code>${s.forked ? raw('<span class="label">forked</span>') : ''}</span>
            <span class="dskill__b">${s.short}</span>
            ${raw(icon('arrowRight', { size: 15, className: 'dskill__go' }))}
          </a>
        </li>`))}
      </ul>

      <h2 id="deep">Deep modes</h2>
      <p>Three modes go further inside one skill. They switch on from the direction contract, the dosage or the motion score, or by flag, are recorded on the <code>Deep modes:</code> line of <code>AWARDS.md</code>, and load a playbook filled from corpus waves that read sites with a technical lens.</p>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Mode</th><th scope="col">Skill</th><th scope="col">For</th></tr></thead>
        <tbody>${deep.map(([m, s, f]) => raw(html`<tr><th scope="row"><code>${m}</code></th><td>${raw(skillLink(s))}</td><td>${f}</td></tr>`))}</tbody>
      </table></div>`,
  };
}

export function skillPage(core, s) {
  const i = core.skills.indexOf(s);
  const phase = core.phases.flatMap((r) => r.phases).find((p) => p.skill === s.id && p.id === s.id);
  return {
    heading: html`<code class="dh1code">awards:${s.id}</code>`,
    lede: s.intro ? md(s.intro) : md(s.lead),
    sources: [s.file],
    body: html`
      <h2 id="call">Call it</h2>
      ${raw(commandBlock(`/awards:${s.id}${s.hint ? ` ${s.hint}` : ''}`, { label: 'Claude Code' }))}
      ${raw(commandBlock(`$awards:${s.id}${s.hint ? ` ${s.hint}` : ''}`, { label: 'Codex' }))}
      <p>Everything in brackets is optional; with no arguments it reads the project and asks what it needs. ${s.forked ? raw(html`It runs <strong>forked</strong> into the <code>${s.forked}</code> agent: the build conversation does not reach it, so it judges what a stranger would see.`) : ''}${s.effort ? raw(html` It runs at <code>${s.effort}</code> effort.`) : ''}</p>

      <h2 id="when">When it triggers</h2>
      <p>${raw(md(s.description))}</p>
      ${phase ? raw(html`<p>In a whole build it is the <strong>${phase.name}</strong> phase: ${phase.does} It leaves ${phase.file} for the next phase.</p>`) : ''}

      ${s.sections.length ? raw(html`
      <h2 id="covers">What it covers</h2>
      <p>The skill’s own chapters, in the order it works through them:</p>
      <ol class="dchapters">${s.sections.map((t) => raw(html`<li>${raw(md(t))}</li>`))}</ol>`) : ''}

      ${s.next.length ? raw(html`
      <h2 id="next">What it hands to</h2>
      <p>When it is driving a build, it ends by telling the next skill to start: ${raw(s.next.map(skillLink).join(', '))}.</p>`) : ''}

      ${s.refuse.length ? raw(html`
      <h2 id="refuse">What it refuses</h2>
      <ul class="drefuse">${s.refuse.map((r) => raw(html`<li>${raw(md(r))}</li>`))}</ul>`) : ''}

      <h2 id="related">Next to it</h2>
      <p>${raw([core.skills[i - 1], core.skills[i + 1]].filter(Boolean).map((x) => html`${raw(skillLink(x.id))}: ${x.short}`).join('<br>'))}</p>`,
  };
}

export function flow(core) {
  const t = core.templates;
  return {
    sources: ['skills/craft/SKILL.md', 'assets/templates/AWARDS.md'],
    body: html`
      <h2 id="rules">Two rules</h2>
      <p>No page code before the direction contract is locked, and no stack chosen before the concept. A phase runs only when its entry condition holds, and the file it writes is what the next phase reads. Skills cannot call each other, so nothing is carried in the conversation; a new session picks the build up from <code>AWARDS.md</code>.</p>

      <h2 id="phases">The nine phases</h2>
      ${core.phases.map((r) => raw(html`
      <h3>${r.name}</h3>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Phase</th><th scope="col">Skill</th><th scope="col">What it does</th><th scope="col">Leaves</th></tr></thead>
        <tbody>${r.phases.map((p) => raw(html`<tr><th scope="row">${p.name}</th><td>${raw(skillLink(p.skill))}</td><td>${p.does}</td><td><code>${p.file}</code></td></tr>`))}</tbody>
      </table></div>`))}
      <p>Under each phase on the <a href="${href('/')}">home page</a> is one real line from the Museum of Extinct Colours’ own files, so you can see what each file holds at the end.</p>

      <h2 id="contract">The direction contract</h2>
      <p>Concept writes the contract into <code>AWARDS.md</code>; every later phase builds from it and the jury checks the page against it. A mood word in any block (premium, immersive, cinematic) sends it back to concept.</p>
      <dl class="dcontract">
        ${t.contract.map((c) => raw(html`<div><dt>${c.block}</dt><dd>${raw(md(c.rule))}</dd></div>`))}
      </dl>
      <p>The seed line records how the directions were dealt (the engines, the outside stimuli and the one locked), so a build can be re-rolled or explained later.</p>

      <h2 id="hero">The hero first</h2>
      <p>Structure builds the first viewport before anything else exists and judges its capture with a forked component jury. A first screen that comes back <span class="vchip vchip--rebuild">rebuild</span> costs one section, not a site. Stack then boots the project on one ticker with a hook, <code>window.__awards</code>, that lets the capture script and the jury drive the page to any state.</p>

      <h2 id="status">How a build knows where it is</h2>
      <p><code>AWARDS.md</code> opens with a checklist that every phase ticks. This is the last state of ${core.status.build}:</p>
      <ul class="dstatus">${core.status.lines.map((l) => raw(html`<li class="${l.done ? 'is-done' : ''}"><span aria-hidden="true">${l.done ? '✓' : '○'}</span>${l.text}</li>`))}</ul>
      <p>The rest of the file is the build’s memory: ${t.awards.map((x) => `“${x}”`).join(', ')}. ${raw(doc('project-files', 'Project files'))} describes each.</p>`,
  };
}

export function modes(core) {
  const stack = core.plugin.config.find((c) => c.id === 'default_stack');
  return {
    sources: ['skills/craft/SKILL.md', 'references/jury/programs.md'],
    body: html`
      <h2 id="quick">Quick mode</h2>
      ${raw(commandBlock('/awards:craft --quick'))}
      <p>For one landing page with one action and its 404. The same contract and every decision the jury scores; system and structure are checked once together, there are no component passes, and there is one jury round and one ship pass.</p>

      <h2 id="redesign">Redesign</h2>
      ${raw(commandBlock('/awards:craft redesign <url or folder>'))}
      <p>For an existing site. It starts on a branch, captures the old site as a baseline and has a forked jury score it, writes an inventory of what is kept, rewritten or dropped, and turns the old site’s two worst faults into refusals in the new contract.</p>

      <h2 id="programs">Award programs</h2>
      <p>Name the programs in the brief, for example <code>programs: awwwards, cssda</code>, or pass <code>--program</code> to the jury. The jury reports a target line for each. The scores stay on one rubric: a program changes the target, never the scores.</p>

      <h2 id="deep">Deep modes</h2>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Flag</th><th scope="col">Switches on</th></tr></thead>
        <tbody>
          <tr><th scope="row"><code>--gsap</code></th><td>The motion skill’s GSAP choreography playbook, for timeline-led sites.</td></tr>
          <tr><th scope="row"><code>--shader</code></th><td>The WebGL skill’s shader playbook.</td></tr>
          <tr><th scope="row"><code>--3d</code></th><td>The WebGL skill’s 3D scene playbook.</td></tr>
        </tbody>
      </table></div>
      <p>They also switch on from the contract, the WebGL dosage or the motion score, and are recorded on the <code>Deep modes:</code> line of <code>AWARDS.md</code>.</p>

      <h2 id="pictures">Building without found pictures</h2>
      ${raw(commandBlock('/awards:craft --no-found-pictures'))}
      <p>By default, with no pictures of its own, a build searches open collections (public domain, CC0, CC BY and CC BY-SA only) for real pictures of the subject’s world before it makes imagery. <code>--no-found-pictures</code>, or a brief that rules outside pictures out, writes <code>Found pictures: off</code> into <code>AWARDS.md</code> for that build: the imagery then comes from your own files or is made for the build. <code>--found-pictures</code> turns the search back on.</p>

      <h2 id="component">One component</h2>
      ${raw(commandBlock('/awards:component <name | file | selector> [--standalone] [--lib gsap|anime|css]'))}
      <p>Inside an established site, the component inherits that site’s world and touches nothing around it. ${raw(doc('components', 'Use a component'))} covers prompts from the library.</p>

      <h2 id="jury-modes">Jury modes</h2>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Flag</th><th scope="col">What it judges</th></tr></thead>
        <tbody>
          <tr><th scope="row"><code>--component &lt;selector&gt;</code></th><td>One part of the page, usually the first viewport before the rest is built.</td></tr>
          <tr><th scope="row"><code>--verdict</code></th><td>A re-check after a ship pass: which fixes landed, which regressed.</td></tr>
          <tr><th scope="row"><code>--baseline</code></th><td>An existing site before a redesign.</td></tr>
          <tr><th scope="row"><code>--blind &lt;dir&gt;</code></th><td>One frame set of a blind tournament, under a letter, with no brief.</td></tr>
        </tbody>
      </table></div>

      ${stack ? raw(html`
      <h2 id="stack">The default stack</h2>
      <p>A build starts from <code>${stack.default}</code> when its brief names no stack. The plugin setting <code>default_stack</code> changes it to any of ${stack.options.join(', ')}; ${raw(doc('hooks', 'Hooks and settings'))} has the rest.</p>`) : ''}`,
  };
}

export function projectFiles(core) {
  const t = core.templates;
  const about = {
    Status: 'The checklist every phase ticks. A new session resumes from the first open line.',
    Brief: 'The subject, what only it can prove, the inventory, the audience and their scene, what a visitor should do, the assets on hand and the binding constraints.',
    'Direction contract': 'The blocks every phase builds from and the jury checks against; see the flow.',
    'Page map': 'Routes and chapters, each with its beats, layout and purpose, the 404 included.',
    'Motion score': 'One authored moment per chapter, its trigger, timing and reduced-motion tier.',
    'Budgets & tiers': 'The stack, entry JS, the GL chunk, images, fonts, quality tiers, deep modes and the found-pictures line.',
    'Jury log': 'One line per jury round: date, disposition, the four scores, the developer scores and the top fixes.',
    'Ship log': 'One line per ship pass: audit counts, exceptions, captures and measured budgets.',
    Exceptions: 'Every audit finding kept on purpose, with its reason and scope.',
  };
  return {
    heading: 'What it writes in your project',
    sources: ['assets/templates/AWARDS.md', 'assets/templates/DESIGN.md'],
    body: html`
      <h2 id="awards-md">AWARDS.md</h2>
      <p>The contract and the build’s memory, kept in this order:</p>
      <dl class="dcontract">${t.awards.map((x) => raw(html`<div><dt>${x}</dt><dd>${about[x] || ''}</dd></div>`))}</dl>

      <h2 id="design-md">DESIGN.md and tokens.css</h2>
      <p>The visual system: ${t.design.join(', ')}. Its values are identical to <code>src/styles/tokens.css</code>, and the rendered audit compares the page’s ground with the DESIGN.md ground token. <code>scripts/design-md.mjs</code> lints it and exports the tokens to DTCG or Tailwind through Google’s design.md tools.</p>

      <h2 id="dot-awards">.awards/</h2>
      <div class="dtable"><table>
        <thead><tr><th scope="col">Path</th><th scope="col">Holds</th></tr></thead>
        <tbody>
          <tr><th scope="row"><code>.awards/captures/</code></th><td>Screenshots at desktop, tablet and phone widths, accessibility trees, reduced motion, scripted states and the keyboard walk. Regenerated, never committed.</td></tr>
          <tr><th scope="row"><code>.awards/jury/</code></th><td>Each jury report: the memory test, the inventory, the scores with their reasons, the ordered fixes and the disposition.</td></tr>
          <tr><th scope="row"><code>.awards/ship/</code></th><td>Each ship report: the fix batch, the audit, the captures and the measured budgets.</td></tr>
          <tr><th scope="row"><code>.awards/audit.json</code></th><td>The last audit, machine-readable.</td></tr>
          <tr><th scope="row"><code>.awards/assets.json</code></th><td>The asset and licence log: every picture, its source, licence and credit.</td></tr>
        </tbody>
      </table></div>
      <p>Keep the captures out of version control: they are evidence, regenerated by the plugin’s capture script.</p>

      <h2 id="example">A real one</h2>
      <p>Every build in the <a href="${href('/showcase/')}">showcase</a> links to its own <code>AWARDS.md</code>, <code>DESIGN.md</code> and jury reports in the awards repository.</p>`,
  };
}

