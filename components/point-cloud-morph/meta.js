export default {
  id: 'point-cloud-morph',
  title: 'Point-cloud morph',
  category: 'heroes',
  summary: 'A speaker’s features on a sticky stage where five thousand points become one icon, then the next, as you scroll: a swirl mid-morph, a hold at each shape, and the pointer parting the cloud.',
  recipe: 'point-cloud-shape-morph',
  deps: [],
  tags: ['canvas', 'particles', 'scroll', 'sticky', 'pointer', 'morph', 'svg'],
  added: '2026-10-28',
  order: 40,
  preview: { height: 680, scroll: true, hint: 'Scroll, and move the pointer through the cloud', capture: { scroll: 0.12, wait: 1600 } },
  useCases: [
    'A product’s three to five features, each with an icon the cloud becomes',
    'A studio’s practices or a service list given one living mark',
    'A brand mark that assembles from particles on a launch page, without WebGL',
  ],
  notes: [
    'The features are an ordered list of real buttons; the active one carries aria-current and pressing one scrolls to its shape. The canvas is aria-hidden.',
    'Points are projected in JavaScript and drawn as squares on a 2D canvas: no WebGL context to lose. A settled cloud skips its paint and the loop stops off-screen.',
    'Under reduced motion the points never travel: the two settled shapes cross-fade by opacity on scroll and the pointer does nothing. Phones and coarse pointers get half the points.',
  ],
  controls: [
    { id: 'count', label: 'Points', type: 'range', min: 1000, max: 8000, step: 500, default: 5000, group: 'Cloud', help: 'Halved on phones and coarse pointers.', prompt: 'Points: {value} on a desktop, half on a phone (default {default})' },
    { id: 'swirl', label: 'Swirl', type: 'range', min: 0, max: 600, step: 20, default: 260, unit: 'px/s', group: 'Motion', help: 'Weighted by sin²(πe): zero at each held shape, strongest half-way.', prompt: 'Mid-morph swirl: {value} × sin²(πe) (default {default})' },
    { id: 'size', label: 'Point size', type: 'range', min: 0.8, max: 3.2, step: 0.1, default: 1.6, unit: 'px', group: 'Look', prompt: 'Point size: {value} × the perspective scale (default {default})' },
    { id: 'tone', label: 'Colour', type: 'color', default: 'ink', options: ['ink', 'accent', 'sky', 'plum', 'moss', 'clay'], group: 'Look', prompt: 'Points in {value} (default {default})' },
  ],
  prompt: {
    skill: 'component',
    ask: 'Give {target} a point cloud that morphs between icons as the page scrolls.',
    target: 'the features section',
    brief: 'A tall section with a sticky stage. Points are sampled from SVG icons rasterised once (opaque pixels on a 2 px grid of a 512 px raster), projected in JavaScript (fov 45°, camera at 800, depth ±60 px, 16 depth buckets) and drawn as small squares on a 2D canvas. Scroll progress picks the pair of shapes; each holds for 18 % at both ends of its segment with a quadratic in-out between, a swirl weighted by sin²(πe) mid-morph, springs at stiffness 42 / damping 8, and a pointer repel within 100 px.',
    keep: [
      'the features as real list items with aria-current on the active one; the canvas aria-hidden.',
      'no travel under reduced motion (an opacity cross-fade on scroll); half the points on phones; no paint when settled.',
    ],
  },
};
