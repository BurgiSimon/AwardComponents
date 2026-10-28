#!/usr/bin/env node
// Screenshot one demo (or any URL) for a visual check while authoring.
// Usage: node scripts/shot.mjs <id|url> [--out .ac/shots/<id>.png] [--size 1280x800] [--theme light|dark]
//        [--params "speed=120&pause=0"] [--scroll 0.5] [--pointer 0.7,0.4] [--action id] [--wait 900] [--reduced] [--full]
//        [--steps "scroll:0.5,wait:400,action:open,pointer:0.6:0.4,hover:.selector,click:.selector,key:Escape"]
// --params sets control values (as in a shared link); --steps runs in order and replaces scroll/pointer/action.
// Sizes worth checking: 1280x800 (the frame and a new tab), 800x620 (the preview beside the controls), 390x844 (phone).
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './lib/browser.mjs';
import { startServer } from './lib/server.js';
import { ROOT } from './lib/components.js';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const target = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!target) { console.error('usage: node scripts/shot.mjs <id|url> [--size 1280x800] [--theme dark] [--scroll 0.5] [--out file]'); process.exit(1); }
const [w, h] = flag('size', '1280x800').split('x').map(Number);
const theme = flag('theme', 'light');
const isUrl = /^https?:/.test(target);
const server = isUrl ? null : await startServer();
const params = flag('params', '');
const url = isUrl ? target : `${server.url}/play.html?c=${target}&embed=1&theme=${theme}${params ? `&${params.replace(/^[?&]/, '')}` : ''}`;
const out = path.resolve(ROOT, flag('out', `.ac/shots/${isUrl ? 'page' : target}-${theme}-${w}x${h}${argv.includes('--scroll') ? `-s${flag('scroll')}` : ''}.png`));
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, reducedMotion: argv.includes('--reduced') ? 'reduce' : 'no-preference', hasTouch: w < 500, isMobile: w < 500 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).split('\n')[0]}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().split('\n')[0]}`); });
await page.goto(url, { waitUntil: 'load', timeout: 45000 });
if (!isUrl) await page.waitForFunction(() => window.__ac?.ready, null, { timeout: 30000 }).then(() => page.evaluate(() => window.__ac.ready));
const steps = argv.includes('--steps')
  ? flag('steps').split(',').map((s) => s.trim()).filter(Boolean)
  : [
      ...(argv.includes('--scroll') ? [`scroll:${flag('scroll')}`] : []),
      ...(argv.includes('--pointer') ? [`pointer:${flag('pointer').replace(',', ':')}`] : []),
      ...(argv.includes('--action') ? [`action:${flag('action')}`] : []),
    ];
for (const step of steps) {
  const [kind, ...rest] = step.split(':');
  const arg = rest.join(':');
  if (kind === 'scroll') await page.evaluate((p) => window.__ac.scrollTo(p), Number(arg));
  else if (kind === 'wait') await page.waitForTimeout(Number(arg));
  else if (kind === 'action') await page.evaluate((a) => window.__ac.action(a), arg);
  else if (kind === 'pointer') {
    const [px, py] = arg.split(':').map(Number);
    await page.mouse.move(w / 2, h / 2);
    await page.mouse.move(px * w, py * h, { steps: 12 });
  } else if (kind === 'hover') await page.hover(arg, { timeout: 4000 });
  else if (kind === 'click') await page.click(arg, { timeout: 4000 });
  else if (kind === 'key') await page.keyboard.press(arg);
  else throw new Error(`unknown step "${step}"`);
}
await page.waitForTimeout(Number(flag('wait', 900)));
await page.screenshot({ path: out, fullPage: argv.includes('--full') });
await browser.close();
await server?.close();
console.log(out);
if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
