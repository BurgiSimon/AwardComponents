export default {
  id: 'shared-element-transition',
  title: 'Chosen-item transition',
  category: 'loaders-transitions',
  summary: 'A project index where the clicked row rises into the slot under the bar while the others leave by distance, then the project page builds beneath it. Back reverses it.',
  description: 'The exit explains the navigation. Instead of a wipe that hides the change, the row that was chosen travels to the place where the next page’s heading sits, and the other rows fade and drop in order of their distance from it, so the list dissolves outward from the click. The route is pushed only after the rise, and the project page opens with the same row already in that slot, its picture and text building underneath.\n\nGoing back runs the same idea in reverse: the page folds away and the row drops back into its place in the index while its neighbours return around it. Both routes are real taxi pages with their own URLs, so the back button does it too.',
  recipe: 'transition-promote-chosen',
  deps: ['@unseenco/taxi', 'gsap'],
  tags: ['transition', 'router', 'taxi', 'index', 'stagger', 'gsap', 'history'],
  added: '2026-10-28',
  order: 40,
  preview: { height: 640, scroll: true, hint: 'Open a project, then go back', capture: { wait: 700 } },
  useCases: [
    'A portfolio or case study index where each row opens a project page',
    'An archive, a product range or a list of articles that should feel continuous with the page it opens',
    'Any list → detail route where the chosen item deserves to carry the visitor across',
  ],
  notes: [
    'Every project is one real link, so the Tab path is one stop per row and Ctrl or Cmd click still opens a new tab.',
    'After each navigation the title names the page and focus moves to its heading; a second click during the exit is ignored.',
    'Under reduced and static motion the route changes at once with nothing moving.',
  ],
  controls: [
    { id: 'rise', label: 'Rise duration', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1.15, unit: 's', group: 'Exit', help: 'Phones use 70 % of it.', prompt: 'The chosen row rises in {value} with power2.inOut; phones use 70 % (default {default})' },
    { id: 'stagger', label: 'Sibling delay per step', type: 'range', min: 0, max: 0.2, step: 0.01, default: 0.09, unit: 's', group: 'Exit', prompt: 'Each sibling waits {value} per step of distance before it fades and drops 18 px (default {default})' },
    { id: 'order', label: 'Sibling order', type: 'select', options: [{ value: 'distance', label: 'By distance' }, { value: 'list', label: 'Top to bottom' }], default: 'distance', group: 'Exit', help: 'By distance dissolves the list outward from the chosen row.', prompt: (v) => (v === 'list' ? 'Siblings leave from the top of the list down, not by distance' : 'Siblings leave in order of their distance from the chosen row') },
    { id: 'reverse', label: 'Back reverses it', type: 'toggle', default: true, group: 'Return', prompt: { on: 'Going back reverses it: the page folds away and the row drops back into its place while its neighbours return by distance', off: 'Going back is a plain 0.45 s fade' } },
  ],
  actions: [
    { id: 'open', label: 'Open a project', icon: 'arrowRight' },
    { id: 'back', label: 'Back to the index', icon: 'arrowLeft' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Make {target} promote the chosen item on navigation.',
    target: 'the project index and its project pages',
    brief: 'On a row click the other rows fade and drop 18 px with a delay of 0.09 s per step of distance from the chosen row (rows off-screen leave at once), and the chosen row rises into the slot under the fixed bar (1.15 s, power2.inOut; 0.8 s on phones). The route is pushed only after the rise, and the next page puts its heading in that same slot, read from the view’s padding-top, then builds the page (its picture and facts) beneath it. Back reverses it: the page folds away and the row drops back into its place while its neighbours return by distance.',
    keep: [
      'one real link per item; modified clicks open a new tab; focus moves to the new heading and the title updates',
      'reduced and static motion change the route at once; a second click during the exit is ignored',
    ],
  },
};
