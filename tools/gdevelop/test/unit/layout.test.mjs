// Unit tests for the level layouts (lib/layout.mjs). They check, for every level and every possible draw
// of its slots, the rules that make a stretch passable (found with the jump bot), so a new segment or a
// new profile cannot quietly build an impossible jump.
//   node --test tools/gdevelop/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutLevel, itemsFor, allDraws, generateSequence, segmentWidth, SPIKE_W, SEGMENT_KINDS } from "../../lib/layout.mjs";
import { LEVELS, PROFILES } from "../../build/steps/06-levels.mjs";

const SLAB_MARGIN = 190;      // a spike run sits under a slab that starts 200 px before it and ends 200 px after
const JUMP_CLEARANCE = 100;   // no slab over an open spike: a slab cuts the jump at ~155 px
const PLATFORM_GAP = 80;      // a jump from a platform's edge lands 255 px further

const runsOf = (spikes) => {
  const runs = [];
  for (const s of [...spikes].sort((a, b) => a.x - b.x)) {
    const last = runs[runs.length - 1];
    if (last && s.x - last.x1 <= 1) last.x1 = s.x + SPIKE_W, last.n++;
    else runs.push({ x0: s.x, x1: s.x + SPIKE_W, n: 1 });
  }
  return runs;
};
const covers = (slabs, x0, x1, margin = 0) => slabs.some((c) => c.x <= x0 - margin && c.x + c.w >= x1 + margin);
const overlaps = (slabs, x0, x1) => slabs.some((c) => c.x < x1 && c.x + c.w > x0);

for (const def of LEVELS) {
  const layout = layoutLevel(def.segments);
  const draws = allDraws(layout);

  test(`${def.name}: every draw of its slots can be played`, () => {
    assert.ok(draws.length >= 2, "a level should have stretches that change between restarts");
    for (const draw of draws) {
      const items = itemsFor(layout, draw);
      const of = (type) => items.filter((it) => it.type === type);
      const slabs = of("slab");
      const label = `${def.name} draw ${JSON.stringify(draw)}`;
      for (const run of runsOf(of("floorSpike"))) {
        if (overlaps(slabs, run.x0, run.x1)) {
          // Crossed upside down: the slab must start well before the run and end well after it.
          assert.ok(covers(slabs, run.x0, run.x1, SLAB_MARGIN), `${label}: spike run at ${run.x0} is not fully under a slab with ${SLAB_MARGIN} px margins`);
        } else if (run.n === 1) {
          assert.ok(!overlaps(slabs, run.x0 - JUMP_CLEARANCE, run.x1 + JUMP_CLEARANCE), `${label}: a slab hangs over the open spike at ${run.x0} (it would cut the jump)`);
        } else {
          // A pit: jump-through platforms all the way over it.
          const plats = of("platform").filter((p) => p.x < run.x1 && p.x + p.w > run.x0 - 60).sort((a, b) => a.x - b.x);
          assert.ok(plats.length >= 1, `${label}: the pit at ${run.x0} has no platforms`);
          assert.ok(plats[0].x <= run.x0 + 40, `${label}: the first platform of the pit at ${run.x0} starts too far in`);
          assert.ok(plats[plats.length - 1].x + plats[plats.length - 1].w >= run.x1 + 30, `${label}: the last platform of the pit at ${run.x0} ends before the pit`);
          for (let i = 1; i < plats.length; i++) {
            assert.ok(plats[i].x - (plats[i - 1].x + plats[i - 1].w) <= PLATFORM_GAP, `${label}: gap too wide between platforms at ${plats[i].x}`);
          }
        }
      }
      // A hanging spike over the floor between two runs: room on the floor to drop and flip again.
      for (const h of of("hangingSpike")) {
        assert.ok(!of("floorSpike").some((s) => s.x < h.x + SPIKE_W + 150 && s.x + SPIKE_W > h.x - 150), `${label}: no floor window under the hanging spike at ${h.x}`);
      }
      for (const it of items) assert.ok(it.x >= 0 && it.x + (it.w || 0) <= layout.width, `${label}: ${it.type} at ${it.x} is outside the level`);
      const crystals = items.filter((it) => /Gem$/.test(it.type)).length;
      assert.ok(crystals >= 30, `${label}: only ${crystals} crystals`);
      assert.ok(of("shuriken").length >= 2, `${label}: fewer than 2 golden shurikens`);
    }
  });

  test(`${def.name}: checkpoints, slots and portal`, () => {
    const marks = [0, ...layout.checkpoints, layout.length];
    for (let i = 1; i < marks.length; i++) assert.ok(marks[i] - marks[i - 1] <= 1500 + 2700, `checkpoint gap of ${marks[i] - marks[i - 1]} px`);
    for (const s of layout.slots) {
      assert.ok(s.alternatives >= 2, `slot ${s.slot} has a single alternative`);
      assert.equal(new Set(s.kinds).size, s.kinds.length, `slot ${s.slot} repeats a kind of stretch`);
    }
    assert.ok(layout.portal > layout.length - 1000, "the portal should be at the end of the level");
  });
}

test("the same profile always builds the same level (reproducible build)", () => {
  for (const profile of Object.values(PROFILES)) assert.deepEqual(generateSequence(profile), generateSequence(profile));
});

test("difficulty grows from level to level", () => {
  const names = ["Nivel1", "Nivel2", "Nivel3"];
  const p = names.map((n) => PROFILES[n]);
  for (let i = 1; i < p.length; i++) {
    for (const key of ["flip", "pit", "jump"]) assert.ok(p[i][key][1] >= p[i - 1][key][1], `${key} gets easier in ${names[i]}`);
    assert.ok(p[i].length > p[i - 1].length, `${names[i]} is not longer`);
  }
  const ratios = names.map((n) => LEVELS.find((l) => l.name === n).crystalsToOpen);
  assert.deepEqual([...ratios].sort(), ratios, "the share of crystals to open the portal should grow");
});

test("every segment has a positive width and lays out without errors", () => {
  for (const kind of SEGMENT_KINDS) assert.ok(segmentWidth([kind]) > 0, `${kind} has no width`);
});
