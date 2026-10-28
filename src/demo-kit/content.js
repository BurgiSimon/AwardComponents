// Shared demo content: a small cast of fictional clients, so demos read as real products without each one
// inventing a brand. Use them, extend them here when a demo needs more, and keep copy specific and plain
// (no "elevate", "seamless", "unlock", "Get started", "Learn more": the awards audit treats those as generated).
// Pictures are referenced by media id (src/demo-kit/media.json) through `tags`, so demos pick with photos({ tags }).

// Halden — an architecture and interiors studio in Bergen. Portfolios, project indexes, case studies.
export const studio = {
  name: 'Halden',
  full: 'Halden Arkitekter',
  tagline: 'Buildings for long winters and short summers.',
  city: 'Bergen',
  email: 'studio@halden.no',
  phone: '+47 55 21 40 00',
  address: ['Strandkaien 14', '5013 Bergen', 'Norway'],
  disciplines: ['Architecture', 'Interiors', 'Landscape', 'Furniture'],
  nav: ['Work', 'Studio', 'Journal', 'Contact'],
  projects: [
    { slug: 'fjordhus', title: 'Fjordhus', place: 'Hardanger, NO', year: 2026, discipline: 'Architecture', size: '310 m²', tags: ['architecture'], summary: 'A timber house set on a granite shelf above the water.' },
    { slug: 'tern-library', title: 'Tern Library', place: 'Tromsø, NO', year: 2025, discipline: 'Architecture', size: '2,400 m²', tags: ['architecture'], summary: 'A public reading room with a single continuous window to the sound.' },
    { slug: 'stillwater', title: 'Stillwater Pavilion', place: 'Oslo, NO', year: 2025, discipline: 'Landscape', size: '180 m²', tags: ['water'], summary: 'A bathing pavilion of larch slats and warm concrete.' },
    { slug: 'kiln-house', title: 'Kiln House', place: 'Stavanger, NO', year: 2024, discipline: 'Interiors', size: '140 m²', tags: ['interior'], summary: 'A former brick kiln turned into a ceramicist’s home and studio.' },
    { slug: 'granite-court', title: 'Granite Court', place: 'Bergen, NO', year: 2024, discipline: 'Architecture', size: '6,800 m²', tags: ['city'], summary: 'Forty-two flats around a planted courtyard cut from the hillside.' },
    { slug: 'low-light', title: 'Low Light Bar', place: 'Copenhagen, DK', year: 2023, discipline: 'Interiors', size: '95 m²', tags: ['interior', 'dark'], summary: 'A listening bar lit only from the floor.' },
    { slug: 'saltworks', title: 'Saltworks Archive', place: 'Læsø, DK', year: 2023, discipline: 'Architecture', size: '1,150 m²', tags: ['architecture'], summary: 'An archive for a salt-making island, half buried in the dunes.' },
    { slug: 'arc-chair', title: 'Arc Chair', place: 'Edition of 200', year: 2022, discipline: 'Furniture', size: '78 × 54 cm', tags: ['furniture'], summary: 'A steam-bent ash chair with one continuous back and arm.' },
  ],
};

// Ostra — a ceramics and objects shop. Product cards, carts, specifications, configurators.
export const shop = {
  name: 'Ostra',
  tagline: 'Thrown, glazed and fired in small runs.',
  currency: 'EUR',
  freeShippingFrom: 150,
  products: [
    { id: 'tide-vase', name: 'Tide Vase', price: 148, colour: 'Oat glaze', colours: ['Oat', 'Iron', 'Celadon'], sizes: ['S', 'M', 'L'], soldOut: ['L'], tags: ['ceramic', 'object'], dims: { h: 32, d: 14, unit: 'cm' }, weight: '1.4 kg', material: 'Stoneware, reduction fired at 1,280 °C' },
    { id: 'dune-bowl', name: 'Dune Bowl', price: 64, colour: 'Sand', colours: ['Sand', 'Ash'], sizes: ['One size'], tags: ['ceramic', 'object'], dims: { h: 9, d: 24, unit: 'cm' }, weight: '0.9 kg', material: 'Stoneware with a dry matte glaze' },
    { id: 'ember-cup', name: 'Ember Cup', price: 32, colour: 'Rust', colours: ['Rust', 'Chalk', 'Moss'], sizes: ['180 ml', '260 ml'], tags: ['ceramic', 'object'], dims: { h: 8, d: 8, unit: 'cm' }, weight: '0.3 kg', material: 'Porcelain, iron-speckled glaze' },
    { id: 'luma-lamp', name: 'Luma Lamp', price: 340, colour: 'Opal', colours: ['Opal', 'Smoke'], sizes: ['Table', 'Floor'], tags: ['lamp', 'glass'], dims: { h: 46, d: 30, unit: 'cm' }, weight: '3.2 kg', material: 'Mouth-blown opal glass, brushed brass' },
    { id: 'arc-chair', name: 'Arc Chair', price: 890, colour: 'Natural ash', colours: ['Natural', 'Smoked'], sizes: ['One size'], tags: ['furniture'], dims: { h: 78, d: 54, unit: 'cm' }, weight: '6.8 kg', material: 'Steam-bent ash, linseed oil' },
    { id: 'strand-throw', name: 'Strand Throw', price: 180, colour: 'Undyed', colours: ['Undyed', 'Indigo'], sizes: ['130 × 180'], tags: ['textile'], dims: { h: 180, d: 130, unit: 'cm' }, weight: '1.1 kg', material: 'Norwegian lambswool, woven in Os' },
    { id: 'pebble-dish', name: 'Pebble Dish', price: 28, colour: 'Celadon', colours: ['Celadon', 'Oat'], sizes: ['One size'], tags: ['ceramic', 'object'], dims: { h: 3, d: 12, unit: 'cm' }, weight: '0.2 kg', material: 'Porcelain' },
    { id: 'wick-candle', name: 'Wick Holder', price: 46, colour: 'Iron', colours: ['Iron', 'Brass'], sizes: ['Single', 'Pair'], tags: ['object'], dims: { h: 12, d: 7, unit: 'cm' }, weight: '0.4 kg', material: 'Hand-forged iron' },
  ],
};

// Fieldnote — an independent magazine about places and the people who make them. Articles, long reads, editorial.
export const magazine = {
  name: 'Fieldnote',
  issue: 'Issue 14 — Weather',
  articles: [
    { slug: 'salt-and-time', title: 'Salt and time', dek: 'On an island where the summer is spent boiling the sea.', author: 'Ingrid Vold', read: '12 min', section: 'Places' },
    { slug: 'the-quiet-room', title: 'The quiet room', dek: 'Why the best libraries are designed around a single window.', author: 'Tomas Reyes', read: '8 min', section: 'Architecture' },
    { slug: 'glaze-chemistry', title: 'A glaze is a weather report', dek: 'Three potters on ash, iron and the kiln’s bad days.', author: 'Mai Okafor', read: '15 min', section: 'Craft' },
    { slug: 'night-swimming', title: 'Night swimming', dek: 'The bathing culture of the far north, after dark.', author: 'Ellis Brandt', read: '6 min', section: 'Culture' },
    { slug: 'slow-tools', title: 'Slow tools', dek: 'A carpenter’s case for owning fewer, better things.', author: 'Aino Lehto', read: '10 min', section: 'Craft' },
    { slug: 'map-of-light', title: 'A map of light', dek: 'Charting how far the sun reaches into a city in December.', author: 'Paul Achterberg', read: '9 min', section: 'Cities' },
  ],
  longRead: [
    'The kilns on Læsø were lit in May and not allowed to go out until the first storms of September. For four months the island smelled of wood smoke and wet sand, and the salt came off the pans in grey, glittering crusts.',
    'Nobody does it for the money any more. A kilo of island salt sells for less than a coffee in Copenhagen. They do it because the pans have been here since the twelfth century and someone has to keep the fires going.',
    'Birthe has boiled brine for thirty-one summers. She reads the pan by sound: a low roll means the water is too deep, a hiss means it is nearly done. She has never used a thermometer, and she says the young ones who do are always a little late.',
    'In the archive above the boiling house, the island keeps every ledger since 1788: weights, weather, the names of the boys who carried peat. It is the most complete record of a single industry in the north, and it is held in a room the size of a garage.',
    'The new building gives that record a proper home. It is half buried, so the dune can keep blowing across it, and it is lit from one long slot that follows the line of the horizon.',
  ],
};

// Kova — a hardware product: a speaker. Product heroes, 3D, specifications, comparisons.
export const product = {
  name: 'Kova One',
  maker: 'Kova',
  kind: 'Room speaker',
  price: 690,
  tagline: 'Sound you can stop noticing.',
  colours: [
    { id: 'chalk', name: 'Chalk', hex: '#e8e4dc' },
    { id: 'graphite', name: 'Graphite', hex: '#2b2c2f' },
    { id: 'clay', name: 'Clay', hex: '#c9744b' },
  ],
  specs: [
    ['Drivers', '2 × 19 mm tweeters, 1 × 120 mm woofer'],
    ['Frequency response', '38 Hz – 22 kHz (±3 dB)'],
    ['Amplification', '3 × class D, 140 W total'],
    ['Connectivity', 'Wi-Fi 6, Bluetooth 5.3, USB-C audio'],
    ['Dimensions', '214 × 168 × 168 mm'],
    ['Weight', '3.1 kg'],
    ['Enclosure', 'Recycled aluminium, wool-blend grille'],
  ],
  features: [
    { title: 'Room tuning', body: 'Four microphones measure the room in eight seconds and shape the bass to it.' },
    { title: 'Quiet hours', body: 'After ten, loudness follows your ears, not the dial: speech stays clear, the low end steps back.' },
    { title: 'Stereo pair', body: 'Two speakers find each other on the network and split left and right on their own.' },
    { title: 'Repairable', body: 'Eight screws, no glue. Every part is sold separately for ten years.' },
  ],
};

// Signal — a three-day music and arts festival. Line-ups, tickets, countdowns, event heroes.
export const festival = {
  name: 'Signal',
  edition: 'Signal Festival 2027',
  dates: '12–14 August 2027',
  place: 'Refshaleøen, Copenhagen',
  stages: ['Harbour', 'Hall 4', 'The Crane', 'Greenhouse'],
  lineup: ['Marlow Ash', 'Kiri Tanaka', 'The Low Tides', 'Odessa Rae', 'Nils & the Weather', 'Juno Park', 'Vesper Choir', 'Aurelio Cano', 'Sundial', 'Hana Ekström', 'Black Pine', 'Moss Theory'],
  tickets: [
    { name: 'Day pass', price: 95 },
    { name: 'Weekend', price: 240 },
    { name: 'Weekend + camping', price: 310 },
  ],
};

// Parallel — a small-business banking app. Feature tabs, forms, dashboards, pricing.
export const app = {
  name: 'Parallel',
  tagline: 'Banking for studios of two to twenty.',
  features: [
    { title: 'Invoices that chase themselves', body: 'Send, remind and reconcile in one place. Late payers get a polite nudge on day three.' },
    { title: 'Tax set aside, automatically', body: 'A share of every payment moves to a locked pot, so April is just a transfer.' },
    { title: 'Cards for the whole team', body: 'Physical and virtual cards with limits per project, frozen in one tap.' },
    { title: 'Books your accountant likes', body: 'Receipts matched on upload, exports in the format your accountant already uses.' },
  ],
  plans: [
    { name: 'Solo', price: 0, note: 'For one person, forever free.' },
    { name: 'Studio', price: 19, note: 'Up to 8 people and 3 accounts.' },
    { name: 'Practice', price: 49, note: 'Up to 20 people, approvals and audit log.' },
  ],
  clients: ['Northgate', 'Arden & Vale', 'Morrow', 'Hollis', 'Kestrel', 'Fable & Co', 'Lumen', 'Orchard', 'Tessel', 'Brightwater'],
};

// Meridian — a public observatory and planetarium on the coast north of Tromsø. Shows, exhibitions, visits.
// Its pictures are the footage in media.json (the Earth from deep space, an orbit time-lapse, desert clouds).
export const observatory = {
  name: 'Meridian',
  full: 'Meridian Observatory',
  tagline: 'A dark-sky observatory and planetarium at 69° north.',
  place: 'Skulsfjord, north of Tromsø',
  email: 'visit@meridian.no',
  exhibition: { title: 'One orbit', dek: 'Ninety-two minutes around the planet, filmed from the station window.', dates: '14 November 2026 – 30 March 2027' },
  shows: [
    { title: 'The night side', time: '19:00', length: '35 min', room: 'Dome', note: 'The planet after dark, city by city.' },
    { title: 'A million miles out', time: '20:00', length: '40 min', room: 'Dome', note: 'The whole disc of the Earth, one day in eleven minutes.' },
    { title: 'Aurora season', time: '21:30', length: '30 min', room: 'Dome', note: 'Live from the roof camera when the sky is clear.' },
    { title: 'First telescope', time: '11:00', length: '25 min', room: 'Studio', note: 'For ages six and up: build one and keep it.' },
  ],
  visit: [
    { label: 'Open', value: 'Wednesday to Sunday, 10–23' },
    { label: 'Getting here', value: 'Bus 420 from Tromsø, 50 minutes' },
    { label: 'Tickets', value: 'Adult 190 kr, under 16 free' },
  ],
  // Captions for the orbit time-lapse (video-earth-orbit, all daylight), by share of the clip.
  orbit: [
    { at: 0.06, label: 'Cloud bands over open ocean, 400 km below' },
    { at: 0.32, label: 'Dark water through a gap in the cloud' },
    { at: 0.58, label: 'One of the station’s solar wings, 35 m long' },
    { at: 0.84, label: 'The horizon curves away into black' },
  ],
};

// People for testimonials, teams and bylines (fictional).
export const people = [
  { name: 'Ingrid Vold', role: 'Founding partner, Halden' },
  { name: 'Tomas Reyes', role: 'Head of Interiors, Halden' },
  { name: 'Mai Okafor', role: 'Ceramicist, Ostra' },
  { name: 'Ellis Brandt', role: 'Editor, Fieldnote' },
  { name: 'Aino Lehto', role: 'Programme director, Signal' },
  { name: 'Paul Achterberg', role: 'Founder, Parallel' },
];

export const formatPrice = (value, currency = 'EUR', locale = 'en-IE') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
