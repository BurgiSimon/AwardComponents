#!/usr/bin/env node
// Capture each component's preview frame in both themes: play.html?capture=1 at 1280 × 800, encoded to WebP at
// 960 × 600 (cards, hover preview, poster) and 480 × 300 (sidebar, palette, wall) into public/frames/.
// meta.preview.capture tunes the moment: { wait: ms, scroll: 0–1, pointer: [x, y] (0–1 of the viewport),
// hover: 'selector', action: 'action id', tier: 'high' }.
// Usage: node scripts/frames.mjs [--only id,id] [--missing] [--theme light|dark] [--dist]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './lib/browser.mjs';
import { encodeWebp } from './lib/encode.mjs';
import { startServer } from './lib/server.js';
import { componentIds, loadMeta, onlyArg, ROOT } from './lib/components.js';

const argv = process.argv.slice(2);
const only = onlyArg();
const missingOnly = argv.includes('--missing');
const themeArg = argv.includes('--theme') ? argv[argv.indexOf('--theme') + 1] : null;
const out = path.join(ROOT, 'public/frames');
fs.mkdirSync(out, { recursive: true });

const server = await startServer({ dist: argv.includes('--dist') });
const browser = await launch();
const encoder = await (await browser.newContext()).newPage();
let count = 0;
const failures = [];

for (const id of componentIds().filter((x) => !only || only.includes(x))) {
  const meta = await loadMeta(id);
  const themes = meta.theme === 'dark' || meta.theme === 'light' ? [meta.theme] : ['light', 'dark'];
  for (const theme of themes) {
    if (themeArg && theme !== themeArg) continue;
    const md = path.join(out, `${id}-${theme}.webp`);
    const sm = path.join(out, `${id}-${theme}-sm.webp`);
    if (missingOnly && fs.existsSync(md) && fs.existsSync(sm)) continue;
    const cap = meta.preview?.capture || {};
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: theme });
    const page = await ctx.newPage();
    try {
      const tier = cap.tier ? `&tier=${cap.tier}` : '';
      await page.goto(`${server.url}/play.html?c=${id}&embed=1&capture=1&theme=${theme}${tier}`, { waitUntil: 'load', timeout: 45000 });
      await page.waitForFunction(() => window.__ac?.ready, null, { timeout: 30000 });
      const ready = await page.evaluate(() => window.__ac.ready);
      if (ready !== true) throw new Error(`demo did not mount: ${await page.evaluate(() => window.__ac.error)}`);
      if (cap.scroll) await page.evaluate((p) => window.__ac.scrollTo(p), cap.scroll);
      if (cap.pointer) {
        await page.mouse.move(640, 400);
        await page.mouse.move(cap.pointer[0] * 1280, cap.pointer[1] * 800, { steps: 12 });
      }
      if (cap.hover) await page.hover(cap.hover, { timeout: 4000 }).catch(() => {});
      if (cap.action) await page.evaluate((a) => window.__ac.action(a), cap.action);
      await page.waitForTimeout(cap.wait ?? 900);
      const png = await page.screenshot({ type: 'png' });
      fs.writeFileSync(md, (await encodeWebp(encoder, png, { width: 960, quality: 0.8 })).buffer);
      fs.writeFileSync(sm, (await encodeWebp(encoder, png, { width: 480, quality: 0.78 })).buffer);
      count++;
      console.log(`✓ ${id} ${theme}`);
    } catch (e) {
      failures.push(`${id} ${theme}: ${e.message.split('\n')[0]}`);
      console.log(`✗ ${id} ${theme}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}
await browser.close();
await server.close();
console.log(`${count} frame pair${count === 1 ? '' : 's'} written to public/frames${failures.length ? `; ${failures.length} failed` : ''}.`);
process.exit(failures.length ? 1 : 0);
