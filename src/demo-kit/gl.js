// WebGL feature checks with no library attached, so a demo can decide before it loads three.js or OGL.
// ?nogl in the play URL makes both report false, to see and smoke-test every demo's no-WebGL path.
const forcedOff = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nogl');

export function webglAvailable() {
  if (forcedOff) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function webgl2Available() {
  if (forcedOff) return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
