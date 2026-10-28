export default {
  id: 'view-transitions',
  title: 'View transitions',
  category: 'loaders-transitions',
  summary: 'A shop grid that opens a product page with the browser’s View Transitions API: the picture and name morph into the hero while the rest of the page slides on.',
  description: 'The browser does the animation. Before the swap only the clicked tile’s picture and name get a view-transition-name; the product page carries the same two names on its hero, so the browser morphs one into the other while the rest of the page, everything without a name, slides out and in along the reading direction. Going back runs the mirror image and returns the picture to its tile.\n\nThis preview uses the same-document form, document.startViewTransition(), around a swap of the page’s content. On a site of real pages the same CSS runs between documents with one opt-in rule, @view-transition { navigation: auto; }, and the names set in the pageswap and pagereveal events. Browsers without the API simply swap the page.',
  recipe: 'view-transitions-mpa',
  deps: [],
  tags: ['transition', 'view-transitions', 'morph', 'shared-element', 'css', 'shop', 'history'],
  requires: ['view-transitions'],
  added: '2026-10-28',
  order: 50,
  preview: { height: 640, scroll: true, hint: 'Open a product, then go back', capture: { wait: 900 } },
  useCases: [
    'A shop grid opening a product page, the product photo carried into the hero',
    'A portfolio or journal index where a thumbnail becomes the article’s lead image',
    'Any multi-page site that wants shared-element moves without a JavaScript router',
  ],
  notes: [
    'Links are plain links and the URL changes with each page, so history, reload and new tabs behave as usual; focus moves to the new page’s heading.',
    'Only the chosen tile is named, and only for the swap: a name repeated in one snapshot would cancel the transition.',
    'Under reduced motion, and in browsers without the API, the page swaps without a transition.',
  ],
  controls: [
    { id: 'duration', label: 'Morph duration', type: 'range', min: 0.3, max: 1.4, step: 0.05, default: 0.7, unit: 's', group: 'Transition', help: 'The page body leaves in 57 % of it and arrives in 86 % of it after a short overlap.', prompt: 'The picture and name morph in {value} with an expo in-out; the page body leaves in 57 % and enters in 86 % of that (default {default})' },
    { id: 'slide', label: 'Body slide', type: 'range', min: 0, max: 20, step: 1, default: 6, unit: '%', group: 'Transition', prompt: 'The rest of the page slides {value} along the reading direction, mirrored on the way back (default {default})' },
    { id: 'api', label: 'Use the API', type: 'toggle', default: true, group: 'Demo', help: 'Off shows what browsers without View Transitions get: a plain swap.', prompt: false },
  ],
  actions: [
    { id: 'open', label: 'Open a product', icon: 'arrowRight' },
    { id: 'back', label: 'Back to the shop', icon: 'arrowLeft' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Add view transitions between {target}.',
    target: 'the product grid and the product pages',
    brief: 'Use the View Transitions API: name only the clicked tile’s picture and title (view-transition-name) just before the swap, and give the product hero the same two names, so the picture and name morph (0.7 s, expo in-out, snapshots cropped with object-fit: cover) while the unnamed page body slides 6 % out and in along the reading direction, mirrored for back. For separate pages use @view-transition { navigation: auto; } inline in each head and set the names in pageswap and pagereveal.',
    keep: [
      'plain links and real URLs; focus moves to the new heading; the header holds still',
      'no transition under reduced motion or without the API, just the swap',
    ],
  },
};
