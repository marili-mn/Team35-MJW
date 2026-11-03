// Unit tests of the sound engine (lib/synth.mjs): the instruments are in tune, the filters filter, the
// limiter never lets a peak through, loudness is measured as BS.1770 says, loops have no seam and the
// same seed renders the same samples.
//   node --test tools/gdevelop/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { SR, sec, midiHz, osc, pluck, flute, svf, noise, reverb, limit, loudness, peakDb, loopFx, stereo, place, arrangement, taiko } from "../../lib/synth.mjs";

// Fundamental by autocorrelation, searched between 50 Hz and 2 kHz.
function pitchOf(sig, from = 0.1, length = 0.2) {
  const a = sec(from), n = sec(length);
  let best = 0, lag = 0;
  for (let l = Math.floor(SR / 2000); l <= Math.ceil(SR / 50); l++) {
    let s = 0;
    for (let i = a; i < a + n; i++) s += sig[i] * sig[i + l];
    if (s > best) { best = s; lag = l; }
  }
  return SR / lag;
}
const rms = (x, from = 0, to = x.length) => { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return Math.sqrt(s / (to - from)); };
const cents = (a, b) => Math.abs(1200 * Math.log2(a / b));

test("the plucked string and the flute are in tune", () => {
  for (const m of [50, 62, 69, 74]) assert.ok(cents(pitchOf(pluck(midiHz(m), 0.5, { seed: m })), midiHz(m)) < 25, `string ${m}`);
  assert.ok(cents(pitchOf(flute(midiHz(69), 1, { vibrato: 0, scoop: 0 }), 0.3), midiHz(69)) < 25, "flute");
});

test("a pressed string bends up", () => {
  const bent = pluck(midiHz(62), 1, { bend: (t) => (t > 0.3 ? 2 : 0) });
  assert.ok(cents(pitchOf(bent, 0.6, 0.15), midiHz(64)) < 40);
});

test("the low-pass filter cuts the highs and keeps the lows", () => {
  const hi = svf(osc("sine", 8000, 0.5), 500), lo = svf(osc("sine", 100, 0.5), 500);
  assert.ok(rms(hi, sec(0.1)) < 0.02, "8 kHz through a 500 Hz low-pass");
  assert.ok(rms(lo, sec(0.1)) > 0.6, "100 Hz through a 500 Hz low-pass");
});

test("loudness: a 1 kHz sine at -20 dBFS in both channels measures -20 LUFS", () => {
  const s = osc("sine", 1000, 3).map((v) => v * 0.1);
  assert.ok(Math.abs(loudness({ L: s, R: s }) - -20) < 0.5, String(loudness({ L: s, R: s })));
});

test("the limiter never lets a peak over the ceiling", () => {
  const t = stereo(1);
  place(t, taiko(1).map((v) => v * 6), 0);
  place(t, noise(1, { seed: 3 }).map((v) => v * 2), 0.5);
  assert.ok(peakDb(limit(t, { ceiling: -1 })) <= -0.99);
});

test("the reverb rings and then dies out", () => {
  const t = stereo(4);
  t.L[0] = t.R[0] = 1;
  const wet = reverb(t, { room: 0.8 });
  assert.ok(rms(wet.L, sec(0.05), sec(0.25)) > 10 * rms(wet.L, sec(3.5), sec(4)));
});

test("a loop has no seam: its tails come round to the start", () => {
  const song = arrangement({ bpm: 120, bars: 2 });
  song.add(pluck(midiHz(57), 3, { t60: 3 }), song.at(1, 3), { rev: 0.5 });   // rings past the end
  const out = song.render();
  const n = out.L.length;
  let inside = 0;
  for (let i = 1; i < n; i++) inside = Math.max(inside, Math.abs(out.L[i] - out.L[i - 1]));
  assert.ok(Math.abs(out.L[0] - out.L[n - 1]) < inside * 0.5, "the end flows into the start");
  assert.ok(rms(out.L, 0, sec(0.2)) > 0.001, "the note still rings at the start of the loop");
  const twice = loopFx({ L: out.L, R: out.R }, (s) => s);
  assert.equal(twice.L.length, n);
});

test("the same seed renders the same samples", () => {
  assert.deepEqual(pluck(220, 0.2, { seed: 9 }), pluck(220, 0.2, { seed: 9 }));
  assert.notDeepEqual(pluck(220, 0.2, { seed: 9 }), pluck(220, 0.2, { seed: 10 }));
});
