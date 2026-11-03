// Kaito's gravity flip gets its own animation (it used the jump's falling frame): the tucked jump frame
// (jump_6) turned a quarter at a time, a somersault while gravity switches, wrapped in a violet aura of
// dark energy and with a lighter rim, so it reads as a power and not as a jump.
//   node tools/gdevelop/assets/make-flip.mjs   ->   GravityRunnerDash/assets/kaito/flip_<0..3>.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "../lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "..", "..", "..", "GravityRunnerDash", "assets", "kaito");
const AURA = [150, 70, 255], AURA_ALPHA = [0, 200, 140, 80, 35], RIM = [205, 150, 255];

const src = readPng(fs.readFileSync(path.join(DIR, "jump_6.png")));
const N = src.width;
if (src.height !== N) throw new Error("jump_6.png must be square");
const at = (img, x, y) => (y * N + x) * 4;

for (let k = 0; k < 4; k++) {
  // Quarter turns clockwise around the center (the sprite's origin), pixel for pixel.
  const out = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const [sx, sy] = [[x, y], [y, N - 1 - x], [N - 1 - x, N - 1 - y], [N - 1 - y, x]][k];
      src.data.copy(out, at(out, x, y), at(src, sx, sy), at(src, sx, sy) + 4);
    }
  }
  // Distance (in pixels, up to 4) from the body, for the rim and the aura.
  const solid = (x, y) => x >= 0 && y >= 0 && x < N && y < N && out[at(out, x, y) + 3] > 100;
  const dist = (x, y) => {
    for (let d = 1; d <= 4; d++) {
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (solid(x + dx, y + dy)) return d;
    }
    return 0;
  };
  const result = Buffer.from(out);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const o = at(result, x, y);
      if (solid(x, y)) {
        const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
        if (edge) for (let c = 0; c < 3; c++) result[o + c] = Math.round(result[o + c] * 0.6 + RIM[c] * 0.4);
        continue;
      }
      const d = dist(x, y);
      if (!d) continue;
      result[o] = AURA[0]; result[o + 1] = AURA[1]; result[o + 2] = AURA[2]; result[o + 3] = AURA_ALPHA[d];
    }
  }
  fs.writeFileSync(path.join(DIR, `flip_${k}.png`), writePng({ width: N, height: N, data: result }));
}
console.log(`flip_0..3.png written to ${path.relative(process.cwd(), DIR)}`);
