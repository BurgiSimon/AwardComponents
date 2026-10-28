#!/usr/bin/env node
// Draw public/og.png (1200 × 630): the wordmark, the line, and a tilted wall of captured frames.
// Run after frames change: node scripts/og.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './lib/browser.mjs';
import { ROOT, loadComponents } from './lib/components.js';

const comps = await loadComponents();
const frames = comps
  .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
  .map((c) => path.join(ROOT, 'public/frames', `${c.theme === 'dark' ? `${c.id}-dark` : `${c.id}-light`}-sm.webp`))
  .filter((f) => fs.existsSync(f))
  .slice(0, 16);
const font = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource-variable/mona-sans/files', file)).toString('base64')}`;
const img = (f) => `data:image/webp;base64,${fs.readFileSync(f).toString('base64')}`;
const cols = [[], [], [], []];
frames.forEach((f, i) => cols[i % 4].push(f));
const html = `<!doctype html><html><head><style>
@font-face { font-family: Mona; src: url(${font('mona-sans-latin-wdth-normal.woff2')}) format('woff2-variations'); font-weight: 200 900; font-stretch: 75% 125%; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: #f4f4f1; font-family: Mona; color: #121211; position: relative; }
.copy { position: absolute; left: 64px; top: 64px; bottom: 64px; width: 560px; display: flex; flex-direction: column; justify-content: space-between; z-index: 2; }
.brand { display: flex; align-items: center; gap: 12px; font-size: 26px; font-stretch: 112%; letter-spacing: -0.02em; }
.brand b { font-weight: 780; }
h1 { font-size: 104px; line-height: 0.88; font-weight: 820; font-stretch: 122%; letter-spacing: -0.05em; }
h1 em { font-style: normal; color: #f94c16; }
p { font-size: 22px; color: #474742; max-width: 30ch; line-height: 1.35; }
.wall { position: absolute; right: -80px; top: -120px; width: 680px; height: 900px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; transform: rotate(-6deg); }
.col { display: grid; gap: 14px; align-content: start; }
.col:nth-child(2n) { margin-top: 90px; }
.col img { width: 100%; aspect-ratio: 16 / 11; object-fit: cover; border-radius: 10px; border: 1px solid rgb(0 0 0 / 0.08); box-shadow: 0 10px 30px -12px rgb(0 0 0 / 0.3); }
.fade { position: absolute; inset: 0; background: linear-gradient(90deg, #f4f4f1 46%, rgb(244 244 241 / 0) 62%); z-index: 1; }
</style></head><body>
<div class="wall">${cols.map((c) => `<div class="col">${c.map((f) => `<img src="${img(f)}">`).join('')}</div>`).join('')}</div>
<div class="fade"></div>
<div class="copy">
  <div class="brand"><svg width="30" height="30" viewBox="0 0 24 24">${fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8').replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')}</svg><span>Award<b>Components</b></span></div>
  <h1>Pick it.<br>Tune it.<br><em>Prompt it.</em></h1>
  <p>${comps.length} award-league components with live controls and a prompt for the awards plugin.</p>
</div></body></html>`;
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(ROOT, 'public/og.png') });
await browser.close();
console.log(`public/og.png from ${frames.length} frames`);
