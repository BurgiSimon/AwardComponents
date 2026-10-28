// Library categories, in sidebar order. A component names one by `category` in its meta.js.
// Adding a category: add an entry here (id, title, blurb, icon from src/app/icons.js); check.mjs rejects unknown ids.
export const categories = [
  { id: 'foundations', title: 'Foundations', icon: 'layers', blurb: 'Smooth scroll, easing, motion tiers and device budgets — the layer every other move stands on.' },
  { id: 'cursors-buttons', title: 'Cursors & buttons', icon: 'pointer', blurb: 'Pointer moves that carry meaning: magnetic targets, contextual cursors, trails and toggles.' },
  { id: 'navigation', title: 'Navigation & overlays', icon: 'menu', blurb: 'Menus, headers, scrollbars, mode switches and dialogs with every keyboard path intact.' },
  { id: 'loaders-transitions', title: 'Loaders & transitions', icon: 'loader', blurb: 'Arrivals and departures: preloaders tied to real signals, route changes and theme wipes.' },
  { id: 'text', title: 'Text & typography', icon: 'type', blurb: 'Headlines that reveal, decode, cycle and fill, and type set like a foundry specimen.' },
  { id: 'heroes', title: 'Heroes', icon: 'hero', blurb: 'First viewports with a single idea: art-directed crops, windows, objects and fields.' },
  { id: 'scroll', title: 'Scroll effects', icon: 'scroll', blurb: 'Chapters the scroll drives: pins, stacks, doors, rails, drawn paths and decks.' },
  { id: 'galleries', title: 'Galleries & carousels', icon: 'grid', blurb: 'Work, archives and reels: marquees, snapping carousels, infinite planes and hover previews.' },
  { id: 'commerce', title: 'Product & commerce', icon: 'bag', blurb: 'Evidence that sells: specifications, feature tabs, comparisons, models and a working bag.' },
  { id: 'closers', title: 'Footers, forms & extras', icon: 'footer', blurb: 'The close of a page and the things people find by playing: footers, enquiries, 404s, toys.' },
  { id: 'webgl', title: 'WebGL & shaders', icon: 'cube', blurb: 'GPU surfaces with a DOM mirror and a no-GL path: images, fluids, light, glass and post.' },
  { id: 'blocks', title: 'Blocks', icon: 'block', blurb: 'Whole sections and pages: the components above placed together and paced.' },
];

export const categoryById = new Map(categories.map((c) => [c.id, c]));
