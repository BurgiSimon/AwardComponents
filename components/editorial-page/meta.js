// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'editorial-page',
  title: 'Editorial page',
  category: 'blocks',
  summary: 'A studio’s home page paced as one document: an art-directed hero, an image-and-text story, the house in figures, a slower passage and a reversed close.',
  description: 'Five sections, each with one job and its own layout family, so no two neighbours share a shape. The hero promises a house; the story explains its site; the particulars give the evidence as a definition list with a native disclosure; a shorter passage without a picture slows the pace; the reversed close resolves the page with one contact action.\n\nThe page owns only the pacing and the type voice. Each section keeps its own responsive layout, and on a phone every section reads in document order.',
  recipe: 'complete-editorial-composition',
  recipes: ['editorial-image-text', 'product-specification', 'designed-footer'],
  deps: [],
  tags: ['composition', 'editorial', 'page', 'responsive', 'static', 'serif', 'layout'],
  added: '2026-10-28',
  order: 10,
  preview: { height: 760, scroll: true, hint: 'Scroll the whole page' },
  useCases: [
    'The home page of a studio, a maker or a small brand with one piece of work to lead with',
    'A launch page for a single product or building, from promise to particulars to contact',
    'A template for pacing: where density changes, where a picture leaves, where the page ends',
  ],
  notes: [
    'One h1, a skip link, header, nav, main and footer landmarks; every picture is a figure with its caption attached.',
    'The facts are a real <dl> and the materials a native <details>, so Enter and Space work with no script.',
    'Nothing moves. On a phone each section stacks in document order and the hero recrops from 8:5 to 4:5.',
  ],
  controls: [
    { id: 'hero', label: 'Hero', type: 'select', options: [{ value: 'split', label: 'Copy beside picture' }, { value: 'stacked', label: 'Title over picture' }], default: 'split', group: 'Layout', prompt: (v) => (v === 'stacked' ? 'Hero: the title across the full measure over a 21:9 picture, lede and action between them' : 'Hero: copy beside an 8:5 picture') },
    { id: 'density', label: 'Density', type: 'select', options: [{ value: 'airy', label: 'Airy' }, { value: 'compact', label: 'Compact' }], default: 'airy', group: 'Layout', help: 'The pause between sections.', prompt: (v) => (v === 'compact' ? 'Compact pacing: about 6rem between sections at desktop width' : 'Airy pacing: up to 12rem between sections') },
    { id: 'serif', label: 'Serif headlines', type: 'toggle', default: true, group: 'Type', prompt: { on: 'Headlines in a high-contrast serif over a grotesque body', off: 'Headlines in the grotesque at an expanded width; the serif only for the pull quote' } },
    { id: 'accent', label: 'Accent use', type: 'select', options: [{ value: 'quiet', label: 'Quiet' }, { value: 'marks', label: 'Marks' }, { value: 'field', label: 'Field' }], default: 'marks', group: 'Colour', help: 'Quiet keeps the accent off the page; marks give it to links, the drop cap and the contact action; field turns the close into an accent ground.', prompt: (v) => ({ quiet: 'No accent colour: links and the close action stay in ink', marks: 'Accent only on links, the drop cap, the disclosure and the contact action', field: 'The close sits on a full accent ground with dark ink' })[v] },
  ],
  prompt: {
    skill: 'component',
    ask: 'Compose {target} as one paced editorial page.',
    target: 'the home page',
    brief: 'Five sections in one document, each with one job and a layout family its neighbour does not share: an art-directed hero (copy beside an 8:5 picture that recrops to 4:5 on a phone), an image-and-text story (figure 1.35 parts to copy 1, top edges aligned, caption attached), the particulars as a definition list with a native disclosure beside a held picture, a shorter passage without a picture that slows the pace, and a reversed close with one contact action. The gap between sections, up to 12rem, is the pacing.',
    keep: ['one h1, a skip link and landmarks; figures with captions; a <dl> for the facts and a native <details>; phone order is reading order and nothing needs the script.'],
  },
};
