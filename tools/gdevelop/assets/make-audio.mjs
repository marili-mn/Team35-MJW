// Synthesizes the game's music and sound effects into GravityRunnerDash/assets/audio, deterministically:
//   node tools/gdevelop/assets/make-audio.mjs
// No samples and no chip waves: the instruments are modelled from scratch with lib/synth.mjs (koto and
// shamisen as plucked strings, shakuhachi as a breathy flute, taiko drums, temple bells, choirs) and each
// effect is layered as in a studio (attack + body + tail) in a shared room, then mastered to a loudness
// target (docs/sonido.md). Short effects are WAV, so they play at once; music and jingles are MP3 (FFmpeg,
// found by lib/ffmpeg.mjs). The music uses the Japanese "in" scale (miyako-bushi) and every track loops
// seamlessly: its tails wrap round to the start.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  SR, sec, midiHz, random, mix, shape, env, osc, fm, partials, noise, svf, onePole, body, pluck, flute, taiko, odaiko,
  shime, rim, shaker, bell, gong, pad, brass, voice, drive, reverse, stereo, place, placeStereo, sumStereo, reverb,
  pingPong, chorus, master, loudness, momentary, peakDb, wav, arrangement,
} from "../lib/synth.mjs";
import { run } from "../lib/ffmpeg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "..", "..", "GravityRunnerDash", "assets", "audio");
const CACHE = path.resolve(HERE, "..", ".cache", "audio");

// ---------- instruments ----------
let seeds = 1000;
const seed = () => seeds++;
const KOTO_BODY = [[210, 2.5, 0.25], [640, 3, 0.18], [1750, 4, 0.08]];
// Koto: plucked near the bridge, a little sharp for the first instant (the string is stretched by the pluck).
const koto = (m, dur = 2.4, o = {}) => body(pluck(midiHz(m), dur, {
  seed: seed(), t60: Math.max(0.9, 2.6 - (m - 55) * 0.05), bright: 0.8, pick: 0.12, damp: 0.42, bend: (t) => 0.12 * Math.exp(-t / 0.03), ...o,
}), KOTO_BODY);
// Shamisen: a bright, short string struck with the bachi, which also slaps the skin; the buzz of the sawari.
const shamisen = (m, dur = 0.7, o = {}) => {
  const string = pluck(midiHz(m), dur, { seed: seed(), t60: 0.55, bright: 1, pick: 0.07, damp: 0.28, ...o });
  const skin = shape(svf(noise(dur, { seed: seed() }), 340, { q: 1.4, mode: "bpn" }), (t) => 0.5 * Math.exp(-t / 0.02));
  return svf(drive(mix(string, skin), 1.8), 180, { mode: "hp" });
};
const bassPluck = (m, dur) => pluck(midiHz(m), dur, { seed: seed(), t60: 1.1, bright: 0.45, pick: 0.3, damp: 0.5 });
const sub = (m, dur) => shape(osc("sine", midiHz(m), dur), env.adsr(0.008, 0.15, 0.75, 0.06));
const sawBass = (m, dur) => drive(shape(svf(mix(osc("saw", midiHz(m), dur), [osc("square", midiHz(m - 12), dur), 0.5]),
  (t) => 220 + 1800 * Math.exp(-t / 0.07), { q: 1.6 }), env.adsr(0.004, 0.1, 0.6, 0.04)), 2.2);
const shaku = (m, dur, o = {}) => flute(midiHz(m), dur, { seed: seed(), ...o });
const glassBell = (m) => shape(fm(midiHz(m), 0.8, { ratio: 3.5, index: (x) => 1.5 * Math.exp(-x / 0.04) }), env.perc(0.001, 0.25));
// Round robin: a few takes of each drum, so repeated hits are never identical; a little timing and velocity
// play, like a person drumming.
function kit(s, { big = false } = {}) {
  const r = random(s), takes = (list) => { let i = 0; return () => list[i++ % list.length]; };
  return {
    D: takes([0, 1, 2].map((k) => (big ? odaiko(2.2, { seed: s + k, from: 105 + k * 4 }) : taiko(1.3, { seed: s + k, from: 150 + k * 4 })))),
    d: takes([0, 1, 2].map((k) => taiko(1.0, { seed: s + 10 + k, from: 165 + k * 5, decay: 0.3 }))),
    k: takes([0, 1, 2].map((k) => rim(0.12, { seed: s + 20 + k }))),
    s: takes([0, 1, 2, 3].map((k) => shime(0.25, { seed: s + 30 + k }))),
    h: takes([0, 1, 2].map((k) => shaker(0.12, { seed: s + 40 + k }))),
    jitter: () => (r() - 0.5) * 0.006,
    vel: () => 0.9 + 0.18 * r(),
  };
}
const withRoom = (t, { room = 0.6, damp = 0.5, wet = 0.2, predelay = 0.01 } = {}) => {
  const tail = reverb(t, { room, damp, predelay });
  return sumStereo(t, { L: tail.L.map((v) => v * wet), R: tail.R.map((v) => v * wet) });
};
const withEcho = (t, { time = 0.1, feedback = 0.3, wet = 0.25 } = {}) => {
  const e = pingPong(t, { time, feedback });
  return sumStereo(t, { L: e.L.map((v) => v * wet), R: e.R.map((v) => v * wet) });
};

// ---------- sound effects ----------
const SFX = {
  // Jump: a ninja's, not an arcade "fwoop" (no pitched sweep): the gi snapping as it flutters (noise in a
  // wide band, chopped by fast random flaps), the dull push of the foot on stone and a broad breath of air.
  salto() {
    const d = 0.3, t = stereo(d), r = random(11);
    const flaps = Array.from({ length: 8 }, () => [0.01 + 0.13 * r(), 0.5 + 0.5 * r()]);
    const flutter = (x) => flaps.reduce((a, [at, g]) => a + g * Math.exp(-(((x - at) / 0.009) ** 2)), 0);
    place(t, shape(svf(noise(d, { seed: 12, color: "pink" }), 1700, { q: 0.7, mode: "bpn" }), (x) => flutter(x) * Math.exp(-x / 0.09)), 0, { gain: 0.55 });
    place(t, shape(svf(noise(d, { seed: 13 }), 380, { q: 0.9, mode: "bpn" }), env.perc(0.002, 0.025)), 0, { gain: 0.6 });
    place(t, shape(osc("sine", (x) => 85 + 40 * Math.exp(-x / 0.012), d), env.perc(0.002, 0.02)), 0, { gain: 0.3 });
    place(t, shape(svf(noise(d, { seed: 14 }), 2600, { mode: "hp" }), env.perc(0.001, 0.012)), 0.004, { gain: 0.12 });
    place(t, shape(svf(noise(d, { seed: 15, color: "pink" }), 900, { q: 0.5, mode: "bpn" }), env.perc(0.015, 0.08)), 0, { gain: 0.35 });
    return t;
  },
  // Taking damage: the weight of the blow (a falling sub), a distorted crunch, the click and a dissonant ring.
  golpe() {
    const d = 0.7, t = stereo(d);
    place(t, drive(shape(osc("sine", (x) => 45 + 75 * Math.exp(-x / 0.05), d), env.perc(0.002, 0.15)), 2), 0, { gain: 0.9 });
    place(t, drive(shape(svf(noise(d, { seed: 21 }), 900, { q: 0.9, mode: "bpn" }), env.perc(0.001, 0.06)), 3), 0, { gain: 0.6 });
    place(t, shape(onePole(noise(d, { seed: 22 }), 4000, "hp"), env.perc(0.0005, 0.004)), 0, { gain: 0.5 });
    place(t, shape(fm(180, d, { ratio: 1.41, index: (x) => 3 * Math.exp(-x / 0.08) }), env.perc(0.002, 0.12)), 0, { gain: 0.22 });
    return withRoom(t, { room: 0.45, wet: 0.12 });
  },
  // Crystal: a glassy FM bell, two notes up the scale, a sparkle on top and a short echo.
  cristal() {
    const d = 1.1, t = stereo(d);
    const glass = (m) => mix(shape(fm(midiHz(m), d, { ratio: 3.5, index: (x) => 2.2 * Math.exp(-x / 0.05) }), env.perc(0.001, 0.32)),
      [shape(osc("sine", midiHz(m) * 4.01, d), env.perc(0.001, 0.05)), 0.25]);
    place(t, glass(81), 0, { gain: 0.5, pan: -0.25 });
    place(t, glass(86), 0.075, { gain: 0.55, pan: 0.25 });
    place(t, shape(osc("sine", 5200, d), env.perc(0.0005, 0.012)), 0, { gain: 0.12 });
    return withEcho(withRoom(t, { room: 0.7, wet: 0.22 }), { time: 0.09, feedback: 0.3, wet: 0.25 });
  },
  // Katana: noise through a resonant band that sweeps up and back down as the blade passes from left to
  // right; on the cut, the ring of the steel.
  espada() {
    const d = 0.42, sw = 0.24, t = stereo(d);
    const band = (x) => 700 + 3100 * Math.sin(Math.PI * Math.min(1, x / sw)) ** 1.5;
    const swing = shape(svf(mix(noise(d, { seed: 31 }), [noise(d, { seed: 32, color: "pink" }), 1.5]), band, { q: 2.2, mode: "bpn" }),
      (x) => (x < sw ? Math.sin((Math.PI * x) / sw) ** 2 : 0));
    place(t, swing, 0, { pan: (x) => -0.6 + 1.2 * Math.min(1, x / sw) });
    place(t, shape(svf(noise(d, { seed: 33 }), 380), (x) => (x < sw ? Math.sin((Math.PI * x) / sw) : 0)), 0, { gain: 0.35 });
    place(t, partials(3100, d - 0.07, [[1, 1, 0.09], [1.47, 0.6, 0.07], [2.03, 0.4, 0.05], [2.71, 0.25, 0.04]], { seed: 34 }), 0.07, { gain: 0.1, pan: 0.2 });
    return withRoom(t, { room: 0.5, wet: 0.1 });
  },
  // Gravity flip: temple magic, not a power-up chirp: a gust of air that swells and turns over (wide band,
  // no pitched sweep), a deep soft blow under it and the shimmer of a small temple bell, through a chorus.
  gravedad() {
    const d = 0.9, t = stereo(d);
    place(t, shape(svf(svf(noise(d, { seed: 41, color: "pink" }), 650, { q: 0.6, mode: "bpn" }), 220, { mode: "hp" }), env.swell(0.12, 1.5)), 0, { gain: 0.8, pan: (x) => Math.sin(x * 7) * 0.5 });
    place(t, shape(svf(noise(d, { seed: 42 }), 3000, { q: 0.5, mode: "bpn" }), env.swell(0.1, 2)), 0, { gain: 0.2, pan: (x) => -Math.sin(x * 7) * 0.5 });
    place(t, drive(shape(osc("sine", (x) => 52 + 30 * Math.exp(-x / 0.04), d), env.perc(0.006, 0.18)), 1.6), 0, { gain: 0.45 });
    place(t, bell(midiHz(93), d, { seed: 43, hardness: 0.15 }), 0.03, { gain: 0.12, pan: 0.3 });
    place(t, bell(midiHz(98), d, { seed: 44, hardness: 0.1 }), 0.07, { gain: 0.07, pan: -0.3 });
    return withRoom(chorus(t, { rate: 1.2, depth: 0.003, mix: 0.4 }), { room: 0.8, wet: 0.28 });
  },
  // Enemy defeated: the slash lands, the body dissolves into motes of light and the spirit leaves (a falling
  // FM tone).
  enemigo() {
    const d = 0.9, t = stereo(d), r = random(51);
    place(t, shape(svf(noise(d, { seed: 52 }), 1800, { q: 1.2, mode: "bpn" }), env.perc(0.001, 0.04)), 0, { gain: 0.6 });
    place(t, shape(osc("sine", (x) => 80 + 140 * Math.exp(-x / 0.03), d), env.perc(0.002, 0.08)), 0, { gain: 0.55 });
    place(t, shape(fm((x) => 620 * Math.exp(-x * 2.2), d, { ratio: 1.5, index: (x) => 2 * Math.exp(-x / 0.2) }), env.perc(0.01, 0.25)), 0.03, { gain: 0.22 });
    for (let i = 0; i < 26; i++) {
      const when = 0.05 + 0.5 * r() ** 1.6, f = 1400 + 3200 * r();
      place(t, shape(osc("sine", f, 0.05), env.perc(0.002, 0.012)), when, { gain: 0.08 * (1 - when), pan: r() * 2 - 1 });
    }
    return withRoom(t, { room: 0.7, wet: 0.25 });
  },
  // The Dark Sorceress casts: a growling FM charge, crackles of energy, the whoosh of the spell leaving and a
  // breath of her voice.
  hechizo() {
    const d = 1.0, t = stereo(d), r = random(61);
    place(t, shape(fm((x) => 110 + 60 * x, d, { ratio: 1.5, index: (x) => 2.5 + 1.5 * Math.sin(2 * Math.PI * 6 * x) }), env.adsr(0.2, 0.2, 0.7, 0.3)), 0, { gain: 0.45 });
    for (let i = 0; i < 40; i++) {
      const when = 0.6 * r() ** 0.7;
      place(t, shape(svf(noise(0.01, { seed: 62 + i }), 3000, { q: 2, mode: "bpn" }), env.perc(0.0005, 0.002)), when, { gain: 0.15 + 0.2 * when, pan: r() * 1.6 - 0.8 });
    }
    place(t, shape(svf(noise(d, { seed: 63, color: "pink" }), (x) => 400 * 2 ** (Math.max(0, x - 0.3) * 6), { q: 1.5, mode: "bpn" }),
      (x) => (x < 0.3 ? 0 : Math.exp(-(x - 0.3) / 0.15))), 0, { gain: 0.6 });
    place(t, shape(voice(220, d, { vowel: "a", vibrato: 0.5, breath: 0.5, seed: 64 }), env.adsr(0.15, 0.2, 0.5, 0.3)), 0, { gain: 0.12 });
    return withRoom(t, { room: 0.8, wet: 0.3 });
  },
  // Dash attack: a stronger, longer rush of air than the katana, wind dragging behind, a brighter ring.
  dash() {
    const d = 0.55, sw = 0.3, t = stereo(d);
    const band = (x) => 500 + 2600 * Math.min(1, x / 0.12) * Math.exp(-Math.max(0, x - 0.12) / 0.15);
    place(t, shape(svf(mix(noise(d, { seed: 71 }), [noise(d, { seed: 72, color: "pink" }), 2]), band, { q: 1.4, mode: "bpn" }),
      (x) => (x < sw ? Math.sin((Math.PI * x) / sw) ** 1.5 : 0)), 0, { pan: (x) => -0.7 + 1.4 * Math.min(1, x / sw) });
    place(t, shape(svf(noise(d, { seed: 73, color: "brown" }), 250), env.perc(0.02, 0.15)), 0, { gain: 0.5 });
    place(t, partials(2600, d, [[1, 1, 0.12], [1.47, 0.6, 0.09], [2.03, 0.4, 0.06]], { seed: 74 }), 0.05, { gain: 0.08 });
    return withRoom(t, { room: 0.55, wet: 0.12 });
  },
  // Reflecting a spell with the katana: the clang of struck steel with sparks, and the energy flung back (a
  // rising FM zing).
  reflejo() {
    const d = 1.1, t = stereo(d), r = random(81);
    place(t, partials(1150, d, [[1, 1, 0.5], [2.756, 0.7, 0.35], [5.404, 0.5, 0.25], [8.933, 0.3, 0.15], [13.34, 0.2, 0.08]], { seed: 82, beat: 1.5 }), 0, { gain: 0.35 });
    place(t, shape(onePole(noise(d, { seed: 83 }), 5000, "hp"), env.perc(0.0003, 0.003)), 0, { gain: 0.6 });
    place(t, shape(fm((x) => 600 * 2 ** (x * 6), 0.35, { ratio: 2.01, index: 1.5 }), env.perc(0.005, 0.1)), 0.02, { gain: 0.2, pan: (x) => x * 3 - 0.5 });
    for (let i = 0; i < 18; i++) place(t, shape(osc("sine", 3000 + 5000 * r(), 0.03), env.perc(0.001, 0.008)), 0.25 * r(), { gain: 0.1, pan: r() * 2 - 1 });
    return withRoom(t, { room: 0.7, wet: 0.25 });
  },
  // A wraith: a hollow wail sliding down from "oo" to "oh", a ghost a fifth above, breath around them and the
  // echo of a cold place.
  espectro() {
    const d = 1.8, t = stereo(d), pitch = (x) => 190 * 2 ** (-3 * x / d / 12);
    const oo = voice(pitch, d, { vowel: "u", vibrato: 0.6, rate: 4.2, breath: 0.6, seed: 91 });
    const oh = voice(pitch, d, { vowel: "o", vibrato: 0.6, rate: 4.2, breath: 0.6, seed: 92 });
    place(t, shape(mix(shape(oo, (x) => 1 - x / d), shape(oh, (x) => x / d)), env.adsr(0.35, 0.3, 0.7, 0.6)), 0, { gain: 0.5, pan: -0.2 });
    place(t, shape(voice((x) => pitch(x) * 1.498, d, { vowel: "u", vibrato: 0.7, rate: 3.7, breath: 0.8, seed: 93 }), env.adsr(0.5, 0.3, 0.6, 0.6)), 0.05, { gain: 0.2, pan: 0.3 });
    place(t, shape(svf(noise(d, { seed: 94, color: "pink" }), 1200, { q: 0.8, mode: "bpn" }), env.swell(0.6)), 0, { gain: 0.2 });
    return withRoom(chorus(t, { rate: 0.8, depth: 0.004, mix: 0.5 }), { room: 0.9, wet: 0.45, predelay: 0.03 });
  },
  // Crystals flung out when Kaito is hurt: three glass tinks scattering left, right and up, falling in pitch.
  dispersion() {
    const d = 1.0, t = stereo(d);
    for (const [m, when, pan] of [[93, 0, -0.7], [91, 0.06, 0.7], [86, 0.13, 0]]) {
      place(t, shape(fm(midiHz(m), 0.6, { ratio: 3.5, index: (x) => 1.8 * Math.exp(-x / 0.03) }), env.perc(0.001, 0.12)), when, { gain: 0.4, pan });
    }
    place(t, shape(svf(noise(d, { seed: 101, color: "pink" }), 2500, { q: 1, mode: "bpn" }), env.perc(0.005, 0.08)), 0, { gain: 0.2 });
    return withRoom(t, { room: 0.6, wet: 0.2 });
  },
  // Checkpoint: a small temple bell, soft, in a big room.
  checkpoint() {
    const d = 2.2, t = stereo(d);
    place(t, bell(midiHz(86), d, { seed: 111, hardness: 0.4 }), 0, { gain: 0.5, pan: 0.1 });
    place(t, bell(midiHz(93), d, { seed: 112, hardness: 0.3 }), 0.12, { gain: 0.25, pan: -0.2 });
    return withRoom(t, { room: 0.85, wet: 0.35 });
  },
  // A new wave in survival: two blows of the big drum and a low horn swelling under them.
  oleada() {
    const d = 1.4, t = stereo(d);
    place(t, odaiko(1.2, { seed: 121 }), 0, { gain: 0.7 });
    place(t, odaiko(1.2, { seed: 122 }), 0.2, { gain: 0.95 });
    for (const [m, pan] of [[38, -0.3], [45, 0.3], [50, 0]]) place(t, shape(brass(m, 1.0, { seed: 123 + m, open: 1500 }), env.swell(0.5)), 0.2, { gain: 0.18, pan });
    return withRoom(t, { room: 0.8, wet: 0.25 });
  },
  // Menus: a wooden tick to move, a koto dyad to confirm.
  menu_mover() { const t = stereo(0.15); place(t, rim(0.15, { seed: 131 }), 0, { gain: 0.6 }); return withRoom(t, { room: 0.3, wet: 0.08 }); },
  menu_ok() {
    const t = stereo(1.0);
    place(t, koto(74, 1.0), 0, { gain: 0.5, pan: -0.15 });
    place(t, koto(81, 1.0), 0.03, { gain: 0.4, pan: 0.15 });
    return withRoom(t, { room: 0.6, wet: 0.2 });
  },
};
const MONO = new Set(["salto", "golpe", "espada", "dash", "enemigo", "menu_mover"]);
// Effects whose timing is not tied to a key press can be MP3 (smaller); the rest stay WAV, instant to play.
const AS_MP3 = new Set(["checkpoint", "espectro", "oleada", "dispersion", "menu_ok"]);

// ---------- music ----------
const IN = [0, 1, 5, 7, 8], YO = [0, 2, 5, 7, 9];
const deg = (root, d, scale = IN) => root + 12 * Math.floor(d / 5) + scale[((d % 5) + 5) % 5];
// i, bVI, iv and bII of the "in" scale (in degrees from the root): the pad voicing, the bass and the koto's
// four notes. The bII -> i at the end of every cycle is the phrygian cadence that sounds Japanese.
const CHORDS = [
  { pad: [-5, -2, 0, 2], bass: -10, koto: [0, 3, 5, 2] },
  { pad: [-6, -5, -2, 0], bass: -11, koto: [-1, 0, 3, 4] },
  { pad: [-8, -5, -3, -1], bass: -13, koto: [2, 4, 5, 0] },
  { pad: [-4, -3, -1, 1], bass: -9, koto: [1, 2, 4, 6] },
];
// A bar of 16 steps: D = big drum, d = small drum, k = rim, . = rest.
const steps = (pattern) => [...pattern].flatMap((c, i) => (c === "." ? [] : [[c, i]]));

// A level theme, 32 bars: A (groove + melody), A2 (variation, koto counterpoint), a breakdown with a flute
// solo, a build, A3 (melody doubled by the koto). `dark` adds big drums and a choir (the temple), `glass`
// crystal bells (the crystal slabs).
function levelMusic({ root, bpm, s, melodyA, melodyB, solo, octave = 0, dark = false, glass = false }) {
  const bars = 32, song = arrangement({ bpm, bars }), { at, beat } = song, n = (d) => deg(root, d), drums = kit(s, { big: dark });
  const part = (bar) => (bar < 8 ? "A" : bar < 16 ? "A2" : bar < 20 ? "solo" : bar < 24 ? "build" : "A3");
  const step = (bar, i) => at(bar) + (i * beat) / 4;
  const hit = (sig, time, gain, o = {}) => song.add(sig, time + drums.jitter(), { gain: gain * drums.vel(), ...o });
  for (let bar = 0; bar < bars; bar++) {
    const p = part(bar), c = CHORDS[Math.floor(bar / 2) % 4], fill = bar % 8 === 7 && p !== "solo";
    const pattern = p === "solo" ? "D.......D......." : p === "build" ? (bar === 23 ? "D.d.D.d.DdDdDDDD" : "D...k...D...k...") : fill ? "D.d.k.d.DdDdkkkk" : "D...k.d.D.d.k..k";
    for (const [ch, i] of steps(pattern)) {
      const roll = bar === 23 ? 0.55 + 0.45 * (i / 15) : 1;
      if (ch === "D") hit(drums.D(), step(bar, i), (p === "solo" ? 0.5 : 0.85) * roll, { rev: 0.12, pan: -0.05 });
      if (ch === "d") hit(drums.d(), step(bar, i), 0.5 * roll, { rev: 0.12, pan: 0.1 });
      if (ch === "k") hit(drums.k(), step(bar, i), 0.3 * roll, { rev: 0.1, pan: 0.2 });
    }
    if (p === "A") for (let i = 0; i < 16; i += 2) hit(drums.s(), step(bar, i), i % 4 === 0 ? 0.32 : 0.2, { pan: 0.35, rev: 0.05 });
    if (p === "A2" || p === "A3") for (let i = 0; i < 16; i++) hit(drums.s(), step(bar, i), [0.34, 0.14, 0.24, 0.14][i % 4], { pan: 0.35, rev: 0.05 });
    if (p === "build") for (let i = 0; i < 16; i++) hit(drums.s(), step(bar, i), 0.08 + (0.32 * ((bar - 20) * 16 + i)) / 64, { pan: 0.35, rev: 0.05 });
    if (p !== "solo" && p !== "build") for (let i = 2; i < 16; i += 4) hit(drums.h(), step(bar, i), 0.12, { pan: -0.45 });
    // bass: a plucked string an octave over a sine sub (laptop speakers hear the string, headphones the sub)
    const b = n(c.bass);
    if (p === "solo") { if (bar % 2 === 0) song.add(sub(b, 8 * beat), at(bar), { gain: 0.22 }); }
    else for (const [i, len] of [[0, 1.4], [1.5, 0.45], [2, 1.4], [3.5, 0.45]]) {
      song.add(bassPluck(b + 12, len * beat + 0.3), at(bar, i), { gain: 0.38, rev: 0.03 });
      song.add(sub(b, len * beat), at(bar, i), { gain: 0.18 });
    }
    // pad, a chord every two bars (it opens up during the build)
    if (bar % 2 === 0) {
      const cutoff = p === "solo" ? 1700 : p === "build" ? (x) => 900 + 1400 * Math.min(1, ((bar - 20) * 4 * beat + x) / (16 * beat)) : 1000;
      song.addStereo(pad(c.pad.map(n), 8 * beat + 1.2, { cutoff, attack: 0.7, release: 1.2, seed: s + bar }), at(bar), { gain: 0.16, rev: 0.35 });
    }
    // koto
    if (p === "A" || p === "A2" || p === "A3") {
      (bar % 2 ? [0, 1, 2, 3, 3, 2, 1, 2] : [0, 2, 1, 3, 2, 1, 3, 2]).forEach((k, e) =>
        song.add(koto(n(c.koto[k]), 1.1, { t60: 0.9 }), at(bar, e / 2), { gain: e % 2 ? 0.2 : 0.27, pan: -0.35, rev: 0.2, delay: 0.18 }));
      if (p === "A2") for (const bt of [0, 2]) song.add(koto(n(c.koto[2] + 5), 2.0, { t60: 1.8 }), at(bar, bt + 0.5), { gain: 0.16, pan: 0.45, rev: 0.25, delay: 0.25 });
    }
    if (p === "solo") [0, 1, 2, 3].forEach((k) => song.add(koto(n(c.koto[k]), 2.2), at(bar, k), { gain: 0.22, pan: -0.3, rev: 0.3, delay: 0.3 }));
    if (p === "build") {
      const per = bar < 22 ? 2 : 4;
      for (let e = 0; e < 4 * per; e++) song.add(koto(n(c.koto[e % 4]), 0.6, { t60: 0.5 }), at(bar, e / per), { gain: 0.12 + (0.1 * (bar - 20)) / 3, pan: -0.3, rev: 0.2 });
    }
    if (glass && (p === "A2" || p === "A3")) for (let i = 1; i < 16; i += 2) song.add(glassBell(n(c.koto[(i >> 1) % 4] + 10)), step(bar, i), { gain: 0.06, pan: i % 4 === 1 ? -0.6 : 0.6, delay: 0.3, rev: 0.3 });
    if (dark && p !== "build" && bar % 2 === 0) for (const [k, pan] of [[1, -0.4], [2, 0.4]]) {
      song.add(shape(voice(midiHz(n(c.pad[k])), 8 * beat + 0.8, { vowel: "o", vibrato: 0.2, breath: 0.2, seed: s + bar + k }), env.adsr(0.9, 0.5, 0.8, 0.8)), at(bar), { gain: 0.07, pan, rev: 0.5 });
    }
  }
  // the shakuhachi carries the melody; in A3 the koto doubles it an octave up
  const lead = (notes, fromBar, o = {}) => notes.forEach(([d, start, len], i) => song.add(
    shaku(n(d + octave), len * beat + 0.2, { vibrato: len >= 3 ? 0.3 : 0.12, scoop: i % 3 === 0 ? -0.6 : -0.25, ...o }),
    at(fromBar) + start * beat, { gain: 0.3, pan: 0.15, rev: 0.35, delay: 0.12 }));
  lead(melodyA, 0); lead(melodyB, 8); lead(solo, 16, { breath: 0.4 }); lead(melodyA, 24);
  for (const [d, start, len] of melodyA) song.add(koto(n(d + octave + 5), Math.min(2, len * beat + 0.5), { t60: 1.2 }), at(24) + start * beat, { gain: 0.14, pan: 0.4, rev: 0.25, delay: 0.2 });
  for (const bar of [0, 8, 16, 24]) song.add(bell(midiHz(n(10)), 3, { seed: s + 100 + bar }), at(bar), { gain: 0.12, pan: 0.25, rev: 0.6 });
  return song.render({ room: dark ? 0.9 : 0.82, damp: 0.45, echoTime: beat * 0.75, feedback: 0.3 });
}

// The Dark Sorceress, 24 bars at 148 BPM in E: odaiko and a growling bass riff, a shamisen riff, a choir in
// the second part, a half-time breakdown with a gong and a riser back into the loop.
function bossMusic() {
  const root = 64, bars = 24, song = arrangement({ bpm: 148, bars }), { at, beat } = song, n = (d) => deg(root, d), drums = kit(900, { big: true });
  const part = (bar) => (bar < 8 ? "A" : bar < 16 ? "B" : bar < 20 ? "C" : "build");
  const order = [0, 3, 2, 3], shift = [0, 1, 2, 1];   // i, bII, iv, bII; the riffs move with the chord
  const step = (bar, i) => at(bar) + (i * beat) / 4;
  const hit = (sig, time, gain, o = {}) => song.add(sig, time + drums.jitter(), { gain: gain * drums.vel(), ...o });
  const RIFF = [[0, 0], [2, 0], [3, 5], [4, 0], [6, 1], [8, 0], [10, 0], [11, 5], [12, 1], [14, 2]];
  const riffA = [0, 3, 2, 3, 0, 1, 0, -2], riffB = [0, 0, 3, 2, 0, 1, 0, -2, 0, 0, 3, 4, 3, 2, 1, -2];
  for (let bar = 0; bar < bars; bar++) {
    const p = part(bar), c = CHORDS[order[Math.floor(bar / 2) % 4]], sh = shift[Math.floor(bar / 2) % 4];
    const pattern = p === "C" ? "D..............." : p === "build" ? (bar === 23 ? "DdDdDdDdDDDDDDDD" : "D...k...D...k.d.") : p === "B" ? "D..dk.d.D..dk.dd" : "D...k.d.D...k.dd";
    for (const [ch, i] of steps(pattern)) {
      const roll = bar === 23 ? 0.5 + 0.5 * (i / 15) : 1;
      if (ch === "D") hit(drums.D(), step(bar, i), 0.9 * roll, { rev: 0.15 });
      if (ch === "d") hit(drums.d(), step(bar, i), 0.5 * roll, { rev: 0.12, pan: 0.15 });
      if (ch === "k") hit(drums.k(), step(bar, i), 0.32, { rev: 0.1, pan: -0.2 });
    }
    if (p === "A" || p === "B") for (let i = 0; i < 16; i++) hit(drums.s(), step(bar, i), [0.32, 0.14, 0.22, 0.14][i % 4], { pan: 0.35, rev: 0.05 });
    if (p === "build") for (let i = 0; i < 16; i++) hit(drums.s(), step(bar, i), 0.1 + (0.35 * ((bar - 20) * 16 + i)) / 64, { pan: 0.35, rev: 0.05 });
    if (p === "C") { if (bar % 2 === 0) song.add(sub(n(c.bass), 8 * beat), at(bar), { gain: 0.25 }); }
    else for (const [i, d] of RIFF) song.add(sawBass(n(c.bass + d), 0.14), step(bar, i), { gain: 0.3 });
    if (p === "A") riffA.forEach((d, e) => song.add(shamisen(n(d + sh)), at(bar, e / 2), { gain: 0.22, pan: 0.3, rev: 0.12 }));
    if (p === "B" || p === "build") riffB.forEach((d, e) => song.add(shamisen(n(d + sh), 0.45), at(bar, e / 4), { gain: e % 4 === 0 ? 0.22 : 0.15, pan: 0.3, rev: 0.12 }));
    if (p === "C") for (let e = 0; e < 32; e++) song.add(shamisen(n(sh + (bar % 2 ? 2 : 0)), 0.25, { t60: 0.25 }), at(bar, e / 8), { gain: 0.08 + 0.05 * Math.sin(e / 5), pan: 0.3 });
    if ((p === "B" || p === "C") && bar % 2 === 0) c.pad.slice(0, 3).forEach((d, k) => song.add(
      shape(voice(midiHz(n(d)), 8 * beat + 0.6, { vowel: "a", vibrato: 0.25, breath: 0.12, seed: 950 + bar * 3 + k }), env.adsr(0.5, 0.4, 0.85, 0.6)),
      at(bar), { gain: 0.09, pan: [-0.5, 0, 0.5][k], rev: 0.5 }));
    if (p === "A" && bar % 2 === 0) song.addStereo(pad(c.pad.map(n), 8 * beat + 1, { cutoff: 700, attack: 0.4, seed: 980 + bar }), at(bar), { gain: 0.12, rev: 0.3 });
    if (p === "B" && bar % 2 === 1) song.add(shaku(n([8, 9, 8, 7][(bar - 9) / 2]), 1.6 * beat + 0.3, { breath: 0.65, scoop: -1, vibrato: 0.35 }), at(bar), { gain: 0.22, pan: -0.25, rev: 0.4, delay: 0.15 });
  }
  song.add(gong(92, 5, { seed: 901 }), at(0), { gain: 0.18, rev: 0.4 });
  song.add(gong(88, 6, { seed: 902 }), at(16), { gain: 0.32, rev: 0.5 });
  const rise = 8 * beat;
  // the riser stops on the downbeat of the loop, eased out over its last 30 ms so it does not click
  song.add(shape(svf(noise(rise, { seed: 903 }), (x) => 300 * 2 ** ((x / rise) * 4.5), { q: 2.5, mode: "bpn" }), (x) => (x / rise) ** 2 * Math.min(1, (rise - x) / 0.03)), at(22), { gain: 0.25, rev: 0.3 });
  return song.render({ room: 0.8, damp: 0.5, echoTime: beat * 0.75, feedback: 0.25 });
}

// The menu and the credits: slow koto arpeggios that sometimes bend a note (oshide), a shakuhachi melody, a
// wide pad, wind and a temple bell. No drums but a far heartbeat.
function menuMusic() {
  const root = 62, bars = 16, song = arrangement({ bpm: 76, bars }), { at, beat } = song, n = (d) => deg(root, d);
  for (let bar = 0; bar < bars; bar++) {
    const c = CHORDS[Math.floor(bar / 4) % 4];
    if (bar % 4 === 0) song.addStereo(pad(c.pad.map(n), 16 * beat + 2, { cutoff: 850, attack: 2, release: 2, seed: 700 + bar, detune: 0.1 }), at(bar), { gain: 0.2, rev: 0.5 });
    (bar % 2 ? [3, 2, 1, 0] : [0, 1, 2, 3]).forEach((k, e) => {
      const d = c.koto[k], step = ((d % 5) + 5) % 5, pressed = e === 3 && bar % 2 === 1 && [0, 2, 3].includes(step);
      const o = pressed ? { bend: (t) => (t > 0.35 ? Math.min(1, (t - 0.35) / 0.15) * (step === 2 ? 2 : 1) : 0) } : {};
      song.add(koto(n(d), 2.6, { t60: 2.4, ...o }), at(bar, e), { gain: 0.24, pan: -0.3, rev: 0.35, delay: 0.3 });
    });
    if (bar % 2 === 1) song.add(svf(odaiko(2, { seed: 760 + bar, click: 0.05 }), 400), at(bar), { gain: 0.16, rev: 0.3 });
  }
  const melody = [[5, 8, 4], [3, 12, 2], [4, 14, 2], [3, 16, 6], [2, 22, 2], [0, 24, 8], [7, 40, 4], [8, 44, 2], [7, 46, 2], [5, 48, 6], [6, 54, 2], [5, 56, 8]];
  melody.forEach(([d, start, len], i) => song.add(shaku(n(d), len * beat + 0.3, { vibrato: 0.35, rate: 4.5, scoop: i % 2 ? -0.3 : -0.8, breath: 0.4 }), start * beat, { gain: 0.26, pan: 0.15, rev: 0.45, delay: 0.15 }));
  for (const bar of [0, 8]) song.add(bell(midiHz(n(10)), 4, { seed: 750 + bar }), at(bar), { gain: 0.1, pan: 0.3, rev: 0.7 });
  const L = song.length;
  song.add(shape(svf(noise(L, { seed: 790, color: "pink" }), (x) => 500 + 250 * Math.sin((2 * Math.PI * x * 3) / L), { q: 0.6, mode: "bpn" }),
    (x) => 0.6 + 0.4 * Math.sin((2 * Math.PI * x * 2) / L)), 0, { gain: 0.05 });
  return song.render({ room: 0.92, damp: 0.35, echoTime: beat * 0.75, feedback: 0.35 });
}

// ---------- jingles ----------
// The portal opens: a swell sucked in backwards (the reversed reverb of the chord), then bells open the way.
function portal() {
  const d = 2.6, t = stereo(d), hitAt = 0.55, chord = stereo(1.2);
  [74, 81, 87].forEach((m, i) => place(chord, bell(midiHz(m), 1.2, { seed: 141 + i }), 0, { gain: 0.3, pan: i - 1 }));
  const wet = reverb(chord, { room: 0.9, tail: 0.6 }), keep = sec(hitAt);
  placeStereo(t, { L: reverse(wet.L).subarray(wet.L.length - keep), R: reverse(wet.R).subarray(wet.R.length - keep) }, 0, { gain: 0.8 });
  [74, 79, 81, 86, 91].forEach((m, i) => place(t, glassBell(m), hitAt + i * 0.07, { gain: 0.35, pan: -0.6 + i * 0.3 }));
  place(t, bell(midiHz(62), 2, { seed: 146 }), hitAt, { gain: 0.25 });
  return withEcho(withRoom(t, { room: 0.85, wet: 0.35 }), { time: 0.14, feedback: 0.35, wet: 0.2 });
}
// A level cleared: the koto runs up, a drum answers and the bell rings, the flute sings the top note.
function completado() {
  const song = arrangement({ bpm: 120, bars: 1, loop: false, tail: 1.6 }), n = (d) => deg(62, d);
  song.add(taiko(1.2, { seed: 500 }), 0, { gain: 0.6, rev: 0.2 });
  song.add(odaiko(2.2, { seed: 501 }), 0.36, { gain: 0.85, rev: 0.25 });
  [0, 2, 3, 5, 7].forEach((d, i) => song.add(koto(n(d), 1.6, { t60: 1.5 }), i * 0.07, { gain: 0.25, pan: -0.4 + i * 0.2, rev: 0.3, delay: 0.15 }));
  song.add(bell(midiHz(n(8)), 2.5, { seed: 502 }), 0.36, { gain: 0.16, rev: 0.5, pan: 0.3 });
  song.add(shaku(n(10), 0.9, { vibrato: 0.3, scoop: -0.7, breath: 0.35 }), 0.4, { gain: 0.25, rev: 0.4, pan: 0.1 });
  return song.render({ room: 0.85, damp: 0.4, echoTime: 0.25, feedback: 0.3 });
}
// Victory: a shime roll into the big drum, a brass chord over a koto glissando up the bright "yo" scale, the
// shakuhachi singing it out and a last blow.
function victoria() {
  const song = arrangement({ bpm: 120, bars: 2, loop: false, tail: 2.5 }), n = (d) => deg(62, d, YO);
  for (let i = 0; i < 12; i++) song.add(shime(0.25, { seed: 300 + i }), i * 0.0625, { gain: 0.15 + (0.35 * i) / 11, pan: 0.3, rev: 0.1 });
  song.add(odaiko(2.5, { seed: 320 }), 0.75, { gain: 0.95, rev: 0.25 });
  song.add(bell(midiHz(86), 3, { seed: 321 }), 0.75, { gain: 0.2, rev: 0.5, pan: 0.3 });
  for (const [m, pan] of [[50, -0.4], [57, 0.4], [62, -0.2], [64, 0.2], [69, 0]]) song.add(brass(m, 2.0, { seed: 330 + m }), 0.75, { gain: 0.14, pan, rev: 0.35 });
  for (let i = 0; i < 11; i++) song.add(koto(n(i), 1.5, { t60: 1.4 }), 0.75 + i * 0.03, { gain: 0.2, pan: -0.6 + i * 0.12, rev: 0.3 });
  for (const [d, when, len] of [[8, 1.0, 0.6], [9, 1.6, 0.3], [10, 1.9, 1.6]]) song.add(shaku(n(d), len, { vibrato: 0.35, scoop: -0.5, breath: 0.3 }), when, { gain: 0.26, pan: 0.1, rev: 0.4, delay: 0.12 });
  song.add(taiko(1.2, { seed: 340 }), 2.4, { gain: 0.6, rev: 0.2 });
  song.add(taiko(1.2, { seed: 341 }), 2.6, { gain: 0.7, rev: 0.2 });
  song.add(odaiko(2.5, { seed: 342 }), 2.85, { gain: 1, rev: 0.3 });
  for (const [m, pan] of [[50, -0.4], [57, 0.4], [64, -0.2], [69, 0.2], [74, 0]]) song.add(brass(m, 2.2, { seed: 350 + m }), 2.85, { gain: 0.14, pan, rev: 0.4 });
  return song.render({ room: 0.88, damp: 0.4, echoTime: 0.25, feedback: 0.3 });
}
// Game over: a low blow and a soft gong, the koto falling with a sigh (a note pressed down) over a dark pad.
function derrota() {
  const song = arrangement({ bpm: 60, bars: 1, loop: false, tail: 1.8 }), n = (d) => deg(62, d);
  song.add(odaiko(2.5, { seed: 400, from: 80, to: 38 }), 0, { gain: 0.8, rev: 0.3 });
  song.add(gong(70, 4, { seed: 401 }), 0, { gain: 0.15, rev: 0.4 });
  [[3, 0.25], [2, 0.7], [1, 1.15], [0, 1.65]].forEach(([d, when], i) => song.add(
    koto(n(d), 2.4, { t60: 2.2, ...(i === 2 ? { bend: (t) => -Math.min(1, Math.max(0, (t - 0.3) / 0.25)) } : {}) }),
    when, { gain: 0.3, pan: -0.2 + 0.1 * i, rev: 0.4, delay: 0.2 }));
  song.addStereo(pad([n(-5), n(-4), n(-2)], 3.5, { cutoff: 700, attack: 0.8, release: 1.5, seed: 402 }), 0.2, { gain: 0.15, rev: 0.5 });
  return song.render({ room: 0.9, damp: 0.4, echoTime: 0.375, feedback: 0.3 });
}

// Level melodies: [degree of the "in" scale, start beat, length in beats].
const THEMES = {
  musica_nivel: { root: 62, bpm: 124, s: 2026,   // Tutorial and Nivel 1, in D: the path of the ninja
    melodyA: [[3, 0, 3], [4, 3, 1], [3, 4, 2], [2, 6, 2], [5, 8, 3], [6, 11, 1], [5, 12, 4], [4, 16, 2], [3, 18, 1], [2, 19, 1], [2, 20, 3], [3, 23, 1], [4, 24, 2], [3, 26, 1], [2, 27, 1], [2, 28, 2], [1, 30, 2]],
    melodyB: [[5, 0, 2], [6, 2, 1], [5, 3, 1], [3, 4, 4], [7, 8, 2], [8, 10, 2], [9, 12, 3], [8, 15, 1], [7, 16, 4], [5, 20, 2], [6, 22, 2], [5, 24, 2], [4, 26, 2], [3, 28, 4]],
    solo: [[5, 0, 4], [8, 4, 3], [7, 7, 1], [8, 8, 6]] },
  musica_nivel2: { root: 57, bpm: 132, s: 2027, octave: 5, glass: true,   // Nivel 2, in A, quicker, with crystal bells
    melodyA: [[5, 0, 1], [6, 1, 0.5], [5, 1.5, 0.5], [3, 2, 2], [4, 4, 1], [3, 5, 1], [2, 6, 2], [3, 8, 1.5], [5, 9.5, 0.5], [6, 10, 2], [5, 12, 4], [7, 16, 1], [6, 17, 1], [5, 18, 2], [4, 20, 1], [5, 21, 1], [3, 22, 2], [2, 24, 1], [3, 25, 1], [4, 26, 1], [3, 27, 1], [1, 28, 2], [0, 30, 2]],
    melodyB: [[8, 0, 2], [7, 2, 1], [8, 3, 1], [9, 4, 3], [8, 7, 1], [7, 8, 2], [5, 10, 2], [6, 12, 4], [5, 16, 1], [6, 17, 1], [7, 18, 2], [8, 20, 3], [7, 23, 1], [6, 24, 2], [5, 26, 2], [3, 28, 4]],
    solo: [[8, 0, 4], [7, 4, 2], [5, 6, 2], [6, 8, 6], [5, 14, 2]] },
  musica_nivel3: { root: 64, bpm: 116, s: 2028, dark: true,   // Nivel 3, in E: the temple of the Red Moon
    melodyA: [[3, 0, 4], [4, 4, 2], [3, 6, 2], [2, 8, 6], [1, 14, 2], [0, 16, 4], [1, 20, 2], [2, 22, 2], [3, 24, 6], [2, 30, 2]],
    melodyB: [[5, 0, 4], [6, 4, 2], [5, 6, 2], [8, 8, 4], [7, 12, 4], [5, 16, 4], [6, 20, 2], [4, 22, 2], [3, 24, 8]],
    solo: [[8, 0, 6], [9, 6, 2], [8, 8, 8]] },
};

// The instruments and pieces, for the trailer's music (tools/video).
export { koto, shamisen, bassPluck, sub, sawBass, shaku, glassBell, kit, withRoom, withEcho, deg, IN, YO, CHORDS, steps, levelMusic, bossMusic, menuMusic, THEMES };

// ---------- files ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const only = process.argv.slice(2);   // names to render again (all of them by default)
const want = (name) => !only.length || only.includes(name);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });
if (!only.length) for (const f of fs.readdirSync(OUT)) if (/\.(wav|mp3)$/i.test(f)) fs.unlinkSync(path.join(OUT, f));
const fadeOut = (t, seconds = 0.02) => { const n = t.L.length, k = Math.min(n, sec(seconds)); for (let i = 0; i < k; i++) { const g = i / k; t.L[n - 1 - i] *= g; t.R[n - 1 - i] *= g; } return t; };
function save(name, track, { format = "wav", mono = false, lufs = -12, loop = false }) {
  let t = loop ? track : fadeOut(track);
  if (mono) { const m = t.L.map((v, i) => (v + t.R[i]) / 2); t = { L: m, R: m }; }
  const mastered = master(t, { lufs, short: !loop, loop });
  const file = path.join(OUT, `${name}.${format}`);
  if (format === "wav") fs.writeFileSync(file, wav(mastered, { mono }));
  else {
    const tmp = path.join(CACHE, `${name}.wav`);
    fs.writeFileSync(tmp, wav(mastered));
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "160k", "-map_metadata", "-1", "-id3v2_version", "0", "-write_id3v1", "0", file]);
  }
  const level = loop ? `${loudness(mastered).toFixed(1)} LUFS` : `${momentary(mastered).toFixed(1)} LUFS momentáneo`;
  let seam = "";
  if (loop) { // the jump across the loop point compared with the loudest jump inside the track
    let inside = 0;
    for (let i = 1; i < mastered.L.length; i++) inside = Math.max(inside, Math.abs(mastered.L[i] - mastered.L[i - 1]));
    seam = `, costura ${(Math.abs(mastered.L[0] - mastered.L[mastered.L.length - 1]) / inside * 100).toFixed(1)} % del salto máximo`;
  }
  console.log(`${name}.${format}: ${(t.L.length / SR).toFixed(2)} s, ${level}, pico ${peakDb(mastered).toFixed(1)} dBFS, ${Math.round(fs.statSync(file).size / 1024)} KB${seam}`);
}
for (const [name, make] of Object.entries(SFX)) if (want(name)) save(name, make(), { mono: MONO.has(name), format: AS_MP3.has(name) ? "mp3" : "wav" });
for (const [name, make] of Object.entries({ portal, completado, victoria, derrota })) if (want(name)) save(name, make(), { format: "mp3", lufs: -13 });
if (want("musica_menu")) save("musica_menu", menuMusic(), { format: "mp3", lufs: -15, loop: true });
for (const [name, theme] of Object.entries(THEMES)) if (want(name)) save(name, levelMusic(theme), { format: "mp3", lufs: -14, loop: true });
if (want("musica_jefe")) save("musica_jefe", bossMusic(), { format: "mp3", lufs: -14, loop: true });
}
