// The game's sound engine: a small offline synthesizer with no dependencies. Instead of bare chip waves it
// renders the sound the way a small studio session would (docs/sonido.md explains the choices and sources):
// band-limited oscillators (PolyBLEP, without the aliasing buzz of naive square waves), a state-variable
// filter, FM and additive bells, plucked strings (Karplus-Strong, for the koto and the shamisen), a breathy
// flute (shakuhachi), drums built from a falling pitch plus noise (taiko), formant voices, a stereo reverb
// (Freeverb), a ping-pong delay, chorus, a look-ahead limiter and loudness measured as ITU-R BS.1770 does.
// Everything is deterministic: the same seed renders the same samples.

export const SR = 44100;
export const sec = (s) => Math.max(0, Math.round(s * SR));
export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
export const db = (d) => 10 ** (d / 20);
const fnOf = (x) => (typeof x === "function" ? x : () => x);
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function random(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- buffers ----------
export function stereo(seconds) { const n = sec(seconds); return { L: new Float32Array(n), R: new Float32Array(n) }; }
// Adds a mono signal at `at` seconds with a gain and an equal-power pan (-1 left .. 1 right; a number or a
// function of the time in the signal). With `loop`, what passes the end comes back in at the start (and a hit
// played a hair early on the first beat starts at the end).
export function place(dst, sig, at = 0, { gain = 1, pan = 0, loop = false } = {}) {
  const n = dst.L.length, start = Math.round(at * SR), p = fnOf(pan), fixed = typeof pan !== "function";
  let gl = 0, gr = 0;
  const setPan = (x) => { const a = (Math.max(-1, Math.min(1, x)) + 1) * Math.PI / 4; gl = Math.cos(a) * gain; gr = Math.sin(a) * gain; };
  if (fixed) setPan(pan);
  for (let i = 0; i < sig.length; i++) {
    let j = start + i;
    if (j < 0 || j >= n) { if (!loop) { if (j < 0) continue; break; } j = ((j % n) + n) % n; }
    if (!fixed) setPan(p(i / SR));
    dst.L[j] += sig[i] * gl; dst.R[j] += sig[i] * gr;
  }
  return dst;
}
export function placeStereo(dst, src, at = 0, { gain = 1, loop = false } = {}) {
  const n = dst.L.length, start = Math.round(at * SR);
  for (let i = 0; i < src.L.length; i++) {
    let j = start + i;
    if (j < 0 || j >= n) { if (!loop) { if (j < 0) continue; break; } j = ((j % n) + n) % n; }
    dst.L[j] += src.L[i] * gain; dst.R[j] += src.R[i] * gain;
  }
  return dst;
}
// Sums signals ([signal, gain] pairs or bare signals); the result is as long as the longest.
export function mix(...parts) {
  const list = parts.map((p) => (Array.isArray(p) ? p : [p, 1]));
  const out = new Float32Array(Math.max(...list.map(([s]) => s.length)));
  for (const [s, g] of list) for (let i = 0; i < s.length; i++) out[i] += s[i] * g;
  return out;
}
export function sumStereo(...tracks) {
  const n = Math.max(...tracks.map((t) => t.L.length)), out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const t of tracks) placeStereo(out, t, 0);
  return out;
}
export const reverse = (sig) => Float32Array.from(sig).reverse();
export function delayed(sig, seconds) { const out = new Float32Array(sig.length + sec(seconds)); out.set(sig, sec(seconds)); return out; }
export function drive(sig, amount = 2) { const k = Math.tanh(amount); for (let i = 0; i < sig.length; i++) sig[i] = Math.tanh(sig[i] * amount) / k; return sig; }
// Multiplies a signal in place by an envelope f(t, length in seconds).
export function shape(sig, envelope) { const len = sig.length / SR; for (let i = 0; i < sig.length; i++) sig[i] *= envelope(i / SR, len); return sig; }
export const env = {
  // a fast rise, then an exponential fall (tau: seconds to fall to 37 %)
  perc: (attack, tau) => (t) => (t < attack ? smooth(t / attack) : Math.exp(-(t - attack) / tau)),
  // attack, decay to a sustain level, release at the end of the signal
  adsr: (a, d, s, r) => (t, len) => {
    let v = t < a ? smooth(t / a) : t < a + d ? 1 - (1 - s) * smooth((t - a) / d) : s;
    if (t > len - r) v *= smooth((len - t) / r);
    return v;
  },
  // rises for `rise` seconds, then falls over the rest of the signal
  swell: (rise, power = 2) => (t, len) => (t < rise ? (t / rise) ** power : Math.max(0, 1 - (t - rise) / Math.max(1e-3, len - rise)) ** 1.5),
};

// ---------- sources ----------
function blep(t, dt) { // PolyBLEP: rounds each jump of the wave over about one sample
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
// sine | saw | square | tri, with a frequency in Hz (a number or a function of the time).
export function osc(type, freq, seconds, { phase = 0, width = 0.5 } = {}) {
  const n = sec(seconds), out = new Float32Array(n), f = fnOf(freq);
  let ph = phase % 1;
  for (let i = 0; i < n; i++) {
    const dt = Math.min(0.45, Math.max(0, f(i / SR) / SR));
    let v;
    if (type === "sine") v = Math.sin(2 * Math.PI * ph);
    else if (type === "saw") v = 2 * ph - 1 - blep(ph, dt);
    else if (type === "square") v = (ph < width ? 1 : -1) + blep(ph, dt) - blep((ph + 1 - width) % 1, dt);
    else v = 1 - 4 * Math.abs(ph - 0.5);
    out[i] = v;
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return out;
}
// Two-operator FM (Chowning): ratio = modulator / carrier, index (a number or a function) = brightness.
export function fm(freq, seconds, { ratio = 1, index = 1 } = {}) {
  const n = sec(seconds), out = new Float32Array(n), f = fnOf(freq), ix = fnOf(index);
  let pc = 0, pm = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, fc = f(t);
    out[i] = Math.sin(2 * Math.PI * pc + ix(t) * Math.sin(2 * Math.PI * pm));
    pc += fc / SR; pm += (fc * ratio) / SR;
    pc -= Math.floor(pc); pm -= Math.floor(pm);
  }
  return out;
}
// Inharmonic partials [ratio, gain, decay seconds] for bells, gongs and blades. `beat` adds a twin of each
// partial that many Hz away: the slow shimmer of a real bell.
export function partials(freq, seconds, list, { beat = 0, seed = 1 } = {}) {
  const n = sec(seconds), out = new Float32Array(n), r = random(seed);
  for (const [ratio, gain, decay] of list) {
    const fr = freq * ratio, ph = r(), ph2 = r();
    if (fr >= SR * 0.45) continue;
    for (let i = 0; i < n; i++) {
      // random phases sound natural but start off zero: a 1.5 ms fade-in keeps the strike from clicking
      const t = i / SR, e = gain * Math.exp(-t / decay) * (t < 0.0015 ? smooth(t / 0.0015) : 1);
      if (e < 1e-5 && t > 0.01) break;
      let v = Math.sin(2 * Math.PI * (fr * t + ph));
      if (beat) v = 0.5 * (v + Math.sin(2 * Math.PI * ((fr + beat) * t + ph2)));
      out[i] += v * e;
    }
  }
  return out;
}
// white | pink (Paul Kellet's filter) | brown
export function noise(seconds, { seed = 1, color = "white" } = {}) {
  const n = sec(seconds), out = new Float32Array(n), r = random(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    if (color === "white") out[i] = w;
    else if (color === "pink") {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else { br = (br + 0.02 * w) / 1.02; out[i] = br * 3.5; }
  }
  return out;
}

// ---------- filters ----------
// State-variable filter (Zavalishin's TPT form): lp | bp (peak gain = q) | bpn (unity peak) | hp | notch; the
// cutoff in Hz can be a function of the time.
export function svf(sig, cutoff, { q = 0.707, mode = "lp" } = {}) {
  const out = new Float32Array(sig.length), f = fnOf(cutoff), k = 1 / q;
  let ic1 = 0, ic2 = 0, last = -1, a1 = 0, a2 = 0, a3 = 0;
  for (let i = 0; i < sig.length; i++) {
    const fc = Math.min(SR * 0.45, Math.max(10, f(i / SR)));
    if (fc !== last) { const g = Math.tan((Math.PI * fc) / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; last = fc; }
    const v0 = sig[i], v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    out[i] = mode === "lp" ? v2 : mode === "bp" ? v1 : mode === "bpn" ? k * v1 : mode === "hp" ? v0 - k * v1 - v2 : v0 - k * v1;
  }
  return out;
}
export function onePole(sig, cutoff, mode = "lp") {
  const out = new Float32Array(sig.length), f = fnOf(cutoff);
  let y = 0;
  for (let i = 0; i < sig.length; i++) {
    y += (1 - Math.exp((-2 * Math.PI * f(i / SR)) / SR)) * (sig[i] - y);
    out[i] = mode === "lp" ? y : sig[i] - y;
  }
  return out;
}
// The body of an instrument: the dry sound plus a few resonances [Hz, q, gain].
export function body(sig, resonances) { return mix(sig, ...resonances.map(([f, q, g]) => [svf(sig, f, { q, mode: "bpn" }), g])); }

// ---------- instruments ----------
// Plucked string (Karplus-Strong with the Jaffe-Smith extensions): a burst of noise runs round a delay line one
// period long and the averaging in the loop dulls its highs as a real string does. t60: seconds to fall 60 dB;
// bright (0..1): how hard it is plucked; pick (0..0.5): where (near the bridge is nasal, like a koto);
// damp (0..0.5): how fast the highs die; bend(t): semitones, for the pressed-string bends of the koto.
export function pluck(freq, seconds, { seed = 1, t60 = 1.5, bright = 0.7, pick = 0.13, damp = 0.5, bend = null } = {}) {
  const n = sec(seconds), out = new Float32Array(n), r = random(seed);
  const size = 4096, mask = size - 1, line = new Float32Array(size);
  const P = Math.max(2, Math.round(SR / freq)), exc = new Float32Array(P);
  let lp = 0;
  const a = 0.05 + 0.95 * bright;
  for (let i = 0; i < P; i++) { lp += a * (r() * 2 - 1 - lp); exc[i] = lp; }
  const pk = Math.max(1, Math.round(pick * P));
  for (let i = P - 1; i >= pk; i--) exc[i] -= exc[i - pk];
  let mean = 0;
  for (const v of exc) mean += v;
  mean /= P;
  for (let i = 0; i < P; i++) exc[i] -= mean;
  const loss = 10 ** (-3 / (freq * t60));
  const read = (w, d) => { const di = Math.floor(d), fr = d - di, x0 = line[(w - di) & mask], x1 = line[(w - di - 1) & mask]; return x0 + fr * (x1 - x0); };
  const ramp = sec(0.0007);   // a plectrum is fast, not instantaneous: no digital click at the pluck
  let w = 0;
  for (let i = 0; i < n; i++) {
    const f = bend ? freq * 2 ** (bend(i / SR) / 12) : freq;
    const D = Math.max(1, SR / f - damp);   // the averaging adds `damp` samples of delay
    const y = (i < P ? exc[i] : 0) + loss * ((1 - damp) * read(w, D) + damp * read(w, D + 1));
    line[w] = y; out[i] = i < ramp ? y * smooth(i / ramp) : y;
    w = (w + 1) & mask;
  }
  return out;
}
// A breathy end-blown flute (shakuhachi): a mostly sine tone with weak harmonics, breath noise tuned to the
// note and a chiff of air at the attack. It scoops up to the note (meri-kari) and its vibrato comes in late.
export function flute(freq, seconds, { seed = 1, breath = 0.3, vibrato = 0.22, rate = 5, scoop = -0.5, attack = 0.09, release = 0.16 } = {}) {
  const n = sec(seconds), tone = new Float32Array(n);
  const pitch = (t) => freq * 2 ** ((scoop * Math.exp(-t / 0.07) + vibrato * smooth((t - 0.3) / 0.5) * Math.sin(2 * Math.PI * rate * t)) / 12);
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < n; i++) {
    const f = pitch(i / SR);
    tone[i] = Math.sin(2 * Math.PI * p1) + 0.22 * Math.sin(2 * Math.PI * p2) + 0.07 * Math.sin(2 * Math.PI * p3);
    p1 = (p1 + f / SR) % 1; p2 = (p2 + (2 * f) / SR) % 1; p3 = (p3 + (3 * f) / SR) % 1;
  }
  const blow = (t, len) => smooth(t / attack) * smooth((len - t) / release) * (1 + 0.06 * Math.sin(2 * Math.PI * 4.3 * t));
  const chiff = (t) => Math.exp(-t / 0.04);
  shape(tone, blow);
  const air = shape(svf(noise(seconds, { seed, color: "pink" }), (t) => pitch(t) * 2, { q: 4, mode: "bpn" }), (t, len) => 0.8 * blow(t, len) + 1.6 * chiff(t));
  const hiss = shape(svf(noise(seconds, { seed: seed + 1 }), 5000, { mode: "hp" }), (t, len) => 0.25 * blow(t, len) + 0.5 * chiff(t));
  return mix(tone, [air, breath], [hiss, breath * 0.3]);
}
// A drum: a membrane whose pitch falls from `from` to `to` Hz, an inharmonic upper mode, a slap of band-passed
// noise and the click of the stick. Big and low = odaiko; small, tight and high = shime-daiko.
export function drum(seconds, { from = 150, to = 72, sweep = 0.035, decay = 0.42, slap = 0.35, slapHz = 500, click = 0.2, seed = 1, sat = 1.5 } = {}) {
  const f = (t) => to + (from - to) * Math.exp(-t / sweep);
  const skinMode = shape(osc("sine", f, seconds), (t) => Math.exp(-t / decay));
  const upper = shape(osc("sine", (t) => 1.59 * f(t), seconds), (t) => 0.3 * Math.exp(-t / (decay * 0.35)));
  const hit = shape(svf(noise(seconds, { seed }), slapHz, { q: 1.1, mode: "bpn" }), (t) => slap * Math.exp(-t / 0.03));
  const stick = shape(onePole(noise(seconds, { seed: seed + 7 }), 3000, "hp"), (t) => click * smooth(t / 0.0003) * Math.exp(-t / 0.003));
  const out = mix(skinMode, upper, hit, stick);
  return sat ? drive(out, sat) : out;
}
export const taiko = (seconds = 1.2, o = {}) => drum(seconds, o);
export const odaiko = (seconds = 2.2, o = {}) => drum(seconds, { from: 105, to: 46, sweep: 0.05, decay: 0.85, slapHz: 320, ...o });
export const shime = (seconds = 0.25, o = {}) => drum(seconds, { from: 470, to: 330, sweep: 0.008, decay: 0.07, slap: 0.6, slapHz: 2400, click: 0.35, sat: 1.2, ...o });
// "ka": the stick on the rim of the drum, a dry wooden click.
export function rim(seconds = 0.12, { seed = 1 } = {}) {
  const wood = shape(svf(noise(seconds, { seed }), 1900, { q: 3, mode: "bpn" }), (t) => Math.exp(-t / 0.012));
  const ping = shape(osc("sine", 1250, seconds), (t) => 0.5 * Math.exp(-t / 0.01));
  return mix(wood, ping);
}
export function shaker(seconds = 0.12, { seed = 1 } = {}) {
  return shape(svf(noise(seconds, { seed }), 7000, { q: 0.8, mode: "hp" }), (t) => smooth(t / 0.008) * Math.exp(-t / 0.035));
}
// A small temple bell (kane / rin).
export function bell(freq, seconds = 3, { seed = 1, hardness = 0.6 } = {}) {
  const tone = partials(freq, seconds, [[1, 1, 2.6], [2.32, 0.55, 1.3], [4.25, 0.35, 0.7], [6.63, 0.2, 0.4], [9.38, 0.12, 0.22]], { beat: 0.7, seed });
  const strike = shape(svf(noise(seconds, { seed: seed + 3 }), freq * 3, { q: 1, mode: "bpn" }), (t) => hardness * Math.exp(-t / 0.006));
  return mix(tone, strike);
}
export function gong(freq, seconds = 5, { seed = 1 } = {}) {
  const r = random(seed), list = [[1, 1, 3.5], [1.52, 0.6, 2.8]];
  for (let i = 0; i < 18; i++) list.push([1 + r() * 11, 0.5 / (1 + i * 0.4), 1 + r() * 3]);
  const tone = partials(freq, seconds, list, { beat: 0.4, seed });
  const wash = shape(svf(noise(seconds, { seed: seed + 5, color: "pink" }), 900, { q: 0.6, mode: "bpn" }), (t) => 0.3 * smooth(t / 0.25) * Math.exp(-t / 1.4));
  return mix(tone, wash);
}
// A warm pad: detuned band-limited saws spread across the stereo field through a slowly moving low-pass.
export function pad(midis, seconds, { voices = 5, detune = 0.14, cutoff = 1100, seed = 1, attack = 1, release = 1.2, q = 0.8, low = 140 } = {}) {
  const out = stereo(seconds), r = random(seed);
  for (const m of midis) for (let v = 0; v < voices; v++) {
    const spread = v / (voices - 1) - 0.5;
    place(out, osc("saw", midiHz(m + spread * 2 * detune), seconds, { phase: r() }), 0, { gain: 1 / voices, pan: spread * 1.4 });
  }
  const ph = r() * 6.28, cut = fnOf(cutoff), moving = (t) => cut(t) * (1 + 0.25 * Math.sin(2 * Math.PI * 0.13 * t + ph));
  const e = env.adsr(attack, 0.5, 0.85, release), band = (x) => svf(svf(x, moving, { q }), low, { mode: "hp" });   // the bass and sub own the lows
  return { L: shape(band(out.L), e), R: shape(band(out.R), e) };
}
// Synth brass for fanfares: a stack of saws whose filter opens on the attack, scooping up to the note.
export function brass(midi, seconds, { voices = 3, seed = 1, open = 3200 } = {}) {
  const r = random(seed), f = (t) => midiHz(midi - 0.3 * Math.exp(-t / 0.05));
  const stack = mix(...Array.from({ length: voices }, (_, v) => [osc("saw", (t) => f(t) * 2 ** (((v - (voices - 1) / 2) * 0.08) / 12), seconds, { phase: r() }), 1 / voices]));
  const cut = (t) => 500 + (open - 500) * (1 - Math.exp(-t / 0.08)) * (0.6 + 0.4 * Math.exp(-t / 0.6));
  return shape(svf(stack, cut, { q: 0.9 }), env.adsr(0.04, 0.3, 0.8, 0.3));
}
// A voice singing a vowel (formants after Peterson & Barney): choirs for the boss, the wail of the wraiths.
const VOWELS = { a: [[730, 1, 9], [1090, 0.5, 11], [2440, 0.25, 13]], o: [[570, 1, 9], [840, 0.45, 11], [2410, 0.2, 13]], u: [[300, 1, 9], [870, 0.3, 11], [2240, 0.12, 13]] };
export function voice(freq, seconds, { vowel = "a", vibrato = 0.25, rate = 5.2, breath = 0.15, seed = 1 } = {}) {
  const f = fnOf(freq), pitch = (t) => f(t) * 2 ** ((vibrato * smooth(t / 0.4) * Math.sin(2 * Math.PI * rate * t)) / 12);
  const source = mix(osc("saw", pitch, seconds), [noise(seconds, { seed, color: "pink" }), breath]);
  return mix(...VOWELS[vowel].map(([hz, g, q]) => [svf(source, hz, { q, mode: "bpn" }), g]));
}

// ---------- effects ----------
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], ALLPASSES = [556, 441, 341, 225], SPREAD = 23;
// Freeverb (Jezar at Dreampoint, public domain): per channel, 8 low-pass-feedback combs in parallel and 4
// allpasses in series, the right channel 23 samples longer. Returns only the reverberation (wet).
export function reverb({ L, R }, { room = 0.8, damp = 0.5, width = 1, predelay = 0, tail = 0 } = {}) {
  const n = L.length + sec(tail), pd = sec(predelay), feedback = 0.7 + 0.28 * room, d1 = 0.4 * damp, d2 = 1 - d1;
  const channel = (extra) => ({ combs: COMBS.map((c) => ({ buf: new Float32Array(c + extra), i: 0, store: 0 })), alls: ALLPASSES.map((c) => ({ buf: new Float32Array(c + extra), i: 0 })) });
  const run = (ch, x) => {
    let acc = 0;
    for (const c of ch.combs) {
      const y = c.buf[c.i];
      c.store = y * d2 + c.store * d1;
      c.buf[c.i] = x + c.store * feedback;
      if (++c.i >= c.buf.length) c.i = 0;
      acc += y;
    }
    for (const a of ch.alls) {
      const b = a.buf[a.i], y = b - acc;
      a.buf[a.i] = acc + b * 0.5;
      if (++a.i >= a.buf.length) a.i = 0;
      acc = y;
    }
    return acc;
  };
  const left = channel(0), right = channel(SPREAD), w1 = 3 * (width / 2 + 0.5), w2 = 3 * ((1 - width) / 2);
  const outL = new Float32Array(n), outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i - pd, x = j >= 0 && j < L.length ? (L[j] + R[j]) * 0.015 : 0;
    const yl = run(left, x), yr = run(right, x);
    outL[i] = yl * w1 + yr * w2; outR[i] = yr * w1 + yl * w2;
  }
  return { L: outL, R: outR };
}
// Echoes that bounce left, right, left..., each one darker. Returns only the echoes.
export function pingPong({ L, R }, { time = 0.3, feedback = 0.35, tone = 3500, tail = 0 } = {}) {
  const n = L.length + sec(tail), d = Math.max(1, sec(time)), a = 1 - Math.exp((-2 * Math.PI * tone) / SR);
  const bl = new Float32Array(d), br = new Float32Array(d), outL = new Float32Array(n), outR = new Float32Array(n);
  let k = 0, lpL = 0, lpR = 0;
  for (let i = 0; i < n; i++) {
    const x = i < L.length ? (L[i] + R[i]) * 0.5 : 0, yl = bl[k], yr = br[k];
    lpL += a * (yl - lpL); lpR += a * (yr - lpR);
    bl[k] = x + lpR * feedback; br[k] = lpL * feedback;
    outL[i] = yl; outR[i] = yr;
    k = (k + 1) % d;
  }
  return { L: outL, R: outR };
}
// Chorus: the sound plus a copy through a slowly wobbling short delay, the wobble a quarter turn apart between
// the channels so it widens.
export function chorus({ L, R }, { rate = 0.5, depth = 0.0025, delay = 0.016, mix: wet = 0.5 } = {}) {
  const n = L.length, outL = new Float32Array(n), outR = new Float32Array(n);
  const tap = (x, i, d) => { const p = i - d * SR, i0 = Math.floor(p), fr = p - i0; if (i0 < 0) return 0; return x[i0] + fr * ((x[i0 + 1] ?? 0) - x[i0]); };
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    outL[i] = L[i] + wet * tap(L, i, delay + depth * Math.sin(2 * Math.PI * rate * t));
    outR[i] = R[i] + wet * tap(R, i, delay + depth * Math.cos(2 * Math.PI * rate * t));
  }
  return { L: outL, R: outR };
}
// Runs a time-invariant effect over a loop as if the loop had always been playing: it processes the loop
// twice and keeps the second pass, so the tails at the end flow into the start.
export function loopFx(src, fx) {
  const n = src.L.length, twice = { L: new Float32Array(2 * n), R: new Float32Array(2 * n) };
  twice.L.set(src.L); twice.L.set(src.L, n); twice.R.set(src.R); twice.R.set(src.R, n);
  const out = fx(twice);
  return { L: out.L.slice(n, 2 * n), R: out.R.slice(n, 2 * n) };
}

// ---------- mastering ----------
function biquad(x, b0, b1, b2, a0, a1, a2) {
  const out = new Float32Array(x.length);
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}
// K-weighting (ITU-R BS.1770): a +4 dB shelf above 1.5 kHz and a high-pass at 38 Hz (coefficients as pyloudnorm).
function kWeight(x) {
  const A = 10 ** (4 / 40), w0 = (2 * Math.PI * 1500) / SR, c = Math.cos(w0), al = Math.sin(w0) / (2 * Math.SQRT1_2), sA = Math.sqrt(A);
  const shelf = biquad(x, A * (A + 1 + (A - 1) * c + 2 * sA * al), -2 * A * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - 2 * sA * al),
    A + 1 - (A - 1) * c + 2 * sA * al, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - 2 * sA * al);
  const w1 = (2 * Math.PI * 38) / SR, c1 = Math.cos(w1), al1 = Math.sin(w1) / (2 * 0.5);
  return biquad(shelf, (1 + c1) / 2, -(1 + c1), (1 + c1) / 2, 1 + al1, -2 * c1, 1 - al1);
}
function blockPowers({ L, R }) {
  const kl = kWeight(L), kr = kWeight(R), n = kl.length, size = Math.min(n, sec(0.4)), step = Math.max(1, sec(0.1)), powers = [];
  for (let s = 0; s + size <= n; s += step) {
    let z = 0;
    for (let i = s; i < s + size; i++) z += kl[i] * kl[i] + kr[i] * kr[i];
    powers.push(z / size);
  }
  return powers;
}
const lufsOf = (power) => -0.691 + 10 * Math.log10(Math.max(power, 1e-12));
// Integrated loudness in LUFS: 400 ms blocks overlapping 75 %, with the absolute (-70) and relative (-10 LU)
// gates. A sound shorter than a block is measured as one block.
export function loudness(track) {
  let blocks = blockPowers(track).filter((z) => lufsOf(z) > -70);
  if (!blocks.length) return -Infinity;
  const gate = lufsOf(blocks.reduce((s, z) => s + z, 0) / blocks.length) - 10;
  blocks = blocks.filter((z) => lufsOf(z) > gate);
  return lufsOf(blocks.reduce((s, z) => s + z, 0) / blocks.length);
}
// The loudest 400 ms (momentary loudness): how loud a short effect sounds.
export const momentary = (track) => Math.max(...blockPowers(track).map(lufsOf));
export function peakDb({ L, R }) { let p = 0; for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); return 20 * Math.log10(Math.max(p, 1e-12)); }
// Look-ahead peak limiter: the gain each sample needs is known ahead of time, eased in over `look` seconds and
// released over `release`, the same for both channels, so no peak passes the ceiling (dBFS).
export function limit({ L, R }, { ceiling = -1, release = 0.08, look = 0.005 } = {}) {
  const n = L.length, c = db(ceiling), w = Math.max(1, sec(look)), need = new Float32Array(n), m = new Float32Array(n), q = new Int32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); need[i] = p > c ? c / p : 1; }
  let h = 0, t = 0;
  for (let i = n - 1; i >= 0; i--) { // m[i] = min(need[i .. i + w])
    while (t > h && need[q[t - 1]] >= need[i]) t--;
    q[t++] = i;
    while (q[h] > i + w) h++;
    m[i] = need[q[h]];
  }
  const rel = 1 - Math.exp(-1 / (release * SR)), outL = new Float32Array(n), outR = new Float32Array(n);
  let sum = 0, g = 1;
  for (let i = 0; i < n; i++) {
    sum += m[i];
    if (i > w) sum -= m[i - w - 1];
    const eased = sum / Math.min(i + 1, w + 1);
    g = Math.min(eased, g + (1 - g) * rel);
    outL[i] = Math.max(-c, Math.min(c, L[i] * g)); outR[i] = Math.max(-c, Math.min(c, R[i] * g));
  }
  return { L: outL, R: outR };
}
// Brings a track to a loudness target (integrated for music, momentary for short effects) without passing the
// peak ceiling. The limiter takes a little loudness away, so it is measured and corrected twice.
// A loop is limited as if it were playing round and round, so the gain at its end and at its start agree.
export function master(track, { lufs = -16, ceiling = -1, short = false, loop = false } = {}) {
  let out = track;
  for (let pass = 0; pass < 2; pass++) {
    const now = short ? momentary(out) : loudness(out);
    if (!Number.isFinite(now)) return out;
    const g = db(lufs - now), louder = { L: out.L.map((v) => v * g), R: out.R.map((v) => v * g) };
    out = loop ? loopFx(louder, (s) => limit(s, { ceiling })) : limit(louder, { ceiling });
  }
  return out;
}

// ---------- files ----------
// 16-bit PCM WAV (mono when both channels are equal or `mono` is set), with TPDF dither.
export function wav({ L, R }, { mono = false, seed = 1 } = {}) {
  const channels = mono ? 1 : 2, n = L.length, r = random(seed), data = Buffer.alloc(n * channels * 2);
  const q = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767 + (r() - r()))));
  for (let i = 0; i < n; i++) {
    if (mono) data.writeInt16LE(q((L[i] + R[i]) / 2), i * 2);
    else { data.writeInt16LE(q(L[i]), i * 4); data.writeInt16LE(q(R[i]), i * 4 + 2); }
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * channels * 2, 28); h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// ---------- arranging ----------
// A song on a bar/beat grid: a dry stereo bus plus two sends, a hall reverb and a ping-pong delay (the echoes
// also feed the hall). A loop wraps every tail round to its start; a one-shot keeps `tail` seconds of room.
export function arrangement({ bpm, bars, loop = true, beatsPerBar = 4, tail = 0 }) {
  const beat = 60 / bpm, length = bars * beatsPerBar * beat, total = loop ? length : length + tail;
  const dry = stereo(total), hall = stereo(total), echo = stereo(total);
  const at = (bar, b = 0) => (bar * beatsPerBar + b) * beat;
  const add = (sig, time, { gain = 1, pan = 0, rev = 0, delay = 0 } = {}) => {
    place(dry, sig, time, { gain, pan, loop });
    if (rev) place(hall, sig, time, { gain: gain * rev, pan, loop });
    if (delay) place(echo, sig, time, { gain: gain * delay, pan, loop });
  };
  const addStereo = (src, time, { gain = 1, rev = 0, delay = 0 } = {}) => {
    placeStereo(dry, src, time, { gain, loop });
    if (rev) placeStereo(hall, src, time, { gain: gain * rev, loop });
    if (delay) placeStereo(echo, src, time, { gain: gain * delay, loop });
  };
  // bright: a little of the mix above 2.5 kHz added back (a gentle high shelf), so it does not sound dull.
  const render = ({ room = 0.85, damp = 0.45, predelay = 0.025, echoTime = beat * 0.75, feedback = 0.35, echoToHall = 0.35, bright = 0.25 } = {}) => {
    const run = (src, fx) => (loop ? loopFx(src, fx) : fx(src));
    const echoes = run(echo, (s) => pingPong(s, { time: echoTime, feedback }));
    const hallIn = sumStereo(hall, { L: echoes.L.map((v) => v * echoToHall), R: echoes.R.map((v) => v * echoToHall) });
    const room_ = run(hallIn, (s) => reverb(s, { room, damp, predelay }));
    const cut = (s) => ({ L: s.L.slice(0, total), R: s.R.slice(0, total) });
    const air = (x) => svf(x, 2500, { mode: "hp" }), clean = (x) => svf(x, 30, { mode: "hp" });   // and no rumble under 30 Hz
    const finish = (s) => ({ L: clean(mix(s.L, [air(s.L), bright])), R: clean(mix(s.R, [air(s.R), bright])) });
    return run(sumStereo(dry, cut(echoes), cut(room_)), finish);
  };
  return { beat, length, total, at, add, addStereo, render };
}
