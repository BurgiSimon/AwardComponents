// A one-time device probe → budgets (the awards quality-tiers recipe, condensed). Read it, never re-probe per frame.
//   low   DPR 1,   ~0.6 MP,  particles ×0.35
//   mid   DPR 1.5, ~1.6 MP,  particles ×0.7
//   high  DPR 2,   ~3.5 MP,  particles ×1
// The preview may force a tier with ?tier=low|mid|high (used by the Adaptive quality demo and the frame capture).
let cached = null;

export function qualityTier() {
  if (cached) return cached;
  const forced = new URLSearchParams(location.search).get('tier');
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 500;
  let name = 'high';
  if (cores <= 4 || memory <= 4 || (coarse && small)) name = 'mid';
  if (cores <= 2 || memory <= 2) name = 'low';
  if (forced === 'low' || forced === 'mid' || forced === 'high') name = forced;
  const table = {
    low: { dpr: 1, pixels: 0.6e6, particles: 0.35 },
    mid: { dpr: 1.5, pixels: 1.6e6, particles: 0.7 },
    high: { dpr: 2, pixels: 3.5e6, particles: 1 },
  };
  cached = { name, ...table[name], cores, memory, coarse };
  return cached;
}
