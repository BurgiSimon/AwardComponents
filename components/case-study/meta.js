// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'case-study',
  title: 'Case-study page',
  category: 'blocks',
  summary: 'A studio’s work index whose case row opens a full case study: an edge-to-edge title over the credits, a media rhythm where no neighbours match, the result in ruled rows.',
  description: 'The inner page juries open and portfolios are judged on, with the index that leads to it. The case is one article whose rows each carry a layout family: an edge-to-edge title over a definition list of client, year, scope and credits; a plate to the glass; an offset split for the brief; an uneven pair; a caption-led figure bled to the right edge; a drawn section as a second plate; the result as numbers with units; and a next-project close set at the title’s size.\n\nNo two neighbouring rows share a family, and the title’s family returns only at the end. The close links back into the index and marks the row it names, so the visitor chooses where to go next.',
  recipe: 'case-study-route-kit',
  deps: [],
  tags: ['case-study', 'portfolio', 'inner-page', 'layout', 'editorial', 'credits', 'reveal', 'responsive'],
  added: '2026-10-28',
  order: 30,
  preview: { height: 760, scroll: true, hint: 'Open Tern Library, then scroll to the next project', capture: { action: 'open', wait: 1200 } },
  useCases: [
    'The project page of a studio, agency or architect, opened from a work index',
    'A product story told as evidence: context, pictures with captions, results with units',
    'A template for a CMS route (/work/[slug]) whose rows keep their rhythm whatever the content',
  ],
  notes: [
    'One h1 per view, a breadcrumb with aria-current, one article per case; opening a case moves focus to its title and resets the scroll.',
    'Every picture is a figure with a caption; in the caption-led row the caption comes first in the DOM and in the reading order.',
    'Only rows that start below the fold are held back: full motion rises 32 px and fades, reduced fades without travel, static holds nothing back.',
  ],
  controls: [
    { id: 'rhythm', label: 'Media rhythm', type: 'select', options: [{ value: 'classic', label: 'Plate, brief, pair' }, { value: 'image', label: 'Pictures first' }, { value: 'text', label: 'Brief first' }], default: 'classic', group: 'Case page', help: 'Three orders of the same rows; each keeps every neighbour in a different layout family.', prompt: (v) => ({ classic: 'Row order: plate, brief, uneven pair, caption-led figure, drawn plate, results', image: 'Row order, pictures first: plate, uneven pair, brief, drawn plate, caption-led figure, results', text: 'Row order, brief first: brief, plate, caption-led figure, uneven pair, drawn plate, results' })[v] },
    { id: 'credits', label: 'Credits', type: 'select', options: [{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'Ruled list' }, { value: 'inline', label: 'One line' }], default: 'grid', group: 'Case page', prompt: (v) => ({ grid: 'Credits as a grid of role and name pairs under the facts', list: 'Credits as a ruled list, role left and name right', inline: 'Credits as one running line of role and name pairs' })[v] },
    { id: 'titleScale', label: 'Title scale', type: 'range', min: 8, max: 16, step: 0.5, default: 14.5, unit: 'vw', group: 'Case page', help: 'The h1 and the next-project title share this size.', prompt: 'Title and next-project title at {value}, clamped between 2.9rem and 13rem (default {default})' },
    { id: 'reveal', label: 'Reveal below the fold', type: 'toggle', default: true, group: 'Motion', prompt: { on: 'Rows that start below the fold rise 32 px and fade in once over 0.9 s (fade only under reduced motion)', off: 'No reveal: every row is in place from the first paint' } },
    { id: 'start', label: 'Open on', type: 'select', options: [{ value: 'index', label: 'Work index' }, { value: 'case', label: 'Case study' }], default: 'index', group: 'Demo', prompt: false },
  ],
  actions: [
    { id: 'open', label: 'Open the case study' },
    { id: 'index', label: 'Back to the index' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Build {target} as a case-study route opened from the work index.',
    target: 'the project pages',
    brief: 'One article per project. It opens on an edge-to-edge title (14.5vw, capped at 13rem) over a definition list of client, year, scope and credits by role, then a run of rows in which no two neighbours share a layout family: a plate to the glass, an offset split for the brief, an uneven pair, a caption-led figure bled to one edge, a second plate, the result as ruled rows with units. Rows that start below the fold rise 32 px and fade in once over 0.9 s. It ends on a next-project link set at the title’s size that leads back into the index and marks the row it names.',
    keep: ['one h1 and one article per case, a breadcrumb with aria-current, figures with captions; opening a case resets the scroll and moves focus to its h1; only below-the-fold rows are held back, reduced motion fades without travel, and nothing is hidden under static motion.'],
  },
};
