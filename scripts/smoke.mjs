#!/usr/bin/env node
// Run every demo in headless Chromium (SwiftShader WebGL) and fail on anything a visitor would hit: a page error,
// a console error, a mount that never says ready, an option change or action that throws, a broken reduced-motion
// or phone path, or a phone layout that scrolls sideways.
// Usage: node scripts/smoke.mjs [--only id,id] [--dist] [--json] [--keep-going]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './lib/browser.mjs';
import { startServer } from './lib/server.js';
import { componentIds, loadMeta, onlyArg, ROOT } from './lib/components.js';
import { normaliseOptions } from '../src/registry/options.js';

const argv = process.argv.slice(2);
const only = onlyArg();
const asJson = argv.includes('--json');
const ids = componentIds().filter((id) => !only || only.includes(id));
const IGNORE = [/Download the React DevTools/, /GPU stall due to ReadPixels/, /WebGL: INVALID_OPERATION: texImage/, /\[\.WebGL-[^\]]+\]/, /Automatic fallback to software WebGL/, /favicon\.ico/];

function alternate(control) {
  switch (control.type) {
    case 'range': return control.default === control.max ? control.min : control.max;
    case 'toggle': return !control.default;
    case 'select': { const o = normaliseOptions(control); return (o.find((x) => x.value !== control.default) || o[0]).value; }
    case 'color': return control.default === 'moss' ? 'plum' : 'moss';
    case 'text': return 'A longer line of text to test wrapping and overflow';
    default: return control.default;
  }
}

const server = await startServer({ dist: argv.includes('--dist') });
const browser = await launch();
const report = [];

async function run(id, meta) {
  const problems = [];
  const notes = [];
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 800 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', colorScheme: opts.theme || 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${String(e.message).split('\n')[0]}`));
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errs.push(`console: ${m.text().split('\n')[0]}`); });
    const url = `${server.url}/play.html?c=${id}&embed=1&theme=${opts.theme || 'light'}`;
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    const ok = await page.waitForFunction(() => window.__ac && window.__ac.ready, null, { timeout: 30000 }).then(() => page.evaluate(() => Promise.race([window.__ac.ready, new Promise((r) => setTimeout(() => r('timeout'), 25000))]))).catch((e) => `error ${e.message}`);
    return { ctx, page, errs, ok };
  };
  const label = (s) => (e) => problems.push(`${s}: ${String(e).split('\n')[0]}`);

  // 1. Desktop, light: mount, overflow, options, remount, actions, scroll.
  {
    const { ctx, page, errs, ok } = await open();
    if (ok !== true) problems.push(`desktop: not ready (${ok})`);
    const state = await page.evaluate(() => ({ mounted: window.__ac.mounted, children: document.getElementById('ac-root').childElementCount, sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, h: innerHeight }));
    if (!state.mounted || !state.children) problems.push('desktop: root is empty after mount');
    if (state.sw > state.w + 1) notes.push(`desktop scrolls sideways (${state.sw} > ${state.w})`);
    await page.waitForTimeout(700);
    const alt = Object.fromEntries((meta.controls || []).map((c) => [c.id, alternate(c)]));
    if (Object.keys(alt).length) {
      await page.evaluate((v) => window.__ac.setOptions(v), alt).catch(label('options'));
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => window.__ac.mounted);
      if (!m) problems.push('options: demo not mounted after changing every control');
      const defaults = Object.fromEntries((meta.controls || []).map((c) => [c.id, c.default]));
      await page.evaluate((v) => window.__ac.setOptions(v), defaults).catch(label('options reset'));
      await page.waitForTimeout(300);
    }
    for (const a of meta.actions || []) {
      await page.evaluate((n) => window.__ac.action(n), a.id).catch(label(`action ${a.id}`));
      await page.waitForTimeout(500);
    }
    if (state.sh > state.h + 10) {
      for (const p of [0.33, 0.66, 1, 0]) { await page.evaluate((x) => window.__ac.scrollTo(x), p).catch(label('scroll')); await page.waitForTimeout(250); }
    }
    await page.mouse.move(640, 400);
    await page.mouse.move(700, 420, { steps: 6 });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__ac.remount()).catch(label('remount'));
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ mounted: window.__ac.mounted, children: document.getElementById('ac-root').childElementCount }));
    if (!after.mounted || !after.children) problems.push('remount: root is empty');
    problems.push(...errs.map((e) => `desktop ${e}`));
    await ctx.close();
  }
  // 2. Reduced motion.
  {
    const { ctx, page, errs, ok } = await open({ reduced: true });
    if (ok !== true) problems.push(`reduced: not ready (${ok})`);
    const motion = await page.evaluate(() => document.documentElement.dataset.motion);
    if (motion !== 'reduced') problems.push(`reduced: data-motion is "${motion}"`);
    await page.waitForTimeout(400);
    problems.push(...errs.map((e) => `reduced ${e}`));
    await ctx.close();
  }
  // 3. Phone, dark, touch.
  {
    const { ctx, page, errs, ok } = await open({ viewport: { width: 390, height: 844 }, theme: 'dark', touch: true });
    if (ok !== true) problems.push(`phone: not ready (${ok})`);
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
    if (st.sw > st.w + 1) problems.push(`phone: page scrolls sideways (${st.sw}px wide in a ${st.w}px viewport)`);
    problems.push(...errs.map((e) => `phone ${e}`));
    await ctx.close();
  }
  return { problems: [...new Set(problems)], notes };
}

let failed = 0;
for (const id of ids) {
  const t0 = Date.now();
  let meta;
  try { meta = await loadMeta(id); } catch (e) { report.push({ id, ok: false, problems: [`meta: ${e.message}`] }); failed++; continue; }
  let r;
  try { r = await run(id, meta); } catch (e) { r = { problems: [`crashed: ${e.message.split('\n')[0]}`], notes: [] }; }
  const ok = r.problems.length === 0;
  if (!ok) failed++;
  report.push({ id, ok, ms: Date.now() - t0, problems: r.problems, notes: r.notes });
  if (!asJson) {
    console.log(`${ok ? '✓' : '✗'} ${id} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    for (const p of r.problems) console.log(`    ✗ ${p}`);
    for (const n of r.notes) console.log(`    · ${n}`);
  }
}
await browser.close();
await server.close();
fs.mkdirSync(path.join(ROOT, '.ac'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.ac/smoke.json'), JSON.stringify(report, null, 2));
if (asJson) console.log(JSON.stringify(report, null, 2));
else console.log(`\n${ids.length - failed} of ${ids.length} passed. Report: .ac/smoke.json`);
process.exit(failed ? 1 : 0);
