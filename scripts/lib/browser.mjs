// One way to get a Chromium for every script here (frames, smoke, media). Playwright is pinned in package.json;
// when its own browser build is not installed, fall back to AC_CHROMIUM or a preinstalled Chromium.
import fs from 'node:fs';
import { chromium } from 'playwright';

const FALLBACKS = [process.env.AC_CHROMIUM, '/opt/pw-browsers/chromium'].filter(Boolean);

export async function launch(options = {}) {
  const args = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', ...(options.args || [])];
  try {
    return await chromium.launch({ ...options, args });
  } catch (error) {
    const executablePath = FALLBACKS.find((p) => fs.existsSync(p));
    if (!executablePath || !/Executable doesn't exist/.test(String(error))) throw error;
    return chromium.launch({ ...options, args, executablePath });
  }
}
