export default {
  id: 'display-mode-switch',
  title: 'Display mode switch',
  category: 'navigation',
  summary: 'A docked Light / Dark switch and a Grid overlay of the real columns under a studio’s project tiles, with L, D and G hotkeys and a choice remembered across visits.',
  description: 'A mode the visitor holds, not one the scroll imposes. The segmented switch re-skins the page, the Grid button lays the page’s own columns over it, and L, D and G do the same from the keyboard. Each choice is set on the root, stored, printed in its control’s label and restored before the page paints on the next visit.',
  recipe: 'persistent-mode-switch',
  deps: ['gsap'],
  tags: ['theme', 'dark-mode', 'grid', 'hotkeys', 'switch', 'localstorage', 'portfolio', 'gsap'],
  added: '2026-10-28',
  order: 40,
  preview: { height: 620, hint: 'Press L, D or G', capture: { action: 'grid', wait: 1200 } },
  useCases: [
    'A portfolio or studio site with two real registers: a light gallery and a dark one',
    'A design-led site that shows its construction: the grid as something the visitor can switch on',
    'A reading mode for long pages, remembered across visits',
  ],
  notes: [
    'The switch is native radios in a fieldset with a legend, so arrow keys move the choice; Grid is a button with aria-pressed, and each change is announced politely.',
    'The hotkeys stand down in text fields, for any Ctrl, Alt or Meta chord, on key repeat and during IME composition.',
    'Under reduced motion every state still changes and is stored; nothing slides or scales.',
  ],
  controls: [
    { id: 'dock', label: 'Dock position', type: 'select', options: [{ value: 'center', label: 'Bottom centre' }, { value: 'left', label: 'Bottom left' }, { value: 'right', label: 'Bottom right' }], default: 'center', group: 'Switch', prompt: (v) => `Dock the switch at the bottom ${{ center: 'centre', left: 'left', right: 'right' }[v]} of the viewport (default centre)` },
    { id: 'cols', label: 'Grid columns', type: 'select', options: [{ value: '8', label: '8' }, { value: '12', label: '12' }, { value: '16', label: '16' }], default: '12', group: 'Grid', help: 'The page’s real grid; the overlay draws the same columns. Phones use 4.', prompt: 'Lay the page on {value} columns and draw the same ones in the overlay (4 on phones; default {default})' },
    { id: 'hints', label: 'Show hotkey hints', type: 'toggle', default: true, group: 'Switch', prompt: { on: 'Show the L, D and G hotkeys inside the controls', off: 'Keep the hotkeys but do not print them in the controls' } },
  ],
  actions: [{ id: 'grid', label: 'Toggle the grid' }, { id: 'dark', label: 'Switch light / dark' }],
  prompt: {
    skill: 'component',
    ask: 'Add a persistent display switch to {target}.',
    target: 'the portfolio',
    brief: 'A docked segmented Light / Dark switch (native radios under a sliding indicator, .4 s power3.out) and a Grid button that overlays the page’s real columns, with L, D and G hotkeys. Each choice is a root attribute, stored in localStorage, printed in the control as a bracket readout and restored by an inline head script before first paint.',
    keep: [
      'native radios in a fieldset (arrow keys move the choice) and an aria-pressed Grid button, each change announced politely.',
      'hotkeys ignored in text fields, with modifiers, on repeat and during composition; no tweens under reduced motion.',
    ],
  },
};
