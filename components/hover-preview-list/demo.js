// Hover preview list — Halden's archive as a ruled list, on its own. Hovering a row brings up its picture in a preview that
// chases the pointer (lerp .25 per 60 fps frame through damp(), so the same at 60 and 144 Hz) and leans with the
// lag; moving between rows cross-fades the picture instead of hiding it. Keyboard focus shows the same preview,
// anchored beside the row. The loop runs only while the preview is out. Coarse pointers: a plain list with thumbs.
import './demo.css';
import { on, onFrame, damp, clamp, finePointer, html, raw, photos, imageHTML, content } from '../../src/demo-kit/index.js';

const k = (lerp) => -Math.log(1 - lerp) * 60;
const TAGS = { Architecture: 'architecture', Interiors: 'interior', Landscape: 'landscape', Furniture: 'furniture' };

export default function mount(root, options, ctx) {
  const { studio } = content;
  const projects = studio.projects;
  const pics = projects.map((p) => photos({ tags: [TAGS[p.discipline] || 'architecture'], count: 1, seed: `hp-${p.slug}` })[0]);
  let cfg = { ...options };

  root.className = 'hp';
  root.innerHTML = html`
    <section class="ac-stage hp__stage" aria-labelledby="hp-list">
      <div class="hp__archive">
        <h2 class="sr-only" id="hp-list">${studio.name} archive</h2>
        <div class="hp__cols ac-label" aria-hidden="true"><span>Project</span><span>Place</span><span>Year</span><span>Discipline</span></div>
        <ul class="hp__rows" role="list" data-rows>
          ${projects.map((p, i) => html`
            <li><a class="hp__row" href="#${p.slug}" data-row="${i}">
              <span class="hp__thumb" aria-hidden="true">${raw(imageHTML(pics[i], { sizes: '64px', alt: '' }))}</span>
              <span class="hp__name">${p.title}</span>
              <span class="hp__place">${p.place}</span>
              <span class="hp__year ac-num">${p.year}</span>
              <span class="hp__disc">${p.discipline}</span>
            </a></li>`)}
        </ul>
      </div>
      <p class="ac-stage__note"><span>${studio.name} · project archive</span></p>
    </section>
    <div class="hp__preview" aria-hidden="true" data-preview><div class="hp__frame">${pics.map((p) => raw(imageHTML(p, { sizes: '32vw', alt: '' })))}</div></div>`;
  root.querySelectorAll('a[href^="#"]').forEach((a) => on(ctx, a, 'click', (e) => e.preventDefault()));

  const list = root.querySelector('[data-rows]');
  const rows = [...root.querySelectorAll('[data-row]')];
  const preview = root.querySelector('[data-preview]');
  const imgs = [...preview.querySelectorAll('img')];
  const full = ctx.motion === 'full';
  const target = { x: 0, y: 0 };
  const pos = { x: 0, y: 0 };
  let rot = 0;
  let visible = false;
  let mode = 'none';
  let stop = null;

  const apply = () => {
    root.style.setProperty('--pw', `${cfg.size}vw`);
    root.dataset.shape = cfg.shape;
  };
  apply();

  const draw = () => {
    preview.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
  };
  // The chase: damp toward the pointer, lean with the lag; sleeps once hidden and settled.
  const frame = (dt) => {
    const d = full ? dt : 1;
    pos.x = damp(pos.x, target.x, k(cfg.lerp), d);
    pos.y = damp(pos.y, target.y, k(cfg.lerp), d);
    const lean = full ? clamp((target.x - pos.x) * 0.08, -cfg.rotate, cfg.rotate) : 0;
    rot = damp(rot, lean, 10, d);
    draw();
    const still = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) + Math.abs(rot) < 0.1;
    if (still && (!visible || mode === 'keyboard')) { stop?.(); stop = null; }
  };
  const wake = () => { if (!stop) stop = onFrame(ctx, frame); };

  const setActive = (i) => imgs.forEach((img, n) => img.classList.toggle('is-active', n === i));
  const show = (i, how) => {
    setActive(i);
    if (!visible) preview.classList.add('is-visible');
    visible = true;
    mode = how;
    preview.classList.toggle('is-anchored', how === 'keyboard');
    if (how === 'keyboard') {
      // No pointer to follow: sit in the open space between the row's title and its place, centred on the row.
      const r = rows[i].getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(rows[i].querySelector('.hp__name'));
      const name = range.getBoundingClientRect(); // the text's own box, not its grid cell
      const place = rows[i].querySelector('.hp__place').getBoundingClientRect();
      const w = preview.offsetWidth;
      target.x = pos.x = clamp((name.right + place.left) / 2, w / 2 + 16, innerWidth - w / 2 - 16);
      target.y = pos.y = r.top + r.height / 2;
      rot = 0;
      draw();
    } else wake();
  };
  const hide = () => {
    visible = false;
    mode = 'none';
    preview.classList.remove('is-visible', 'is-anchored');
  };

  if (finePointer()) {
    rows.forEach((row, i) => {
      on(ctx, row, 'pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        target.x = e.clientX;
        target.y = e.clientY;
        if (!visible) { pos.x = target.x; pos.y = target.y; rot = 0; } // appear at the pointer, not fly in from elsewhere
        show(i, 'pointer');
      });
    });
    on(ctx, list, 'pointermove', (e) => { if (e.pointerType !== 'mouse') return; target.x = e.clientX; target.y = e.clientY; if (visible) wake(); }, { passive: true });
    on(ctx, list, 'pointerleave', () => { if (mode === 'pointer') hide(); });
    on(ctx, window, 'scroll', () => { if (mode === 'pointer') hide(); }, { passive: true });
  }
  // Keyboard: the same preview, anchored; hidden when focus leaves the list.
  rows.forEach((row, i) => on(ctx, row, 'focus', () => { if (row.matches(':focus-visible')) show(i, 'keyboard'); }));
  on(ctx, list, 'focusout', (e) => { if (!list.contains(e.relatedTarget) && mode === 'keyboard') hide(); });

  return {
    update(next) {
      cfg = { ...next };
      apply();
    },
  };
}
