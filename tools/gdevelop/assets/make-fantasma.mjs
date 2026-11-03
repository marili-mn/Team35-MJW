// The dark-energy wraiths (new enemy), drawn by code like the audio, in the game's pixel-art style: a
// 64x64 drawing scaled x2 with no smoothing. An original hooded wraith: a tall hood with a black void
// for a face, a black robe torn into strips that stream behind it as it glides, bony grey hands
// reaching forward, and a cold violet aura. It faces right (the game mirrors it). 6 frames of a loop:
// the strips wave, the hood bobs, the fingers flex.
//   node tools/gdevelop/assets/make-fantasma.mjs   ->   GravityRunnerDash/assets/fantasma/fantasma_<0..5>.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePng } from "../lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "..", "..", "GravityRunnerDash", "assets", "fantasma");
const S = 64, SCALE = 2, FRAMES = 6;
const ROBE = [13, 11, 18], FOLD = [32, 28, 42], EDGE = [84, 72, 108], VOID = [0, 0, 0], VOID_RIM = [118, 108, 160];
const BONE = [184, 178, 196], BONE_DARK = [96, 90, 110], AURA = [140, 120, 255], WISP = [120, 150, 255];
const AURA_ALPHA = [0, 115, 55, 20];

fs.mkdirSync(OUT, { recursive: true });

for (let f = 0; f < FRAMES; f++) {
  const ph = (f / FRAMES) * Math.PI * 2;
  const bob = Math.round(1.5 * Math.sin(ph));
  const hy = 17 + bob;                                  // hood center
  const robe = new Set(), bone = new Set();
  const key = (x, y) => y * S + x;
  const put = (set, x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < S && y < S) set.add(key(x, y)); };
  const stroke = (set, x0, y0, x1, y1, w0, w1) => {          // a tapering line
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, w = w0 + (w1 - w0) * t;
      for (let dy = -w; dy <= w; dy += 0.5) for (let dx = -w; dx <= w; dx += 0.5) if (dx * dx + dy * dy <= w * w) put(set, x + dx, y + dy);
    }
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Hood: an ellipse leaning forward with its tip folded back.
      if ((x - 34) ** 2 / 81 + (y - hy) ** 2 / 121 <= 1) robe.add(key(x, y));
      if (y >= hy - 15 && y < hy - 4 && x >= 24 + (y - (hy - 15)) * 0.2 && x <= 30 + (y - (hy - 15)) * 0.6) robe.add(key(x, y));
      // Torso, leaning forward.
      if (y >= hy + 8 && y < 44) {
        const cx = 33 - (y - 26) * 0.15, half = 8 + (y - 26) * 0.35;
        if (Math.abs(x - cx) <= half) robe.add(key(x, y));
      }
      // Lower robe streaming back, torn into strips that thin out.
      if (y >= 44 && y < 63) {
        const cx = 30 - (y - 44) * 0.4, back = cx - 13 - (y - 44) * 0.9, front = cx + 8 - (y - 44) * 0.25;
        const torn = Math.sin(y * 0.25 + x * 0.6 + ph * 2) > -0.25 + ((y - 44) / 19) * 1.3;
        if (x >= back && x <= front && torn) robe.add(key(x, y));
      }
    }
  }
  // Tatters flowing back from the shoulders.
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let t = 0; t <= 1.001; t += 0.1) pts.push([26 - t * (16 + i * 3), 24 + i * 5 + t * 9 + 3 * Math.sin(t * 6 + ph * 2 + i)]);
    for (let k = 1; k < pts.length; k++) stroke(robe, ...pts[k - 1], ...pts[k], 2.4 * (1 - (k - 1) / pts.length), 2.4 * (1 - k / pts.length));
  }
  // Arms: a sleeve reaching forward with a bony hand, the other lower and closer.
  const reach = 1.5 * Math.sin(ph);
  stroke(robe, 39, 29, 51, 33 + reach, 3, 2.2);
  stroke(robe, 35, 33, 43, 42 + reach / 2, 2.8, 2);
  for (let i = 0; i < 4; i++) {
    const curl = Math.sin(ph + i * 0.6) * 1.2;
    stroke(bone, 52, 32.5 + reach + i * 0.9, 58.5 + i * 0.3, 30 + reach + i * 2.2 + curl, 0.6, 0.45);
  }
  stroke(bone, 51, 32 + reach, 53, 34.5 + reach, 1.3, 1.1);                     // palm
  for (let i = 0; i < 3; i++) stroke(bone, 44, 42.5 + reach / 2 + i * 0.6, 46 + i, 48 + reach / 2 + i * 0.4, 0.55, 0.4);

  // Paint: robe with folds and lit torn edges, a void for a face, bones, then the cold aura.
  const px = new Array(S * S).fill(null);
  const has = (set, x, y) => x >= 0 && y >= 0 && x < S && y < S && set.has(key(x, y));
  const any = (x, y) => has(robe, x, y) || has(bone, x, y);
  const faceVoid = (x, y) => (x - 38) ** 2 / 20 + (y - hy - 2) ** 2 / 36 <= 1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (has(bone, x, y)) { px[key(x, y)] = [...(x < 52 ? BONE_DARK : BONE), 255]; continue; }
      if (has(robe, x, y)) {
        const edge = !any(x - 1, y) || !any(x + 1, y) || !any(x, y - 1) || !any(x, y + 1);
        const fold = Math.sin(x * 0.5 + y * 0.5 + ph) > 0.85;
        const fade = y > 48 ? Math.max(0.25, (63 - y) / 15) : 1;
        let c = edge ? EDGE : fold ? FOLD : y < hy - 4 ? FOLD : ROBE;   // light falls on the top of the hood
        if (faceVoid(x, y)) c = (x - 38) ** 2 / 20 + (y - hy - 2) ** 2 / 36 > 0.6 ? VOID_RIM : VOID;
        px[key(x, y)] = [...c, Math.round(245 * fade)];
        continue;
      }
      for (let d = 1; d <= 3; d++) {
        let near = false;
        for (let dy = -d; dy <= d && !near; dy++) for (let dx = -d; dx <= d && !near; dx++) near = any(x + dx, y + dy);
        if (near) { px[key(x, y)] = [...AURA, AURA_ALPHA[d]]; break; }
      }
    }
  }
  // Cold wisps trailing behind it.
  for (let i = 0; i < 5; i++) {
    const t = ph + i * 1.3, wx = Math.round(14 + i * 3 + 3 * Math.cos(t)), wy = Math.round(30 + i * 5 + 3 * Math.sin(t * 1.4));
    if (!any(wx, wy)) px[key(wx, wy)] = [...WISP, 150];
  }
  const W = S * SCALE, data = Buffer.alloc(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const p = px[Math.floor(y / SCALE) * S + Math.floor(x / SCALE)];
      if (p) p.forEach((v, c) => { data[(y * W + x) * 4 + c] = v; });
    }
  }
  fs.writeFileSync(path.join(OUT, `fantasma_${f}.png`), writePng({ width: W, height: W, data }));
}
console.log(`fantasma_0..${FRAMES - 1}.png written to ${path.relative(process.cwd(), OUT)}`);
