// Synthesizes the game's music and sound effects (chiptune, original, no samples) into
// GravityRunnerDash/assets/audio/*.wav, deterministically (seeded):
//   node tools/gdevelop/assets/make-audio.mjs
// The music uses the Japanese "in" scale (miyako-bushi) to match the temples; every track loops seamlessly.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "..", "..", "GravityRunnerDash", "assets", "audio");
const SR = 22050;

// ---------- primitives ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const noteHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const square = (ph, duty = 0.5) => ((ph % 1) < duty ? 1 : -1);
const tri = (ph) => 1 - 4 * Math.abs((ph % 1) - 0.5);
const saw = (ph) => 2 * (ph % 1) - 1;
function buffer(seconds) { return new Float32Array(Math.round(seconds * SR)); }
// Adds a tone with a frequency curve f(t) and an amplitude envelope env(t) (t in seconds from `at`).
function tone(buf, at, dur, f, env, wave = (p) => square(p, 0.25), gain = 0.3) {
  let ph = 0;
  const start = Math.round(at * SR), n = Math.round(dur * SR);
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / SR;
    ph += f(t) / SR;
    buf[start + i] += wave(ph) * env(t, dur) * gain;
  }
}
function noise(buf, at, dur, env, gain = 0.3, seed = 7, lowpass = 1) {
  const r = rng(seed);
  let y = 0;
  const start = Math.round(at * SR), n = Math.round(dur * SR);
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / SR, k = typeof lowpass === "function" ? lowpass(t) : lowpass;
    y += k * (r() * 2 - 1 - y);
    buf[start + i] += y * env(t, dur) * gain;
  }
}
const decay = (speed) => (t) => Math.exp(-t * speed);
const pluck = (t, d) => Math.min(1, t * 200) * Math.exp(-t * 6) * (t < d - 0.01 ? 1 : 0);
const held = (t, d) => Math.min(1, t * 80) * Math.min(1, (d - t) * 30);

function writeWav(name, buf, peak = 0.85) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const k = max > 0 ? peak / max : 1;
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * k)) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([h, data]));
  console.log(`${name}.wav: ${(buf.length / SR).toFixed(2)} s, ${Math.round((44 + data.length) / 1024)} KB`);
}

// ---------- sound effects ----------
function sfx() {
  let b = buffer(0.2);   // jump: quick upward chirp
  tone(b, 0, 0.18, (t) => 320 + 2600 * t, decay(14), (p) => square(p, 0.25), 0.4);
  writeWav("salto", b);

  b = buffer(0.3);       // hit: thud + crunch
  tone(b, 0, 0.25, (t) => 140 - 260 * t, decay(12), (p) => square(p, 0.5), 0.5);
  noise(b, 0, 0.18, decay(18), 0.5, 3, 0.6);
  writeWav("golpe", b);

  b = buffer(0.32);      // crystal: bright two-note sparkle
  tone(b, 0, 0.12, () => noteHz(88), decay(16), tri, 0.4);
  tone(b, 0.07, 0.24, () => noteHz(95), decay(12), tri, 0.4);
  tone(b, 0.07, 0.24, () => noteHz(100), decay(18), (p) => square(p, 0.125), 0.08);
  writeWav("cristal", b);

  b = buffer(0.24);      // katana: swoosh (noise whose brightness falls)
  noise(b, 0, 0.22, (t, d) => Math.sin(Math.PI * t / d) ** 2, 0.7, 11, (t) => 0.9 - 3.5 * t);
  tone(b, 0, 0.12, (t) => 1800 - 6000 * t, decay(30), tri, 0.12);
  writeWav("espada", b);

  b = buffer(0.42);      // gravity flip: rising wobble
  tone(b, 0, 0.4, (t) => 180 + 1400 * t * t * 4 + 30 * Math.sin(t * 60), (t, d) => held(t, d) * (1 - t / d * 0.5), tri, 0.45);
  noise(b, 0, 0.4, (t, d) => 0.3 * held(t, d), 0.2, 5, (t) => 0.05 + t);
  writeWav("gravedad", b);

  b = buffer(0.38);      // enemy defeated: falling buzz + puff
  tone(b, 0, 0.32, (t) => 700 * Math.exp(-t * 7), decay(6), (p) => square(p, 0.5), 0.35);
  noise(b, 0.05, 0.3, decay(10), 0.35, 9, 0.3);
  writeWav("enemigo", b);

  b = buffer(0.6);       // spell: buzzing, rising charge
  tone(b, 0, 0.55, (t) => 110 + 220 * t, (t, d) => held(t, d) * (0.6 + 0.4 * Math.sin(t * 70)), saw, 0.3);
  noise(b, 0, 0.55, (t, d) => held(t, d) * t * 2, 0.25, 13, (t) => 0.2 + t);
  writeWav("hechizo", b);

  b = buffer(0.8);       // portal opens: rising arpeggio
  [72, 76, 79, 84, 88].forEach((m, i) => tone(b, i * 0.09, 0.5, () => noteHz(m), decay(5), tri, 0.35));
  writeWav("portal", b);

  b = buffer(2.2);       // victory fanfare
  const fan = [[72, 0, 0.18], [76, 0.18, 0.18], [79, 0.36, 0.18], [84, 0.54, 0.5], [79, 1.04, 0.18], [84, 1.22, 0.9]];
  for (const [m, at, d] of fan) {
    tone(b, at, d, () => noteHz(m), held, (p) => square(p, 0.25), 0.3);
    tone(b, at, d, () => noteHz(m - 24), held, tri, 0.35);
  }
  writeWav("victoria", b);
}

// ---------- music ----------
// "in" scale on A: A Bb D E F (and octaves). Melody = seeded walk over the scale with an AABA phrase plan.
const IN_SCALE = [0, 1, 5, 7, 8];
function scaleNote(root, degree) { const o = Math.floor(degree / 5); return root + 12 * o + IN_SCALE[((degree % 5) + 5) % 5]; }
function music(name, { bpm, bars, seed, root, bassPattern, lead, drums }) {
  const beat = 60 / bpm, bar = beat * 4, len = bars * bar;
  const b = buffer(len);
  const r = rng(seed);
  // Two 2-bar phrases A and B, played A A B A (x bars/8).
  const phrase = () => {
    const notes = [];
    let deg = 5 + Math.floor(r() * 3);
    for (let s = 0; s < 16; s++) {                       // eighth notes over 2 bars
      if (r() < 0.25 && s % 4 !== 0) { notes.push(null); continue; }
      deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(r() * 7)];
      deg = Math.max(2, Math.min(11, deg));
      notes.push(deg);
    }
    return notes;
  };
  const A = phrase(), B = phrase();
  const plan = [];
  for (let i = 0; i < bars / 8; i++) plan.push(A, A, B, A);
  plan.forEach((notes, p) => notes.forEach((deg, s) => {
    if (deg === null) return;
    const at = p * 2 * bar + s * beat / 2;
    tone(b, at, beat / 2 * 0.95, () => noteHz(scaleNote(root + 12, deg)), pluck, (ph) => square(ph, lead), 0.16);
  }));
  for (let i = 0; i < bars * 4; i++) {
    const at = i * beat, deg = bassPattern[i % bassPattern.length];
    tone(b, at, beat * 0.9, () => noteHz(scaleNote(root - 12, deg)), held, tri, 0.3);
    if (drums) {
      if (i % 2 === 0) tone(b, at, 0.12, (t) => 110 * Math.exp(-t * 20) + 45, decay(22), (ph) => Math.sin(2 * Math.PI * ph), 0.55); // kick
      else noise(b, at, 0.12, decay(25), 0.22, 17 + i, 0.5);                                                                     // snare
      noise(b, at + beat / 2, 0.04, decay(80), 0.07, 31 + i, 0.95);                                                              // hi-hat
    }
  }
  writeWav(name, b, 0.8);
}

fs.mkdirSync(OUT, { recursive: true });
sfx();
music("musica_nivel", { bpm: 128, bars: 16, seed: 2026, root: 57, lead: 0.25, bassPattern: [0, 0, 2, 0, 3, 3, 2, 1], drums: true });
music("musica_jefe", { bpm: 150, bars: 16, seed: 35, root: 52, lead: 0.125, bassPattern: [0, 0, 1, 0, 0, 0, 1, 3], drums: true });
