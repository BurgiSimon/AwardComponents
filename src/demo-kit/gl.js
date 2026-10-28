// WebGL feature checks with no library attached, so a demo can decide before it loads three.js or OGL.
// ?nogl in the play URL makes both report false, to see and smoke-test every demo's no-WebGL path.
// Each check probes once per page and releases its context at once: browsers keep about sixteen live contexts,
// and a probe left for the garbage collector on every re-mount would push out a demo's real one.
const forcedOff = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nogl');
const known = {};

function probe(kind) {
  try {
    const c = document.createElement('canvas');
    const gl = kind === 'webgl2' ? c.getContext('webgl2') : c.getContext('webgl2') || c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

export function webglAvailable() {
  if (forcedOff) return false;
  return (known.webgl ??= probe('webgl'));
}

export function webgl2Available() {
  if (forcedOff) return false;
  return (known.webgl2 ??= probe('webgl2'));
}
