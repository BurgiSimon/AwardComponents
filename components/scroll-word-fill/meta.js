export default {
  id: 'scroll-word-fill',
  title: 'Scroll word fill',
  category: 'text',
  summary: 'A studio’s statement held on a sticky stage while the scroll fills it word by word from half ink to full, and empties it again on the way back.',
  recipe: 'scroll-word-fill',
  deps: ['gsap', 'lenis'],
  tags: ['text', 'scroll', 'scrub', 'sticky', 'splittext', 'manifesto', 'gsap', 'lenis'],
  added: '2026-10-28',
  order: 20,
  preview: { height: 640, scroll: true, hint: 'Scroll — the statement fills as you read', capture: { scroll: 0.2, wait: 1400 } },
  useCases: [
    'A studio’s “what we believe” between the hero and the work',
    'A product’s one-sentence promise, read at the speed of the visitor’s hand',
    'A chapter opener in a long read or an annual report',
  ],
  notes: [
    'The statement is a paragraph under a visually hidden heading; SplitText’s word spans are hidden and a visually hidden copy reads the sentence whole.',
    'Unread words rest at half ink by default, about 3.3:1 at display size, so the statement is readable before it is scrolled.',
    'Under reduced motion and in the static tier nothing is split: the sentence sits at full ink from the first frame.',
  ],
  controls: [
    { id: 'floor', label: 'Resting ink', type: 'range', min: 0.1, max: 0.8, step: 0.05, default: 0.5, group: 'Fill', help: 'Opacity of an unread word. Below 0.5 most of the statement fails 3:1 until it is scrolled.', prompt: 'Unread words rest at opacity {value} (default {default})' },
    { id: 'edge', label: 'Front edge', type: 'range', min: 0.15, max: 1, step: 0.05, default: 0.5, group: 'Fill', help: 'Stagger between words, in word-fill lengths. Low fills in soft waves; 1 steps one word at a time.', prompt: 'Stagger: each word starts {value} of a fill length after the one before it (default {default})' },
    { id: 'unit', label: 'Fill by', type: 'select', options: [{ value: 'words', label: 'Words' }, { value: 'chars', label: 'Characters' }], default: 'words', group: 'Fill', prompt: (v) => (v === 'chars' ? 'Fill character by character instead of word by word' : 'Fill word by word') },
    { id: 'length', label: 'Scroll length', type: 'range', min: 200, max: 500, step: 25, default: 300, unit: 'svh', group: 'Scroll', help: 'Height of the section; the stage is sticky for all of it.', prompt: 'Section height: {value} with a 100 svh sticky stage (default {default})' },
    { id: 'highlight', label: 'Key words', type: 'color', default: 'accent', group: 'Look', help: 'The phrases that carry the statement fill to this colour instead of ink.', prompt: 'Key phrases fill to {value} instead of ink (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Make {target} fill word by word as the page scrolls.',
    target: 'the studio statement',
    brief: 'A 300 svh section holds a 100 svh sticky stage (no pin spacer). After the fonts load, SplitText splits the statement into words (autoSplit, the timeline returned from onSplit); one timeline scrubbed from top top to bottom 130 % (scrub 0.5) takes each word from opacity 0.5 to 1 over one unit, staggered by half a unit, linear, so about two words are mid-fill and the sentence holds at full ink before the stage releases.',
    keep: [
      'the resting opacity keeps the statement readable before it is scrolled; the split words are aria-hidden behind a visually hidden copy.',
      'no split and full ink under reduced motion, even before the script runs.',
    ],
  },
};
