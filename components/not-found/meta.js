// Field reference: docs/authoring.md. Plain data, no imports.
export default {
  id: 'not-found',
  title: 'Designed 404',
  category: 'closers',
  summary: 'A not-found page in the studio’s voice: the way home first, three named routes and a search, beside a CSS-only scene where the 0 of 404 sets like a sun.',
  description: 'The page says what happened in one plain title and puts the way back first in the DOM: the front page, the three routes most visitors want and a search. None of it animates or waits.\n\nBeside it, two drafted fours stand on a fjord’s horizon and the zero between them is the sun: it sinks into the water once and the glints open across it. The moonrise variant turns the scene into a window onto the night and lifts the zero into place. The scene is a few kilobytes of inline SVG, plays without the script and is hidden from assistive tech.',
  recipe: 'designed-404',
  deps: [],
  tags: ['404', 'not-found', 'error-page', 'css-only', 'svg', 'animation', 'search'],
  added: '2026-10-28',
  order: 60,
  preview: { height: 640, hint: 'Replay the scene from the toolbar', capture: { wait: 3600 } },
  useCases: [
    'The not-found page of any site, served with a real 404 status',
    'An error or empty state that should still sound like the brand and point somewhere useful',
    'A pattern for one small authored moment that never stands between the visitor and the way out',
  ],
  notes: [
    'One h1 that says the page is missing, a skip link to the way back, the routes in a named nav and a labelled search landmark.',
    'The scene is aria-hidden, inline and CSS-only: it plays once without the script, and the links never animate.',
    'Reduced motion fades the scene in where it rests; static shows the last frame at once. Serve the page with status 404 and noindex.',
  ],
  controls: [
    { id: 'scene', label: 'Scene', type: 'select', options: [{ value: 'sunset', label: 'Sunset' }, { value: 'moonrise', label: 'Moonrise' }], default: 'sunset', group: 'Scene', prompt: (v) => (v === 'moonrise' ? 'Moonrise: the scene is a night window; the zero rises from the water into place between the fours as the stars come out' : 'Sunset: the zero sinks into the horizon to a half-set sun, then glints open across the water') },
    { id: 'duration', label: 'Duration', type: 'range', min: 0.8, max: 4, step: 0.1, default: 1.8, unit: 's', group: 'Scene', prompt: 'The zero travels 140 viewBox units over {value} on cubic-bezier(.65, 0, .35, 1), once (default {default})' },
    { id: 'tone', label: 'Copy tone', type: 'select', options: [{ value: 'plain', label: 'Plain' }, { value: 'studio', label: 'In the studio’s voice' }], default: 'plain', group: 'Copy', prompt: (v) => (v === 'studio' ? 'Title in the brand’s own voice (for an architect: “This page was never built.”), still saying plainly that the page is missing' : 'A plain title that says the page cannot be found') },
  ],
  actions: [{ id: 'replay', label: 'Replay the scene' }],
  prompt: {
    skill: 'component',
    ask: 'Design {target} in the site’s own voice.',
    target: 'the 404 page',
    brief: 'One plain title says what happened, and the way back comes first: the front page, three named routes and a search form. Beside them a small inline-SVG scene plays once in CSS: two drawn fours on a horizon with the zero between them as the sun, which sinks 140 units over 1.8 s on cubic-bezier(.65, 0, .35, 1) after 0.35 s, then five glints open across the water. Nothing waits for it.',
    keep: ['a skip link to the way back, links first in the DOM and never animated, a labelled search landmark; the scene aria-hidden; reduced motion fades in place, static shows the last frame; served with a real 404 status, noindex and root-absolute URLs.'],
  },
};
