// The one generated clip: wind-driven sleet, light on pure black (black is the weave's key), drawn in code so the
// demo ships no extra footage. Deterministic in t, so a still at a fixed time is the same still on every run.
// `version` changes only when a new frame is drawn: that is what the compositor's upload check reads.

const SIZE = [480, 270];
const FLAKES = 170;
const WIND = 0.42; // sideways drift per unit of fall

export function createSleet(fps = 24) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = SIZE;
  const g = canvas.getContext('2d');
  const [w, h] = SIZE;
  let version = 0;
  let last = -1;
  function draw(t) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let i = 0; i < FLAKES; i++) {
      const r1 = Math.sin(i * 91.7) * 0.5 + 0.5;
      const r2 = Math.sin(i * 17.3) * 0.5 + 0.5;
      const r3 = Math.sin(i * 5.9) * 0.5 + 0.5;
      const speed = 0.16 + 0.22 * r2; // screen heights per second
      const fall = (t * speed + Math.sin(i * 3.1) * 0.5 + 0.5) % 1;
      const y = fall * (h + 40) - 20;
      const x = ((r1 + fall * WIND + Math.sin(t * 0.7 + i) * 0.01) % 1) * w;
      const len = 4 + 10 * r2;
      const tone = 175 + Math.round(80 * r3);
      g.strokeStyle = `rgb(${tone},${tone},${tone})`;
      g.lineWidth = 1.6 + 2.6 * r3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - len * WIND, y - len);
      g.stroke();
    }
  }
  const clip = {
    canvas,
    // Draw the frame for time t (seconds); repeated calls inside one frame period are free.
    at(t) {
      const frame = Math.floor(t * fps);
      if (frame === last) return false;
      last = frame;
      draw(frame / fps);
      version++;
      return true;
    },
    version: () => version,
  };
  clip.at(6.4);
  return clip;
}
