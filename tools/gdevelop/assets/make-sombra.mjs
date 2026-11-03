// The shadow ninjas (an original enemy): Kaito's earlier sprites from the team's sheets, which the game no
// longer used (NewSprite2-16 standing, walk9-24 walking), plus Kaito's run, jump and attack, turned into a
// living shadow: a near-black body that keeps a trace of its shading so the folds still read, a violet rim
// light, eyes that glow and a haze of smoke that drifts off its back.
//   node tools/gdevelop/assets/make-sombra.mjs   ->   GravityRunnerDash/assets/sombra/<move>_<i>.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "../lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.join(HERE, "..", "..", "..", "GravityRunnerDash");
const OUT = path.join(GAME, "assets", "sombra");
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const SOMBRA_MOVES = {
  idle: range(2, 16).map((i) => `assets/NewSprite${i}.png`),
  walk: range(9, 24).map((i) => `assets/walk${i}.png`),
  run: range(0, 7).map((i) => `assets/kaito/run_${i}.png`),
  jump: range(0, 7).map((i) => `assets/kaito/jump_${i}.png`),
  attack: range(0, 9).map((i) => `assets/kaito/attack_${i}.png`),
};
const RIM = [118, 62, 196], EYE = [240, 222, 255], HAZE = [70, 24, 120], HAZE_ALPHA = [0, 95, 48, 18];

function toShadow({ width: w, height: h, data }, frame) {
  const out = Buffer.alloc(w * h * 4);
  const alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3]);
  const solid = (x, y) => alpha(x, y) > 40;
  let top = h, bottom = -1, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  const headEnd = top + (bottom - top) * 0.2;
  let headLeft = w, headRight = -1;   // the eyes are on the face side of the head (it faces right)
  for (let y = top; y < headEnd; y++) for (let x = 0; x < w; x++) if (solid(x, y)) { headLeft = Math.min(headLeft, x); headRight = Math.max(headRight, x); }
  const faceFrom = headLeft + (headRight - headLeft) * 0.5;
  let eyes = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue;
    const i = (y * w + x) * 4, [r, g, b] = data.subarray(i, i + 3), lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    let c = [10 + 46 * lum, 6 + 24 * lum, 20 + 70 * lum];
    if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) c = RIM;
    if (y < headEnd && x >= faceFrom && lum > 0.42 && r > b + 10) { c = EYE; eyes++; }
    out.set([...c.map(Math.round), 255], i);
    if (y < headEnd) right = Math.max(right, x);
  }
  if (eyes < 2 && right > 0) {   // the mask hides the eyes in this frame: two glowing pixels where they are
    const y = Math.round(top + (headEnd - top) * 0.55);
    for (const dx of [3, 4, 6]) out.set([...EYE, 255], (y * w + right - dx) * 4);
  }
  // the haze: a soft violet halo around the body, and wisps rising off its back that move with the frame
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    let d = 4;
    for (let dy = -3; dy <= 3 && d > 1; dy++) for (let dx = -3; dx <= 3; dx++) if (solid(x + dx, y + dy)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
    if (d <= 3) out.set([...HAZE, HAZE_ALPHA[d]], (y * w + x) * 4);
  }
  for (let k = 0; k < 4; k++) {
    const y = top + 14 + k * 16 - ((frame * 3 + k * 5) % 10);
    let left = -1;
    for (let x = 0; x < w && left < 0; x++) if (solid(x, y)) left = x;
    if (left < 0 || y < 0) continue;
    const x = left - 3 - ((frame * 2 + k * 3) % 6);
    for (const [ox, oy, a] of [[0, 0, 150], [1, 0, 90], [0, -1, 90]]) if (x + ox >= 0) out.set([...HAZE.map((v) => v + 30), a], ((y + oy) * w + x + ox) * 4);
  }
  return { width: w, height: h, data: out };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${path.resolve(process.argv[1]).replace(/\\/g, "/")}`).href) {
  fs.mkdirSync(OUT, { recursive: true });
  let n = 0;
  for (const [move, files] of Object.entries(SOMBRA_MOVES)) {
    files.forEach((file, i) => {
      fs.writeFileSync(path.join(OUT, `${move}_${i}.png`), writePng(toShadow(readPng(fs.readFileSync(path.join(GAME, file))), i)));
      n++;
    });
  }
  console.log(`${n} frames of the shadow ninja in ${path.relative(process.cwd(), OUT)}`);
}
