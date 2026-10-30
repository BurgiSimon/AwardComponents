#!/usr/bin/env node
// The showcase's first screens: each build's first viewport at 1440 × 900, encoded to WebP at 960 × 600 into
// public/builds/<id>-desktop.webp (committed, like public/frames/). `npm run sync-plugin` copies the frames the awards
// site already has; this captures the rest from the awards repository: it installs the build's own dependencies when
// they are missing (npm ci, inside that build's gitignored node_modules), runs its Vite build, serves dist/ and shoots
// the top of the page once it says it is ready.
// Usage: node scripts/builds.mjs [--awards <path>] [--only id,id] [--force]   (default: the builds without a frame)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { preview, build } from 'vite';
import { launch } from './lib/browser.mjs';
import { encodeWebp } from './lib/encode.mjs';
import { ROOT, onlyArg } from './lib/components.js';
import { BUILDS } from './data/builds.js';

const argv = process.argv.slice(2);
const argIndex = argv.indexOf('--awards');
const awards = path.resolve(ROOT, argIndex > -1 ? argv[argIndex + 1] : process.env.AWARDS_DIR || '../awards');
const only = onlyArg();
const force = argv.includes('--force');
const outDir = path.join(ROOT, 'public/builds');
fs.mkdirSync(outDir, { recursive: true });

const todo = BUILDS.filter((b) => {
  if (only) return only.includes(b.id);
  return force || !fs.existsSync(path.join(outDir, `${b.id}-desktop.webp`));
});
if (!todo.length) { console.log('every build has its frame; pass --force or --only to recapture'); process.exit(0); }

const browser = await launch();
const encoder = await (await browser.newContext()).newPage();
let failed = 0;
for (const b of todo) {
  const dir = path.join(awards, b.folder);
  if (!fs.existsSync(path.join(dir, 'package.json')) || !fs.existsSync(path.join(dir, 'vite.config.js'))) {
    console.error(`${b.id}: ${b.folder} is not a buildable project; its frame comes from the awards site (npm run sync-plugin)`);
    failed++;
    continue;
  }
  try {
    // Vite's build sets NODE_ENV=production in this process, which would make npm skip the build's dev dependencies.
    const { NODE_ENV: _env, ...env } = process.env;
    if (!fs.existsSync(path.join(dir, 'node_modules/vite'))) execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit', env });
    await build({ root: dir, logLevel: 'error', configFile: path.join(dir, 'vite.config.js') });
    const server = await preview({ root: dir, logLevel: 'error', configFile: path.join(dir, 'vite.config.js'), preview: { port: 0, host: '127.0.0.1' } });
    const url = server.resolvedUrls.local[0];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForFunction(() => !window.__awards || window.__awards.ready !== undefined, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => Promise.race([Promise.resolve(window.__awards?.ready), new Promise((r) => setTimeout(r, 8000))]));
    await page.waitForTimeout(2500);
    const png = await page.screenshot();
    const { buffer } = await encodeWebp(encoder, png, { width: 960, height: 600, quality: 0.86 });
    fs.writeFileSync(path.join(outDir, `${b.id}-desktop.webp`), buffer);
    console.log(`public/builds/${b.id}-desktop.webp  ${(buffer.length / 1024).toFixed(1)} KB`);
    await ctx.close();
    await new Promise((r) => server.httpServer.close(r));
  } catch (e) {
    console.error(`${b.id}: ${e.message}`);
    failed++;
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
