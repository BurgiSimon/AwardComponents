// The docs, in reading order. Plain data: the shell builds the docs menu, the pager and the search palette from it,
// and scripts/lib/routes.js writes one HTML file per page with its title and description. A page's content lives in
// src/app/pages/docs/; adding a page means an entry here and a renderer there.
export const DOC_GROUPS = [
  { title: 'Start', slugs: ['', 'install', 'first-build', 'components'] },
  { title: 'The plugin', slugs: ['skills', 'flow', 'modes', 'project-files'] },
  { title: 'Judging', slugs: ['jury', 'audit', 'corpus'] },
  { title: 'Reference', slugs: ['scripts', 'hooks', 'faq'] },
];

export const DOCS = [
  { slug: '', title: 'Overview', heading: 'The awards docs', description: 'What the awards plugin is, the two ways into it, and where everything in these docs comes from.' },
  { slug: 'install', title: 'Install', heading: 'Install', description: 'Two commands in Claude Code or Codex, then Node and Playwright for the screenshots; cloud sessions, Cowork and a local checkout.' },
  { slug: 'first-build', title: 'Your first build', heading: 'Your first build', description: 'What to ask for, what the plugin asks back, how long a build runs, what it leaves in your folder and what the first verdict usually is.' },
  { slug: 'components', title: 'Use a component', heading: 'Use a component', description: 'Tune a component from the library, copy its prompt and paste it into a session started in your project.' },
  { slug: 'skills', title: 'Skills', heading: 'The eleven skills', description: 'Every awards skill: what it does, how to call it in Claude Code and Codex, what it hands to the next one and what it refuses.' },
  { slug: 'flow', title: 'How a build runs', heading: 'How a build runs', description: 'Nine phases from brief to ship, the direction contract, and the file each phase leaves for the next.' },
  { slug: 'modes', title: 'Modes and flags', heading: 'Modes and flags', description: 'Quick mode, redesigns, award programs, deep modes for GSAP, shaders and 3D, and building without found pictures.' },
  { slug: 'project-files', title: 'Project files', heading: 'What it writes in your project', description: 'AWARDS.md, DESIGN.md and .awards/: the build’s memory, its visual system and its evidence.' },
  { slug: 'jury', title: 'The jury', heading: 'The jury', description: 'Four axes weighted 40 / 30 / 20 / 10, the six developer criteria, the four words a verdict ends on and why the scores run below the award.' },
  { slug: 'audit', title: 'The audit', heading: 'The audit', description: 'Every craft-floor rule, by family and severity, with what it flags and how to fix it.' },
  { slug: 'corpus', title: 'Corpus', heading: 'The corpus', description: 'The award sites read in depth and the pattern files built from them; what a card holds and how the plugin uses it.' },
  { slug: 'scripts', title: 'Scripts', heading: 'Scripts', description: 'The command-line tools the skills call: doctor, audit, capture, roll, fonts, assets and the rest.' },
  { slug: 'hooks', title: 'Hooks and settings', heading: 'Hooks and settings', description: 'The four Claude Code hooks, how to turn them off, the plugin settings and how Codex differs.' },
  { slug: 'faq', title: 'Questions', heading: 'Questions', description: 'Cost, time, permissions, browsers, licences and what to do when a verdict says rebuild.' },
];

export const docBySlug = new Map(DOCS.map((d) => [d.slug, d]));
export const docPath = (slug) => (slug ? `/docs/${slug}/` : '/docs/');
