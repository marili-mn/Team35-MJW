// Cuts the sorceress (final boss) out of assets/wizard/wizardConcept.png into 16 transparent frames
// aligned by the feet: GravityRunnerDash/assets/maga/maga_<0..15>.png (row by row, 4x4 grid).
//   node tools/gdevelop/assets/slice-maga.mjs
// The sheet has no alpha channel: its "transparent" checkerboard is painted (two grays, ~113 and ~157,
// irregular ~21 px squares). Background = gray pixels close to those tones that connect to the cell border;
// every other pixel is un-blended from the nearest background gray (color-to-alpha), which keeps the smoke
// dragons and the lightning semi-transparent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "../lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const SHEET = path.join(REPO, "assets", "wizard", "wizardConcept.png");
const OUT = path.join(REPO, "GravityRunnerDash", "assets", "maga");
const COLS = 4, ROWS = 4;
const OUT_W = 400, OUT_H = 230, FEET_Y = 222;   // every frame: body centered at x=200, feet at y=222

const sheet = readPng(fs.readFileSync(SHEET));
fs.mkdirSync(OUT, { recursive: true });
const cellW = Math.floor(sheet.width / COLS), cellH = Math.floor(sheet.height / ROWS);

function cutCell(cx, cy) {
  const w = cellW, h = cellH, n = w * h;
  const rgb = new Float32Array(n * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = ((cy * cellH + y) * sheet.width + cx * cellW + x) * 4, i = (y * w + x) * 3;
    rgb[i] = sheet.data[o]; rgb[i + 1] = sheet.data[o + 1]; rgb[i + 2] = sheet.data[o + 2];
  }
  const lum = (p) => (rgb[p * 3] + rgb[p * 3 + 1] + rgb[p * 3 + 2]) / 3;
  const grayish = (p) => Math.max(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]) - Math.min(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]) <= 12;
  const bgLike = (p) => grayish(p) && lum(p) >= 100 && lum(p) <= 170;   // both tones and the 1 px blends between them

  // Background: flood fill from the border through background-like pixels.
  const bg = new Uint8Array(n);
  const queue = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const p = y * w + x; if (bgLike(p)) { bg[p] = 1; queue.push(p); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const p = y * w + x; if (!bg[p] && bgLike(p)) { bg[p] = 1; queue.push(p); } }
  for (let q = 0; q < queue.length; q++) {
    const p = queue[q], x = p % w, y = (p / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (!bg[np] && bgLike(np)) { bg[np] = 1; queue.push(np); }
    }
  }
  // Checkerboard enclosed by the figure (between the legs, inside the smoke): big regions of background-like
  // pixels where most pixels sit right on one of the two tones (the gray katana blade is a gradient).
  const seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (bg[s] || seen[s] || !bgLike(s)) continue;
    const region = [s];
    seen[s] = 1;
    for (let q = 0; q < region.length; q++) {
      const p = region[q], x = p % w, y = (p / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (!seen[np] && !bg[np] && bgLike(np)) { seen[np] = 1; region.push(np); }
      }
    }
    const onTone = region.filter((p) => Math.abs(lum(p) - 113) <= 8 || Math.abs(lum(p) - 157) <= 8).length;
    if (region.length >= 150 && onTone >= 0.75 * region.length) for (const p of region) bg[p] = 1;
  }
  // Nearest background gray for every pixel (multi-source BFS from the background).
  const near = new Float32Array(n).fill(-1);
  const q2 = [];
  for (let p = 0; p < n; p++) if (bg[p]) { near[p] = lum(p); q2.push(p); }
  for (let q = 0; q < q2.length; q++) {
    const p = q2[q], x = p % w, y = (p / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (near[np] < 0) { near[np] = near[p]; q2.push(np); }
    }
  }
  // Color to alpha against that gray, boosted so the solid body stays opaque.
  const rgba = Buffer.alloc(n * 4);
  for (let p = 0; p < n; p++) {
    if (bg[p]) continue;
    const E = near[p] < 0 ? 135 : near[p] < 135 ? 113 : 157;
    let a = 0;
    for (let c = 0; c < 3; c++) { const P = rgb[p * 3 + c]; a = Math.max(a, P > E ? (P - E) / (255 - E) : (E - P) / E); }
    if (a < 0.12) continue;
    a = Math.min(1, a * 1.5);
    for (let c = 0; c < 3; c++) rgba[p * 4 + c] = Math.max(0, Math.min(255, Math.round((rgb[p * 3 + c] - (1 - a) * E) / a)));
    rgba[p * 4 + 3] = Math.round(a * 255);
  }
  return { w, h, rgba };
}

// Feet = lowest row and body center = mean x of the solid dark pixels (the black outfit and boots), so the
// magic circle under her feet does not count.
function anchor({ w, h, rgba }) {
  let feet = 0, sx = 0, count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (rgba[o + 3] < 230) continue;
    if (rgba[o] + rgba[o + 1] + rgba[o + 2] < 200) { sx += x; count++; if (y > feet) feet = y; }
  }
  return { feet, cx: count ? sx / count : w / 2 };
}

for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const cell = cutCell(c, r);
  const { feet, cx } = anchor(cell);
  const dx = Math.round(OUT_W / 2 - cx), dy = FEET_Y - feet;
  const data = Buffer.alloc(OUT_W * OUT_H * 4);
  for (let y = 0; y < cell.h; y++) for (let x = 0; x < cell.w; x++) {
    const tx = x + dx, ty = y + dy;
    if (tx < 0 || ty < 0 || tx >= OUT_W || ty >= OUT_H) continue;
    cell.rgba.copy(data, (ty * OUT_W + tx) * 4, (y * cell.w + x) * 4, (y * cell.w + x) * 4 + 4);
  }
  const file = path.join(OUT, `maga_${r * COLS + c}.png`);
  fs.writeFileSync(file, writePng({ width: OUT_W, height: OUT_H, data }));
  console.log(`${path.relative(REPO, file)}: feet y=${feet}, body x=${Math.round(cx)}`);
}

// Her projectiles, cut from her own effects: the energy burst of frame 5 (it flies along the floor) and the
// smoke dragon on the right of frame 8 (it flies along the ceiling). Cropped to their visible pixels.
function cropRegion(frame, x0, name) {
  const img = readPng(fs.readFileSync(path.join(OUT, `maga_${frame}.png`)));
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) for (let x = x0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] < 40) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const w = maxX - minX + 1, h = maxY - minY + 1, data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.data.copy(data, y * w * 4, ((minY + y) * img.width + minX) * 4, ((minY + y) * img.width + maxX + 1) * 4);
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, writePng({ width: w, height: h, data }));
  console.log(`${path.relative(REPO, file)}: ${w}x${h}`);
}
cropRegion(5, 290, "hechizo");
cropRegion(8, 255, "dragon");
