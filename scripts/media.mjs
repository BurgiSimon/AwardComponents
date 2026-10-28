#!/usr/bin/env node
// The shared picture set: download every entry of scripts/data/media-sources.json, encode two WebP sizes into
// public/media/, write src/demo-kit/media.json (the manifest the demos import through demo-kit/media.js) and
// CREDITS.md (one row per picture and clip).
//
//   node scripts/media.mjs                  fetch what is missing, encode what is missing, rewrite the manifest
//   node scripts/media.mjs --only a,b       just these ids (the manifest keeps every other entry it already has)
//   node scripts/media.mjs --force          re-encode even when the WebP files exist
//
// Raw downloads are cached in .cache/media/ (gitignored), so a re-run touches the network only for new entries.
// Encoding runs in headless Chromium (lib/encode.mjs), so no native image tooling is needed.
// Licences: public domain / CC0 only; each entry records its licence, licence URL and source page, and CREDITS.md
// lists them. Videos (optional `videos` array) must already be WebM; they are copied as-is with a WebP poster.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';
import { encodeWebp } from './lib/encode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = path.join(ROOT, 'scripts/data/media-sources.json');
const CACHE = path.join(ROOT, '.cache/media');
const OUT = path.join(ROOT, 'public/media');
const MANIFEST = path.join(ROOT, 'src/demo-kit/media.json');
const UA = 'AwardComponents-media/0.1 (+https://github.com/BurgiSimon/AwardComponents)';
const SIZES = { lg: { edge: 1800, quality: 0.8 }, sm: { edge: 640, quality: 0.78 } };
const MAX_VIDEO_BYTES = 4 * 1024 * 1024;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const only = value('only') ? new Set(value('only').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const force = flag('force');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rel = (f) => path.relative(ROOT, f);

// Downloads, with backoff for rate limits (Wikimedia answers 429 to bursts) and a pause between Wikimedia calls.
let lastWikimedia = 0;
async function download(url) {
  for (let attempt = 1; ; attempt++) {
    if (/wikimedia\.org/.test(url)) {
      const wait = lastWikimedia + 1500 - Date.now();
      if (wait > 0) await sleep(wait);
      lastWikimedia = Date.now();
    }
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': UA, 'api-user-agent': UA }, signal: AbortSignal.timeout(120000) });
    } catch (error) {
      if (attempt >= 4) {
        // Behind an HTTPS proxy that Node's fetch does not see, NODE_USE_ENV_PROXY=1 (Node 22.21+) routes it through.
        const hint = (process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY ? ' (behind a proxy? retry with NODE_USE_ENV_PROXY=1)' : '';
        throw new Error(`${url}: ${error.cause?.code ?? error.message}${hint}`);
      }
      await sleep(3000 * attempt);
      continue;
    }
    if (res.ok) return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '' };
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      // Honour Retry-After, but cap it: a long ban is better reported than waited out.
      const retryAfter = Math.min(Number(res.headers.get('retry-after')) || 0, 60);
      await sleep(Math.max(retryAfter * 1000, 4000 * attempt));
      continue;
    }
    throw new Error(`${url}: HTTP ${res.status}`);
  }
}

const extOf = (url, type) => {
  if (/png/.test(type)) return '.png';
  if (/webm/.test(type)) return '.webm';
  if (/jpe?g/.test(type)) return '.jpg';
  const m = new URL(url).pathname.match(/\.(jpe?g|png|webp|webm)$/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.bin';
};

// Cache files are named <key>-<hash of the URL>, so changing an entry's URL fetches the new file.
async function cached(key, url) {
  const stem = `${key}-${createHash('sha1').update(url).digest('hex').slice(0, 8)}`;
  const files = fs.existsSync(CACHE) ? fs.readdirSync(CACHE) : [];
  const hit = files.find((f) => f.startsWith(`${stem}.`));
  if (hit) return fs.readFileSync(path.join(CACHE, hit));
  const { bytes, type } = await download(url);
  if (/text\/html|json/.test(type)) throw new Error(`${url}: got ${type.split(';')[0]}, not a media file`);
  fs.mkdirSync(CACHE, { recursive: true });
  const stale = new RegExp(`^${key}-[0-9a-f]{8}\\.`);
  for (const f of files) if (stale.test(f)) fs.rmSync(path.join(CACHE, f));
  fs.writeFileSync(path.join(CACHE, stem + extOf(url, type)), bytes);
  console.log(`  fetched ${key} (${(bytes.length / 1048576).toFixed(1)} MB)`);
  return bytes;
}

// Width and height from a WebP header (VP8, VP8L or VP8X), so skipped entries still land in the manifest.
function webpSize(file) {
  const b = fs.readFileSync(file);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') { const n = b.readUInt32LE(21); return { width: 1 + (n & 0x3fff), height: 1 + ((n >> 14) & 0x3fff) }; }
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`${rel(file)}: not a WebP file`);
}

const ORIENTATION = ['portrait-orientation', 'landscape-orientation', 'square'];
function orientationTag(w, h) {
  const r = w / h;
  return r > 1.1 ? 'landscape-orientation' : r < 0.9 ? 'portrait-orientation' : 'square';
}

const creditOf = (s) => `${s.title} — ${s.creator}, ${s.collection} (${s.licence})`;

function validate(list, kind) {
  const ids = new Set();
  for (const s of list) {
    for (const key of ['id', 'url', 'page', 'title', 'creator', 'licence', 'licenceUrl', 'collection', 'alt']) {
      if (!s[key]) throw new Error(`${kind} ${s.id ?? '?'}: missing "${key}"`);
    }
    if (!/^[a-z0-9-]+$/.test(s.id)) throw new Error(`${kind} ${s.id}: ids are lowercase kebab-case`);
    if (ids.has(s.id)) throw new Error(`${kind} ${s.id}: duplicate id`);
    if (!/^(CC0|Public domain)/i.test(s.licence)) throw new Error(`${kind} ${s.id}: licence "${s.licence}" is not CC0 / public domain`);
    ids.add(s.id);
  }
}

const sources = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
const images = sources.items ?? [];
const clips = sources.videos ?? [];
validate(images, 'item');
validate(clips, 'video');
if (only) {
  const known = new Set([...images, ...clips].map((s) => s.id));
  const unknown = [...only].filter((id) => !known.has(id));
  if (unknown.length) { console.error(`unknown id(s): ${unknown.join(', ')}`); process.exit(1); }
}

fs.mkdirSync(OUT, { recursive: true });
const previous = (() => { try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return { items: [], videos: [] }; } })();
const prevItems = new Map((previous.items ?? []).map((m) => [m.id, m]));
const prevVideos = new Map((previous.videos ?? []).map((m) => [m.id, m]));

const browser = await launch();
const page = await browser.newPage();
await page.goto('about:blank');
const failures = [];

const items = [];
for (const s of images) {
  if (only && !only.has(s.id)) { if (prevItems.has(s.id)) items.push(prevItems.get(s.id)); continue; }
  const lg = path.join(OUT, `${s.id}.webp`);
  const sm = path.join(OUT, `${s.id}-sm.webp`);
  try {
    let big, small;
    if (!force && fs.existsSync(lg) && fs.existsSync(sm)) {
      big = webpSize(lg);
      small = webpSize(sm);
    } else {
      const raw = await cached(s.id, s.url);
      const filter = s.filter || '';
      const a = await encodeWebp(page, raw, { width: SIZES.lg.edge, height: SIZES.lg.edge, quality: s.quality ?? SIZES.lg.quality, filter });
      const b = await encodeWebp(page, raw, { width: SIZES.sm.edge, height: SIZES.sm.edge, quality: s.qualitySm ?? SIZES.sm.quality, filter });
      fs.writeFileSync(lg, a.buffer);
      fs.writeFileSync(sm, b.buffer);
      big = a;
      small = b;
      console.log(`  ${s.id}: ${a.width}×${a.height} ${(a.buffer.length / 1024).toFixed(0)} KB · ${b.width}×${b.height} ${(b.buffer.length / 1024).toFixed(0)} KB`);
    }
    const tags = [...new Set((s.tags ?? []).filter((t) => !ORIENTATION.includes(t)).concat(orientationTag(big.width, big.height)))];
    items.push({
      id: s.id,
      src: `media/${s.id}.webp`,
      srcSm: `media/${s.id}-sm.webp`,
      width: big.width,
      height: big.height,
      smWidth: small.width,
      smHeight: small.height,
      alt: s.alt,
      tags,
      focus: s.focus || '50% 50%',
      credit: creditOf(s),
      licence: s.licence,
      licenceUrl: s.licenceUrl,
      page: s.page,
    });
  } catch (error) {
    failures.push(`${s.id}: ${error.message}`);
    if (prevItems.has(s.id)) items.push(prevItems.get(s.id));
  }
}

const videos = [];
for (const s of clips) {
  if (only && !only.has(s.id)) { if (prevVideos.has(s.id)) videos.push(prevVideos.get(s.id)); continue; }
  const file = path.join(OUT, `${s.id}.webm`);
  const poster = path.join(OUT, `${s.id}-poster.webp`);
  try {
    if (force || !fs.existsSync(file)) {
      const raw = await cached(s.id, s.url);
      if (raw.readUInt32BE(0) !== 0x1a45dfa3) throw new Error('not a WebM (EBML) file');
      if (raw.length > MAX_VIDEO_BYTES) throw new Error(`${(raw.length / 1048576).toFixed(1)} MB is over the 4 MB budget`);
      fs.writeFileSync(file, raw);
    }
    let size;
    if (force || !fs.existsSync(poster)) {
      if (!s.poster) throw new Error('missing "poster" (a still image URL)');
      const still = await cached(`${s.id}-poster`, s.poster);
      const p = await encodeWebp(page, still, { width: SIZES.lg.edge, height: SIZES.lg.edge, quality: SIZES.lg.quality });
      fs.writeFileSync(poster, p.buffer);
      size = p;
    } else size = webpSize(poster);
    videos.push({
      id: s.id,
      src: `media/${s.id}.webm`,
      poster: `media/${s.id}-poster.webp`,
      width: s.width ?? size.width,
      height: s.height ?? size.height,
      duration: s.duration,
      alt: s.alt,
      tags: s.tags ?? [],
      credit: creditOf(s),
      licence: s.licence,
      licenceUrl: s.licenceUrl,
      page: s.page,
    });
    console.log(`  ${s.id}: ${(fs.statSync(file).size / 1048576).toFixed(1)} MB webm, ${s.duration}s`);
  } catch (error) {
    failures.push(`${s.id}: ${error.message}`);
    if (prevVideos.has(s.id)) videos.push(prevVideos.get(s.id));
  }
}

await browser.close();

// A full run owns public/media/: files of entries that left the sources are removed.
if (!only) {
  const keep = new Set([
    ...images.flatMap((s) => [`${s.id}.webp`, `${s.id}-sm.webp`]),
    ...clips.flatMap((s) => [`${s.id}.webm`, `${s.id}-poster.webp`]),
  ]);
  for (const f of fs.readdirSync(OUT)) {
    if (/\.(webp|webm)$/.test(f) && !keep.has(f)) { fs.rmSync(path.join(OUT, f)); console.log(`  removed ${f}`); }
  }
}

const manifest = { generated: new Date().toISOString(), items, videos };
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

// CREDITS.md always lists every source entry, whatever --only selected.
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
const href = (u) => String(u).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
const row = (s) => `| \`${s.id}\` | ${cell(s.title)} | ${cell(s.creator)} | ${cell(s.collection)} | [${cell(s.licence)}](${href(s.licenceUrl)}) | [${host(s.page)}](${href(s.page)}) |`;
const head = '| id | Title | Creator | Collection | Licence | Source |\n| --- | --- | --- | --- | --- | --- |';
const credits = [
  '# Credits',
  '',
  `The demo pictures${clips.length ? ' and clips' : ''} are public domain or CC0, from the collections named below; no attribution is required, but every item is credited here and on the component pages that use it. Generated by \`scripts/media.mjs\` from \`scripts/data/media-sources.json\`.`,
  '',
  `## Pictures (${images.length})`,
  '',
  head,
  ...images.map(row),
  ...(clips.length ? ['', `## Videos (${clips.length})`, '', head, ...clips.map(row)] : []),
  '',
  'NASA material is not copyrighted in the United States; its use does not imply NASA endorsement.',
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'CREDITS.md'), credits);

const size = (test) => fs.readdirSync(OUT).filter(test).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0) / 1048576;
const pictureMb = size((f) => f.endsWith('.webp') && !f.endsWith('-poster.webp'));
const videoMb = size((f) => f.endsWith('.webm') || f.endsWith('-poster.webp'));
console.log(`${items.length} pictures (${pictureMb.toFixed(2)} MB), ${videos.length} videos with posters (${videoMb.toFixed(2)} MB) in ${rel(OUT)}/ → ${rel(MANIFEST)}`);
if (pictureMb > 9) console.warn(`pictures are over the 9 MB budget: lower \`quality\` on the heaviest entries`);
if (failures.length) {
  console.error(`${failures.length} failed:\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
}
