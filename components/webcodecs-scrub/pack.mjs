#!/usr/bin/env node
// Packs the orbit time-lapse into film.bin, the one file the demo fetches. Run once, offline, and commit the result:
//   node components/webcodecs-scrub/pack.mjs [--fps 30] [--width 640] [--height 336] [--crf 28] [--key 10]
// Needs ffmpeg with libx264 on the PATH. Nothing here runs in the browser.
//
// The layout is the recipe's (webcodecs-frame-scrub): the encoded chunks back to back, then a JSON manifest of every
// frame's offset, length, timestamp and type, then a four-byte little-endian pointer to where the manifest starts.
// One fetch, one ArrayBuffer, a view per chunk, no MP4 demuxer.
//
// ffmpeg writes an H.264 Annex B stream (start codes, an access unit delimiter before every frame, SPS and PPS before
// every IDR). This script splits it into frames and rewrites each one as AVCC (four-byte lengths, slices only), the
// form WebCodecs takes with an avcC `description`; the SPS and PPS become that description. No B-frames, so decode
// order is display order and frame i has timestamp i / fps; the stream says so (max_num_reorder_frames 0) and keeps at
// most four reference frames, so a hardware decoder puts each frame out as soon as it is decoded instead of holding it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);

const SOURCE = path.resolve(root, arg('src', 'public/media/video-earth-orbit.webm'));
const OUT = path.resolve(here, arg('out', 'film.bin'));
const FPS = Number(arg('fps', 30));         // the source's own rate: every frame of the footage, none resampled
const WIDTH = Number(arg('width', 640));
const HEIGHT = Number(arg('height', 336));
const CRF = Number(arg('crf', 28));
const KEY_EVERY = Number(arg('key', 10));     // a jump decodes at most this many frames
// The source letterboxes the picture in black: rows 0–13 and 465–479 are bar, rows 14 and 464 half dark. Cropping 16
// rows from each edge keeps only whole picture rows (16–463), and 854 × 448 is the 640 × 336 shape to a pixel.
const BARS = 16;

// 1. Encode: crop the bars (and the half-dark row at each edge), scale, H.264 Main with a keyframe exactly every
//    KEY_EVERY frames.
const ff = spawnSync('ffmpeg', [
  '-v', 'error', '-i', SOURCE, '-an',
  '-vf', `crop=iw:ih-${BARS * 2}:0:${BARS},scale=${WIDTH}:${HEIGHT}:flags=lanczos,fps=${FPS},format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'veryslow', '-profile:v', 'main', '-tune', 'film', '-crf', String(CRF),
  '-x264-params', `keyint=${KEY_EVERY}:min-keyint=${KEY_EVERY}:scenecut=0:bframes=0:ref=4:aud=1:repeat-headers=1:open-gop=0`,
  '-f', 'h264', 'pipe:1',
], { maxBuffer: 64 * 1024 * 1024 });
if (ff.status !== 0) {
  console.error(String(ff.stderr || ff.error || 'ffmpeg failed'));
  process.exit(1);
}
const stream = new Uint8Array(ff.stdout.buffer, ff.stdout.byteOffset, ff.stdout.byteLength);

// 2. Split the Annex B stream into NAL units at its start codes (00 00 01, or 00 00 00 01).
function nalUnits(bytes) {
  const starts = [];
  for (let i = 0; i + 2 < bytes.length; i++) {
    if (bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 1) { starts.push(i + 3); i += 2; }
  }
  return starts.map((s, k) => {
    let end = k + 1 < starts.length ? starts[k + 1] - 3 : bytes.length;
    while (end > s && bytes[end - 1] === 0) end--;  // a four-byte start code leaves a zero behind the previous unit
    return bytes.subarray(s, end);
  });
}

// 3. Group them into frames: a new access unit starts at every delimiter (type 9).
const frames = [];
let sps = null;
let pps = null;
for (const nal of nalUnits(stream)) {
  const type = nal[0] & 0x1f;
  if (type === 9) { frames.push({ slices: [], key: false }); continue; }
  const frame = frames.at(-1);
  if (!frame) continue;
  if (type === 7) { if (sps && Buffer.compare(sps, nal)) throw new Error('the SPS changes mid-stream'); sps = Buffer.from(nal); }
  else if (type === 8) { if (pps && Buffer.compare(pps, nal)) throw new Error('the PPS changes mid-stream'); pps = Buffer.from(nal); }
  else if (type === 1 || type === 5) { frame.slices.push(nal); if (type === 5) frame.key = true; }
  // SEI (6) and anything else is left out: the decoder needs only slices and the parameter sets.
}
if (!sps || !pps) throw new Error('no SPS or PPS in the stream');
frames.forEach((f, i) => {
  if (!f.slices.length) throw new Error(`frame ${i} has no slices`);
  if (f.key !== (i % KEY_EVERY === 0)) throw new Error(`frame ${i} is ${f.key ? 'a keyframe' : 'not a keyframe'}; expected one every ${KEY_EVERY}`);
});

// 4. The avcC record (ISO 14496-15): version, profile, compatibility, level, four-byte lengths, one SPS, one PPS.
const avcC = Buffer.concat([
  Buffer.from([1, sps[1], sps[2], sps[3], 0xff, 0xe1]),
  Buffer.from([sps.length >> 8, sps.length & 0xff]), sps,
  Buffer.from([1, pps.length >> 8, pps.length & 0xff]), pps,
]);
const hex = (n) => n.toString(16).padStart(2, '0');
const codec = `avc1.${hex(sps[1])}${hex(sps[2])}${hex(sps[3])}`;

// 5. Each frame as AVCC: every slice behind its four-byte big-endian length.
const chunks = frames.map((f) => Buffer.concat(f.slices.flatMap((s) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(s.length);
  return [len, Buffer.from(s)];
})));

let offset = 0;
const index = chunks.map((c, i) => {
  const entry = { i, t: Math.round((i * 1e6) / FPS), ty: frames[i].key ? 'key' : 'delta', o: offset, l: c.length };
  offset += c.length;
  return entry;
});
const manifest = {
  codec, width: WIDTH, height: HEIGHT, fps: FPS, totalFrames: index.length, keyEvery: KEY_EVERY,
  description: avcC.toString('base64'),
  source: path.basename(SOURCE),
  frames: index,
};
const json = Buffer.from(JSON.stringify(manifest));
const pointer = Buffer.alloc(4);
pointer.writeUInt32LE(offset);
fs.writeFileSync(OUT, Buffer.concat([...chunks, json, pointer]));

const kb = (n) => `${Math.round(n / 1024)} KB`;
const keys = index.filter((f) => f.ty === 'key');
const avg = (list) => kb(list.reduce((s, f) => s + f.l, 0) / list.length);
console.log(`${path.relative(root, OUT)}: ${kb(offset + json.length + 4)} (${kb(offset)} of frames, ${kb(json.length)} manifest)`);
console.log(`${codec} · ${WIDTH} × ${HEIGHT} · ${FPS} fps · ${index.length} frames · ${keys.length} keyframes (one every ${KEY_EVERY}) · key ${avg(keys)}, delta ${avg(index.filter((f) => f.ty === 'delta'))}`);
