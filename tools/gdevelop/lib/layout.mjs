// Level layouts as plain data (no GDevelop here), so they can be generated, checked by the unit tests
// (tools/gdevelop/test/) and then turned into a scene by lib/level.mjs.
//
// Heights are measured up from the floor line F. A level is 1.5 screens tall and has three tiers:
//   floor (F) · jump-through platforms (F-130, F-260, F-390) · slabs, the ceilings crossed upside down
//   (F-277) · high ceilings with crystals and golden shurikens (F-600), reached by flipping from the top of
//   a slab or by walking off a slab's end upside down (Kaito "falls" up to the next ceiling).
// Rules found with the jump bot: spikes to be jumped sit in the open (a slab cuts the jump at ~155 px);
// spike runs sit under a slab that starts 200 px before them and ends 200 px after; a jump from the edge
// of a platform lands 255 px further, so platforms over a pit are 220 px wide with 70 px gaps.
export const TILE = 1280;
export const SPIKE_W = 115;                 // was 150: a jump (or a jump and a dash) no longer falls short
export const HEIGHTS = { platform: [130, 260, 390], slab: 277, high: 600 };
export const PLATFORM = { w: 220, gap: 70 };

// Each segment adds its pieces at x through `put` and returns its width.
const SEGMENTS = {
  start: (x, put) => { for (const dx of [260, 330, 400]) put("floorGem", { x: x + dx }); return 600; },
  open: (x, put, w = 400, gems = 0) => {
    for (let i = 1; i <= gems; i++) put("floorGem", { x: Math.round(x + (i * w) / (gems + 1) - 25) });
    return w;
  },
  // k spikes in the open, a crystal above each one.
  jump: (x, put, k = 1) => {
    for (let i = 0; i < k; i++) {
      const sx = x + 185 + i * 330;
      put("floorSpike", { x: sx });
      put("airGem", { x: sx + Math.round((SPIKE_W - 49) / 2) });
    }
    return 185 + (k - 1) * 330 + SPIKE_W + 215;
  },
  // A spike run crossed upside down along a slab; above it a high ceiling with crystals and a shuriken,
  // reached by walking off the slab's end upside down.
  flip: (x, put, n = 3, high = true) => {
    const run = n * SPIKE_W;
    put("slab", { x: x + 50, w: run + 400 });
    for (let i = 0; i < n; i++) put("floorSpike", { x: x + 250 + i * SPIKE_W });
    for (let gx = x + 260; gx < x + 250 + run; gx += 110) put("slabGem", { x: gx });
    if (!high) return run + 500;
    put("high", { x: x + 300, w: run + 500 });
    for (let gx = x + 380; gx < x + run + 700; gx += 140) put("highGem", { x: gx });
    put("shuriken", { x: x + run + 650, h: HEIGHTS.high - 70 });
    return run + 700;
  },
  // Up over a spike run, down before a hanging spike (180 px window), up again over a second run.
  zigzag: (x, put) => {
    put("slab", { x: x + 50, w: 1600 });
    for (const dx of [250, 250 + SPIKE_W, 1150, 1150 + SPIKE_W]) put("floorSpike", { x: x + dx });
    put("hangingSpike", { x: x + 780 });
    for (const dx of [280, 400, 1180, 1300]) put("slabGem", { x: x + dx });
    put("floorGem", { x: x + 830 });
    return 1750;
  },
  // A pit of n spikes with jump-through platforms over it; the last one reaches past the pit, so walking
  // off it lands on the floor. Crystals on the platforms.
  pit: (x, put, n = 4) => {
    const start = x + 200, end = start + n * SPIKE_W;
    for (let i = 0; i < n; i++) put("floorSpike", { x: start + i * SPIKE_W });
    // Spread evenly from just inside the pit to just past it, never more than PLATFORM.gap apart.
    const first = start + 30, last = Math.max(first, end + 30 - PLATFORM.w);
    const count = Math.ceil((last - first) / (PLATFORM.w + PLATFORM.gap)) + 1;
    for (let i = 0; i < count; i++) {
      const px = Math.round(count > 1 ? first + ((last - first) * i) / (count - 1) : first);
      put("platform", { x: px, w: PLATFORM.w, h: HEIGHTS.platform[0] });
      put("platformGem", { x: px + 85, h: HEIGHTS.platform[0] });
    }
    return last + PLATFORM.w - x + 260;
  },
  // A tower of platforms to climb: crystals on each step, a shuriken on top and a high ceiling above it
  // (flip from the top step) with more crystals and a hanging spike to drop before.
  tower: (x, put) => {
    const steps = [[150, 0], [420, 1], [690, 2]];
    for (const [dx, i] of steps) {
      put("platform", { x: x + dx, w: 210, h: HEIGHTS.platform[i] });
      put("platformGem", { x: x + dx + 80, h: HEIGHTS.platform[i] });
    }
    put("shuriken", { x: x + 770, h: HEIGHTS.platform[2] + 110 });
    put("high", { x: x + 650, w: 900 });
    for (let gx = x + 720; gx < x + 1500; gx += 140) put("highGem", { x: gx });
    put("highSpike", { x: x + 1380 });
    return 1650;
  },
  bonus: (x, put, w = 900) => {
    put("slab", { x: x + 50, w: w - 100 });
    for (let gx = x + 150; gx < x + w - 150; gx += 120) put("slabGem", { x: gx });
    return w;
  },
  enemies: (x, put, w = 900) => { put("zone", { x: x + 100, w: w - 200, kind: "zonaEnemigo" }); return w; },
  saw: (x, put, w = 700) => { put("zone", { x: x + 100, w: w - 200, kind: "zonaSierra" }); return w; },
  end: (x, put) => { put("portal", { x: x + 380 }); return 800; },
  // Final boss arena: a slab over most of it to dodge her spells upside down, crystals up there.
  arena: (x, put, w = 2400) => {
    put("slab", { x: x + 200, w: w - 500 });
    for (let gx = x + 400; gx < x + w - 400; gx += 300) put("slabGem", { x: gx });
    put("arena", { x0: x, x1: x + w - 300 });
    put("portal", { x: x + w - 220 });
    return w;
  },
};
export const SEGMENT_KINDS = Object.keys(SEGMENTS);

// The width a segment takes, without laying it out anywhere.
export function segmentWidth([kind, ...args]) {
  if (!SEGMENTS[kind]) throw new Error(`unknown segment ${kind}`);
  return SEGMENTS[kind](0, () => {}, ...args);
}

// A sequence is a list of segments ([kind, ...args]) and slots (["slot", segA, segB, ...]): a slot lays
// out every alternative at the same place, each item tagged slot*10 + alternative, and the scene keeps
// one of them at random when it starts (alternatives are padded with open floor to the widest one).
// Items without a slot have tag 0.
export function layoutLevel(sequence) {
  const L = { items: [], slots: [], checkpoints: [], portal: null, arena: null, length: 0, width: 0 };
  let x = 0, lastCheckpoint = 0;
  const putter = (tag) => (type, data) => {
    if (type === "portal") L.portal = data.x;
    else if (type === "arena") L.arena = data;
    else L.items.push({ type, tag, ...data });
  };
  for (const entry of sequence) {
    if (x - lastCheckpoint >= 1500) { L.checkpoints.push(x + 40); lastCheckpoint = x; }
    if (entry[0] === "slot") {
      const alternatives = entry.slice(1);
      if (alternatives.length < 2 || alternatives.length > 9) throw new Error("a slot needs 2 to 9 alternatives");
      const slot = L.slots.length + 1;
      const width = Math.max(...alternatives.map(segmentWidth));
      alternatives.forEach(([kind, ...args], i) => SEGMENTS[kind](x, putter(slot * 10 + i + 1), ...args));
      L.slots.push({ slot, alternatives: alternatives.length, x, width, kinds: alternatives.map((a) => a[0]) });
      x += width;
    } else {
      const [kind, ...args] = entry;
      if (!SEGMENTS[kind]) throw new Error(`unknown segment ${kind}`);
      x += SEGMENTS[kind](x, putter(0), ...args);
    }
  }
  if (L.portal === null) throw new Error("a level needs an 'end' or 'arena' segment");
  L.length = x;
  L.width = Math.ceil(x / TILE) * TILE;
  return L;
}

// The items a player meets for one draw of the slots ({ slot: alternative }).
export function itemsFor(layout, draw) {
  return layout.items.filter((it) => it.tag === 0 || draw[Math.floor(it.tag / 10)] === it.tag % 10);
}

// Every possible draw of a layout's slots (for the tests).
export function allDraws(layout) {
  let draws = [{}];
  for (const { slot, alternatives } of layout.slots) {
    draws = draws.flatMap((d) => Array.from({ length: alternatives }, (_, i) => ({ ...d, [slot]: i + 1 })));
  }
  return draws;
}

// Small deterministic random generator (mulberry32): the same seed always builds the same level.
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A level from a difficulty profile: obstacles and fights alternate until the target length, some
// obstacles become slots (drawn again on every restart), harder profiles get longer runs and pits.
//   profile: { seed, length, flip: [min, max], pit: [min, max], jump: [min, max], zigzag, towers,
//              slots, alternatives, enemies: [min, max], saw: [min, max], end: "end" | "arena" }
export function generateSequence(profile) {
  const rnd = random(profile.seed);
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const between = ([lo, hi]) => lo + Math.floor(rnd() * (hi - lo + 1));
  const obstacles = ["jump", "flip", "pit", ...(profile.zigzag ? ["zigzag"] : [])];
  const obstacle = (kind) => ({
    jump: () => ["jump", between(profile.jump)],
    flip: () => ["flip", between(profile.flip)],
    pit: () => ["pit", between(profile.pit)],
    zigzag: () => ["zigzag"],
  })[kind]();
  const seq = [["start"], ["open", 400, 2]];
  let length = seq.reduce((s, e) => s + segmentWidth(e), 0);
  let slotsLeft = profile.slots, towersLeft = profile.towers, fight = 0, section = 0;
  const target = profile.length - segmentWidth([profile.end === "arena" ? "arena" : "end"]) - 400;
  while (length < target) {
    section++;
    let entry;
    if (slotsLeft > 0 && section % 2 === 1) {
      const kinds = [...obstacles].sort(() => rnd() - 0.5).slice(0, profile.alternatives);
      entry = ["slot", ...kinds.map(obstacle)];
      slotsLeft--;
    } else entry = obstacle(pick(obstacles));
    seq.push(entry);
    length += entry[0] === "slot" ? Math.max(...entry.slice(1).map(segmentWidth)) : segmentWidth(entry);
    const combat = fight++ % 3 === 2 ? ["saw", between(profile.saw)] : ["enemies", between(profile.enemies)];
    seq.push(combat);
    length += segmentWidth(combat);
    if (towersLeft > 0 && section % 3 === 0) { seq.push(["tower"]); length += segmentWidth(["tower"]); towersLeft--; }
    else if (section % 4 === 0) { seq.push(["bonus", 900]); length += 900; }
  }
  seq.push(["open", 400, 3], [profile.end === "arena" ? "arena" : "end"]);
  return seq;
}
