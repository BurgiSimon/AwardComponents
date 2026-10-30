// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'cell-curtain',
  title: 'Cell curtain',
  category: 'loaders-transitions',
  summary: 'Kova One’s three-page site behind one curtain of cells: the bars weave shut from a corner on arrival and on every route, the page swaps behind them, and they weave open again.',
  description: 'One curtain does the arrival and every route change. A fixed grid of cells, rebuilt to the viewport at about 72 × 75 px each, grows from hairlines into solid bars, swept by grid distance from the bottom-right cell, so the page seems to weave shut, change behind the weave and weave open again.\n\nThe curtain is shut from the first paint. The arrival waits for the type and the decode of every picture on the page, holds at least 0.9 s on a first visit (0.25 s on a repeat visit in this session) and never more than 4 s; turn on the stalled request and press Replay arrival to see the ceiling open the page. Overview, Sound and Buy are hash routes: a route asked for while the curtain is still shut waits for it, the page swaps only once every cell is shut, and back and forward route through the same curtain.',
  recipe: 'dither-cell-transition',
  deps: ['gsap'],
  tags: ['transition', 'router', 'preloader', 'gsap', 'stagger', 'loading', 'grid', 'history', 'storage', 'accessibility'],
  added: '2026-10-28',
  labels: ['new'], // added on the launch day after the launch set; expires like any New label
  order: 40,
  preview: { height: 640, hint: 'Click Sound or Buy, then press back', capture: { wait: 500 } },
  useCases: [
    'A product launch site with three or four routes that should feel like one object',
    'A studio or label site whose pictures are woven or dithered, so the transition speaks the same language',
    'Any hash or client-side router that needs one preloader and one route transition on the same queue',
  ],
  notes: [
    'The curtain is hidden from assistive tech and the page behind it is inert while it is up, so no Tab stop hides under the cells and no key press routes mid-sweep.',
    'After a route change focus moves to the new page’s heading, the title names the page and a polite live region announces it. The skip link’s fragment is an in-page target, never a route.',
    'Under reduced motion the shut grid fades in and out in 0.2 s instead of weaving; static motion cuts. The gate, the queue and the focus rules stay the same.',
  ],
  controls: [
    { id: 'cell', label: 'Cell width', type: 'range', min: 40, max: 160, step: 4, default: 72, unit: 'px', group: 'Grid', help: 'Cells are 75/72 as tall, and the grid is rebuilt to the viewport while the curtain is open. At 72 px: 20 × 12 at 1440 × 900, 5 × 11 on a phone.', prompt: 'Cells about {value} wide and 75/72 as tall, the grid rebuilt to the viewport with round() and at least 4 × 4 (default {default})' },
    { id: 'origin', label: 'Sweep origin', type: 'select', options: [{ value: 'end', label: 'Bottom-right' }, { value: 'start', label: 'Top-left' }, { value: 'center', label: 'Centre' }, { value: 'link', label: 'The clicked link' }], default: 'end', group: 'Sweep', help: 'The arrival sweeps from the bottom-right when no link asked for the page.', prompt: (v) => ({ end: 'The sweep starts at the bottom-right cell', start: 'The sweep starts at the top-left cell and runs to the bottom-right (default: from the bottom-right cell)', center: 'The sweep starts at the centre cell and runs out to the corners (default: from the bottom-right cell)', link: 'The sweep starts at the cell under the clicked link (its centre for a key press) and the uncover opens from the same cell; the arrival sweeps from the bottom-right (default: always from the bottom-right cell)' })[v] },
    { id: 'stagger', label: 'Stagger', type: 'range', min: 0.005, max: 0.06, step: 0.005, default: 0.02, unit: 's', group: 'Sweep', help: 'Delay per step of grid distance from the origin. The whole spread is this times the longer side of the grid.', prompt: 'Cells start {value} apart by grid distance from the origin (default {default})' },
    { id: 'duration', label: 'Cell duration', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.4, unit: 's', group: 'Sweep', help: 'Each cell, hairline to solid bar, on power3.inOut.', prompt: 'Each cell scales from a hairline to a solid bar in {value} on power3.inOut (default {default})' },
    { id: 'colour', label: 'Curtain colour', type: 'color', default: 'accent', options: ['accent', 'ink', 'clay', 'moss', 'sky', 'sand', 'plum'], group: 'Look', prompt: 'Curtain colour: {value}, with the arrival readout in a contrasting ink (default {default})' },
    { id: 'stall', label: 'Stall one request', type: 'toggle', default: false, group: 'Arrival', help: 'Then press Replay arrival: one load never answers, and the curtain still opens at the 4 s ceiling.', prompt: false },
  ],
  actions: [
    { id: 'replay', label: 'Replay arrival', icon: 'refresh' },
    { id: 'next', label: 'Next page', icon: 'arrowRight' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Put {target} behind one woven cell curtain for the arrival and every route change.',
    target: 'the site’s first load and its internal links',
    brief: 'A fixed grid of cells rebuilt to the viewport (round(width / 72) × round(height / 75), at least 4 × 4: 20 × 12 at 1440 × 900, 5 × 11 on a phone; rebuilt on resize only while idle), each a bar scaling on X from 0 to 1 in 0.4 s power3.inOut, staggered 0.02 s by grid distance from the bottom-right cell (GSAP grid [rows, cols], about 0.8 s a half); cells overlap by half a pixel so the shut grid has no seams, and the uncover runs the same sweep back. The curtain is shut from first paint. The arrival gate races the fonts and every image’s decode() against a 4 s ceiling, after a minimum hold of 0.9 s (0.25 s on a repeat visit, a sessionStorage flag). The arrival and every route share one promise queue, and a route swaps the page only once every cell is shut.',
    keep: [
      'the curtain is aria-hidden and takes the clicks while shown, and the page behind it is inert; after the swap focus moves to the new h1 (tabindex -1), the title names the page and a polite live region announces it',
      'history.scrollRestoration = manual: save scrollY per route on leaving and restore it on back and forward only; a link opens at the top; a fragment that is not a route (the skip link) has its history entry rewritten to the current route',
      'a CSS failsafe hides a curtain the script never marked ready 5 s after first paint, and a script that runs after that never shuts the page again',
      'reduced motion fades the shut grid in and out in 0.2 s; static motion cuts; the gate, the queue and the focus rules are unchanged',
    ],
  },
};
