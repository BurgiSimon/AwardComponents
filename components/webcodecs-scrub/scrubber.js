// The film's two engines. Both take `seek(i)` from the scroll and call `draw(source, i, crop)` when frame i is ready;
// the newest request always wins.
//
// FrameScrubber: one packed file (pack.mjs) decoded with WebCodecs. A request decodes exactly the frame it names: from
// the keyframe at or before it on a jump, straight on from the decoder's own position when the target is ahead in the
// same group, one decode for the next frame. While a run decodes, newer requests wait and only the newest runs next,
// so a fast scroll never resets the decoder. Every frame decoded on the way is kept as a bitmap at the drawn width (a
// bounded cache, oldest out first), so scrubbing back through it costs no decode. Every VideoFrame is closed.
//
// VideoScrubber: the fallback without WebCodecs or the codec. A <video> seeked by currentTime: lighter to build, not
// frame-exact (a seek lands on what the media stack decodes in time, and seeks queue behind each other).

const fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// The packed file: chunks, then the manifest, then a four-byte little-endian offset of the manifest. Views, no copies.
export function readPack(buffer) {
  const view = new DataView(buffer);
  const at = view.getUint32(buffer.byteLength - 4, true);
  const clip = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, at, buffer.byteLength - 4 - at)));
  for (const f of clip.frames) f.data = new Uint8Array(buffer, f.o, f.l);
  clip.descriptionBytes = clip.description ? fromBase64(clip.description) : null;
  clip.bytes = buffer.byteLength;
  return clip;
}

// The first decoder configuration this browser accepts for the clip, or null (no WebCodecs, or not this codec).
export async function decoderConfig(clip) {
  if (typeof window.VideoDecoder !== 'function' || typeof window.EncodedVideoChunk !== 'function') return null;
  const base = { codec: clip.codec, codedWidth: clip.width, codedHeight: clip.height, ...(clip.descriptionBytes ? { description: clip.descriptionBytes } : {}) };
  for (const config of [{ ...base, hardwareAcceleration: 'prefer-hardware', optimizeForLatency: true }, { ...base, optimizeForLatency: true }, base]) {
    try { if ((await VideoDecoder.isConfigSupported(config)).supported) return config; } catch { /* an unknown string throws in some engines */ }
  }
  return null;
}

export class FrameScrubber {
  #clip;
  #config;
  #decoder = null;
  #draw;
  #onError;
  #onChange;
  #cache = new Map();          // frame index → ImageBitmap, least recently used first
  #cacheSize;
  #bitmapWidth;
  #keyFor;                     // frame index → the keyframe a seek to it starts from
  #run = 0;
  #timer = 0;
  #keyNext = false;            // after a flush the decoder takes a keyframe first
  #closed = false;
  #asked = null;

  decoderAt = null;            // the last frame the decoder put out: where a delta can continue from
  shown = null;
  target = null;
  pending = null;
  busy = false;
  stats = { requests: 0, decodes: 0, keySeeks: 0, continued: 0, sequential: 0, cacheHits: 0, superseded: 0, stalls: 0, openFrames: 0 };

  constructor(clip, config, { draw, cacheSize = clip.keyEvery + 2, bitmapWidth = clip.width, onError, onChange } = {}) {
    this.#clip = clip;
    this.#config = config;
    this.#draw = draw;
    this.#onError = onError;
    this.#onChange = onChange;
    this.#cacheSize = Math.max(0, Math.round(cacheSize));
    this.#bitmapWidth = this.#width(bitmapWidth);
    let key = 0;
    this.#keyFor = clip.frames.map((f) => (f.ty === 'key' ? (key = f.i) : key));
    this.#decoder = new VideoDecoder({
      output: (frame) => this.#output(frame),
      error: (e) => this.#fail(e),
    });
    this.#decoder.configure(config);
  }

  get total() { return this.#clip.totalFrames; }
  get cached() { return this.#cache.size; }
  get cacheSize() { return this.#cacheSize; }
  get bitmapWidth() { return this.#bitmapWidth; }

  #width(w) {
    const r = Math.round(w);
    return r >= 1 ? Math.min(this.#clip.width, r) : this.#clip.width;   // a hidden canvas has no width yet
  }

  #fail(e) {
    if (this.#closed) return;
    this.busy = false;
    this.decoderAt = null;
    this.#onError?.(e);
  }

  // Ask for a frame. A request made while a run decodes waits; only the newest waiting request runs.
  seek(index) {
    if (this.#closed) return;
    const i = Math.max(0, Math.min(this.total - 1, Math.round(index)));
    if (i !== this.#asked) { this.#asked = i; this.stats.requests++; }
    if (this.busy) {
      if (this.pending !== null && this.pending !== i) this.stats.superseded++;
      this.pending = i;
      this.#onChange?.();
      return;
    }
    this.#start(i);
  }

  #start(t) {
    this.pending = null;
    if (t === this.shown) return;
    const hit = this.#cache.get(t);
    if (hit) {
      this.#cache.delete(t);
      this.#cache.set(t, hit);
      this.shown = t;
      this.stats.cacheHits++;
      this.#draw(hit, t);
      this.#onChange?.();
      return;
    }
    // Continue from where the decoder is when the target lies ahead of it in the same group of pictures; otherwise
    // (a jump back, another group, or right after a flush) start at the keyframe at or before the target.
    const key = this.#keyFor[t];
    const at = this.#keyNext ? null : this.decoderAt;
    const onward = at !== null && t > at && key <= at;
    const from = onward ? at + 1 : key;
    const next = at !== null && from === at + 1;    // picks up where the decoder stopped (a keyframe there counts too)
    if (next && t === from) this.stats.sequential++;
    else if (next) this.stats.continued++;
    else this.stats.keySeeks++;
    this.#keyNext = false;
    this.busy = true;
    this.target = t;
    const run = ++this.#run;
    try {
      const frames = this.#clip.frames;
      for (let i = from; i <= t; i++) {
        const f = frames[i];
        this.#decoder.decode(new EncodedVideoChunk({ type: f.ty, timestamp: f.t, data: f.data }));
        this.stats.decodes++;
      }
    } catch (e) {
      this.#fail(e);     // closed or unconfigured: hand over rather than stay busy
      return;
    }
    this.#onChange?.();
    // The watchdog: a decoder that holds its output back would leave the run busy for ever. After 1 s, flush (which
    // pushes out whatever it holds; the next run must then start from a keyframe); if even that brings no frame,
    // reset, configure again and run the newest request.
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      if (!this.busy || run !== this.#run || this.#closed) return;
      this.stats.stalls++;
      this.#keyNext = true;
      this.#decoder.flush().catch(() => {}).then(() => {
        if (!this.busy || run !== this.#run || this.#closed) return;
        try {
          this.#decoder.reset();
          this.#decoder.configure(this.#config);
        } catch (e) { this.#fail(e); return; }
        this.decoderAt = null;
        this.busy = false;
        this.#start(this.pending ?? t);
      });
    }, 1000);
  }

  #output(frame) {
    this.stats.openFrames++;
    const close = () => { frame.close(); this.stats.openFrames--; };
    if (this.#closed) { close(); return; }
    const i = Math.round((frame.timestamp * this.#clip.fps) / 1e6);
    this.decoderAt = i;
    if (this.busy && i === this.target) {
      this.busy = false;
      clearTimeout(this.#timer);
      this.shown = i;
      this.#draw(frame, i);
    }
    // Shown or passed on the way, the frame goes into the cache as a bitmap at the drawn width.
    if (this.#cacheSize > 0) {
      const w = this.#bitmapWidth;
      const h = Math.round((w * frame.displayHeight) / frame.displayWidth);
      createImageBitmap(frame, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' })
        .then((bmp) => {
          // Torn down, or resized while the bitmap was made (it would be drawn at the wrong width): let it go.
          if (this.#closed || bmp.width !== this.#bitmapWidth) bmp.close();
          else this.#remember(i, bmp);
        })
        .catch(() => {})
        .finally(close);
    } else {
      close();
    }
    if (!this.busy && this.pending !== null) this.#start(this.pending);
    this.#onChange?.();
  }

  #remember(i, bmp) {
    this.#cache.get(i)?.close();
    this.#cache.delete(i);
    this.#cache.set(i, bmp);
    this.#trim();
    this.#onChange?.();
  }

  #trim() {
    while (this.#cache.size > this.#cacheSize) {
      const [oldest, bmp] = this.#cache.entries().next().value;
      bmp.close();
      this.#cache.delete(oldest);
    }
  }

  setCacheSize(n) {
    this.#cacheSize = Math.max(0, Math.round(n));
    this.#trim();
    this.#onChange?.();
  }

  // The drawn width changed: cache at the new width from now on and drop what was kept at the old one.
  resize(width) {
    const w = this.#width(width);
    if (w === this.#bitmapWidth) return;
    this.#bitmapWidth = w;
    for (const bmp of this.#cache.values()) bmp.close();
    this.#cache.clear();
  }

  // Draw the current frame again (a resize cleared the canvas). A run in flight draws its own target when it lands.
  refresh() {
    const t = this.shown;
    this.shown = null;
    if (t !== null && !this.busy) this.#start(t);
  }

  destroy() {
    this.#closed = true;
    this.#run++;
    clearTimeout(this.#timer);
    try { this.#decoder?.close(); } catch { /* already closed after an error */ }
    for (const bmp of this.#cache.values()) bmp.close();
    this.#cache.clear();
    this.busy = false;
  }
}

// The fallback: the same footage as a <video>, seeked by currentTime and drawn to the same canvas on `seeked`. `crop`
// is the picture inside the video's own frame (the shared WebM carries black bars above and below).
export class VideoScrubber {
  #video;
  #draw;
  #onChange;
  #crop;
  #fps;
  #asked = null;
  #closed = false;
  #ready;
  #timer = 0;

  shown = null;
  target = null;
  pending = null;
  busy = false;
  total;
  stats = { requests: 0, seeks: 0, superseded: 0 };

  constructor(video, { fps, total, bars = 0, draw, onChange, onError, signal }) {
    this.#video = video;
    this.#draw = draw;
    this.#onChange = onChange;
    this.#fps = fps;
    this.total = total;
    const opts = { signal };
    this.#ready = new Promise((resolve, reject) => {
      const done = () => {
        const vw = video.videoWidth, vh = video.videoHeight;
        const b = Math.round((bars / 480) * vh);
        this.#crop = { sx: 0, sy: b, sw: vw, sh: vh - 2 * b };
        resolve();
      };
      if (video.readyState >= 2) done();
      else {
        video.addEventListener('loadeddata', done, { ...opts, once: true });
        video.addEventListener('error', () => reject(new Error('the video could not load')), { ...opts, once: true });
      }
    });
    this.#ready.then(() => this.#next(), (e) => { if (!this.#closed) onError?.(e); });
    video.addEventListener('seeked', () => this.#landed(), opts);
  }

  get ready() { return this.#ready; }

  seek(index) {
    if (this.#closed) return;
    const i = Math.max(0, Math.min(this.total - 1, Math.round(index)));
    if (i !== this.#asked) { this.#asked = i; this.stats.requests++; }
    if (this.busy || !this.#crop) {
      if (this.pending !== null && this.pending !== i) this.stats.superseded++;
      this.pending = i;
      this.#onChange?.();
      return;
    }
    this.#go(i);
  }

  #go(i) {
    this.pending = null;
    if (i === this.shown) return;
    this.busy = true;
    this.target = i;
    this.stats.seeks++;
    // The middle of frame i's interval, so rounding in the media stack cannot land on its neighbour.
    this.#video.currentTime = (i + 0.5) / this.#fps;
    this.#onChange?.();
    // A seek that never reports back must not hold the queue: after 1 s, run the newest request anyway.
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { if (this.busy && !this.#closed) { this.busy = false; this.#next(); } }, 1000);
  }

  #landed() {
    if (this.#closed || !this.busy) return;
    clearTimeout(this.#timer);
    this.busy = false;
    this.shown = this.target;
    this.#draw(this.#video, this.target, this.#crop);
    this.#next();
  }

  #next() {
    if (!this.busy && this.pending !== null && this.#crop) this.#go(this.pending);
    this.#onChange?.();
  }

  refresh() {
    if (this.shown !== null && !this.busy && this.#crop) this.#draw(this.#video, this.shown, this.#crop);
  }

  destroy() {
    this.#closed = true;
    clearTimeout(this.#timer);
    this.#video.removeAttribute('src');
    this.#video.load();
  }
}
