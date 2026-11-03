// Finds where each line starts and ends inside a member's ElevenLabs take (tools/video/.cache/voz-<member>.mp3):
// FFmpeg's silencedetect lists the pauses, and the boundaries between lines are the pauses whose choice
// keeps the voice at a steady pace (dynamic programming over the pauses). Used by
// make-pitch.mjs; `node tools/video/voice-cuts.mjs` prints the cuts and the pace of every line to check them.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { findFfmpeg } from "../gdevelop/lib/ffmpeg.mjs";
import { LINES, MEMBERS } from "./pitch-script.mjs";

const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache");
export const takeFile = (member) => path.join(CACHE, `voz-${member}.mp3`);

function pauses(file) {
  const r = spawnSync(findFfmpeg("ffmpeg"), ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.18", "-f", "null", "-"], { encoding: "utf8" });
  const log = r.stderr;
  const duration = Number(log.match(/Duration: (\d+):(\d+):([\d.]+)/).slice(1).reduce((a, x) => a * 60 + Number(x), 0));
  const out = [];
  for (const m of log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)) out.push([Number(m[1]), Number(m[2])]);
  return { duration, pauses: out };
}

// [{ text, chapter, from, to }] for one member, in the take's order.
export function cuts(member) {
  const lines = LINES.filter(([m]) => m === member);
  const { duration, pauses: ps } = pauses(takeFile(member));
  const first = ps.length && ps[0][0] < 0.05 ? ps.shift()[1] : 0;          // leading silence
  const last = ps.length && ps[ps.length - 1][1] > duration - 0.05 ? ps.pop()[0] : duration;
  // Each boundary between two lines is one of the pauses; pick the set that keeps the pace of every line closest
  // to the take's average (log ratio, squared), with a small bonus for longer pauses (paragraph breaks).
  const chars = lines.map(([, , t]) => t.length);
  const rate = chars.reduce((x, y) => x + y, 0) / (last - first);
  const n = lines.length, P = ps.length;
  const lineCost = (i, start, end) => (end - start < 0.3 ? 1e9 : Math.log(chars[i] / (end - start) / rate) ** 2);
  const cost = Array.from({ length: n }, () => new Array(P).fill(Infinity)), prev = Array.from({ length: n }, () => new Array(P).fill(-1));
  for (let k = 0; k < P; k++) cost[0][k] = lineCost(0, first, ps[k][0]) - 0.4 * (ps[k][1] - ps[k][0]);
  for (let i = 1; i < n - 1; i++) for (let k = i; k < P; k++) for (let j = i - 1; j < k; j++) {
    const c = cost[i - 1][j] + lineCost(i, ps[j][1], ps[k][0]) - 0.4 * (ps[k][1] - ps[k][0]);
    if (c < cost[i][k]) { cost[i][k] = c; prev[i][k] = j; }
  }
  let end = -1, bestCost = Infinity;
  for (let k = n - 2; k < P; k++) { const c = cost[n - 2][k] + lineCost(n - 1, ps[k][1], last); if (c < bestCost) { bestCost = c; end = k; } }
  const bounds = new Array(n - 1);
  for (let i = n - 2, k = end; i >= 0; k = prev[i][k], i--) bounds[i] = ps[k];
  return lines.map(([, chapter, text], i) => ({
    text, chapter,
    from: Math.max(0, (i === 0 ? first : bounds[i - 1][1]) - 0.05),
    to: Math.min(duration, (i === lines.length - 1 ? last : bounds[i][0]) + 0.08),
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const member of Object.keys(MEMBERS)) {
    const cs = cuts(member);
    console.log(`${member}:`);
    for (const c of cs) console.log(`  ${c.from.toFixed(2)}–${c.to.toFixed(2)}  ${(c.text.length / (c.to - c.from)).toFixed(1)} car/s  ${c.text.slice(0, 50)}`);
  }
}
