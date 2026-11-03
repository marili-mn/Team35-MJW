// Invariants of the built project (GravityRunnerDash/GravityRunnerDash.json). The build only checks that
// every instruction exists and every scene compiles; these catch the bugs that still slipped through:
// an object created with an empty type, colors written without quotes (they render black), a scene change
// to a scene that does not exist, a camera or a fall limit that does not match the level's size, slab
// colliders off their art, missing images.
//   node --test tools/gdevelop/test/      (after node tools/gdevelop/build.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, opaqueTop } from "../../lib/png.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, "..", "..", "..", "..", "GravityRunnerDash");
const project = JSON.parse(fs.readFileSync(path.join(GAME, "GravityRunnerDash.json"), "utf8"));
const layouts = project.layouts;
const scene = (name) => layouts.find((l) => l.name === name);
const LEVELS = ["Nivel1", "Nivel2", "Nivel3"];
const PLAYABLE = ["Tutorial", ...LEVELS];
const resources = Object.fromEntries(project.resources.resources.map((r) => [r.name, r.file]));

// Every instruction of a scene, sub-events included.
const instructions = (layout) => {
  const out = [];
  const walk = (events) => {
    for (const e of events || []) {
      for (const c of e.conditions || []) out.push({ kind: "condition", type: c.type.value, params: c.parameters, event: e });
      for (const a of e.actions || []) out.push({ kind: "action", type: a.type.value, params: a.parameters, event: e });
      walk(e.events);
    }
  };
  walk(layout.events);
  return out;
};

test("every object has a type", () => {
  for (const l of layouts) for (const o of l.objects) assert.ok(o.type, `${l.name}: object ${o.name} has no type`);
});

test("colors are quoted strings (unquoted colors render black)", () => {
  for (const l of layouts) {
    for (const i of instructions(l)) {
      if (!["ChangeColor", "TextObject::ChangeColor"].includes(i.type)) continue;
      assert.match(i.params[1], /^".*"$/, `${l.name}: ${i.type} on ${i.params[0]} with color ${i.params[1]}`);
    }
  }
});

test("scene changes go to scenes that exist", () => {
  const names = new Set(layouts.map((l) => l.name));
  for (const l of layouts) {
    for (const i of instructions(l)) {
      if (i.type !== "Scene") continue;
      const target = i.params[1];
      if (/VariableString\(/.test(target)) continue;     // computed at runtime (retry, continue)
      assert.ok(names.has(target.replace(/^"|"$/g, "")), `${l.name}: changes to unknown scene ${target}`);
    }
  }
});

test("objects that events create exist in their scene", () => {
  for (const l of layouts) {
    const objects = new Set([...l.objects.map((o) => o.name), ...(project.objects || []).map((o) => o.name)]);
    for (const i of instructions(l)) if (i.type === "Create") assert.ok(objects.has(i.params[1]), `${l.name}: creates unknown object ${i.params[1]}`);
  }
});

test("every image a sprite uses is on disk", () => {
  for (const l of layouts) {
    for (const o of l.objects) {
      for (const a of o.animations || []) {
        for (const d of a.directions) {
          for (const s of d.sprites) {
            const file = resources[s.image];
            assert.ok(file, `${l.name}/${o.name}: image ${s.image} is not a resource`);
            assert.ok(fs.existsSync(path.join(GAME, file)), `${l.name}/${o.name}: ${file} is missing`);
          }
        }
      }
    }
  }
});

test("each playable scene has one Kaito, with every animation the events ask for", () => {
  for (const name of PLAYABLE) {
    const l = scene(name);
    assert.equal(l.instances.filter((i) => i.name === "kaito").length, 1, `${name}: Kaito instances`);
    const anims = l.objects.find((o) => o.name === "kaito").animations.map((a) => a.name);
    for (const i of instructions(l)) {
      if (i.type === "SetStringVariable" && i.params[0] === "Anim") assert.ok(anims.includes(i.params[2].replace(/"/g, "")), `${name}: Kaito has no animation ${i.params[2]}`);
    }
  }
});

test("levels: camera bounds, fall limit and portal match the level's size", () => {
  for (const name of LEVELS) {
    const l = scene(name);
    const backgrounds = l.instances.filter((i) => i.name === "fondo");
    const width = Math.max(...backgrounds.map((b) => b.x + b.width));
    const height = Math.max(...backgrounds.map((b) => b.y + b.height));
    const camera = instructions(l).find((i) => i.type === "FixCamera");
    assert.equal(Number(camera.params[4]), width, `${name}: camera width`);
    assert.equal(Number(camera.params[5]), height, `${name}: camera height`);
    assert.ok(instructions(l).some((i) => i.type === "PosY" && i.params[0] === "kaito" && i.params[1] === ">" && Number(i.params[2]) === height + 40),
      `${name}: falling out of the level is not checked at its bottom edge`);
    assert.ok(l.instances.some((i) => i.name === "puerta"), `${name}: no portal`);
    const kaito = l.instances.find((i) => i.name === "kaito");
    assert.ok(kaito.y > height - 720 && kaito.y < height, `${name}: Kaito starts outside the bottom screen`);
  }
});

test("levels: Kaito stands on the drawn surface of every slab", () => {
  for (const name of LEVELS) {
    const l = scene(name);
    const art = l.objects.find((o) => o.name === "pisoflotante");
    const surface = opaqueTop(readPng(fs.readFileSync(path.join(GAME, resources[art.animations[0].directions[0].sprites[0].image]))));
    const tops = l.instances.filter((i) => i.name === "sueloLosa");
    for (const piece of l.instances.filter((i) => i.name === "pisoflotante" && i.zOrder === 1)) {
      const line = piece.y + piece.height * surface;
      assert.ok(tops.some((t) => t.x === piece.x && Math.abs(t.y + 31 - line) <= 2), `${name}: slab at ${piece.x},${piece.y} has no collider on its surface`);
    }
  }
});

test("levels: platforms over pits are jump-through, slots are drawn at start", () => {
  for (const name of LEVELS) {
    const l = scene(name);
    const platform = l.objects.find((o) => o.name === "plataforma");
    assert.equal(platform.behaviors.find((b) => b.type === "PlatformBehavior::PlatformBehavior").platformType, "Jumpthru", `${name}: platforms are not jump-through`);
    const slots = new Set(l.instances.flatMap((i) => (i.initialVariables || []).filter((v) => v.name === "Variante").map((v) => Math.floor(v.value / 10))));
    const drawn = new Set(instructions(l).filter((i) => i.type === "SetNumberVariable" && /^Slot\d+$/.test(i.params[0])).map((i) => Number(i.params[0].slice(4))));
    for (const s of slots) assert.ok(drawn.has(s), `${name}: slot ${s} is never drawn`);
    for (const o of l.objects) {
      const tagged = l.instances.some((i) => i.name === o.name && (i.initialVariables || []).some((v) => v.name === "Variante"));
      if (tagged) assert.ok((o.variables || []).some((v) => v.name === "Variante"), `${name}: ${o.name} does not declare Variante`);
    }
  }
});

test("HUD texts live on the HUD layer", () => {
  for (const name of PLAYABLE) {
    for (const i of scene(name).instances) {
      if (["TextoGemas", "Aviso", "TextoPausa", "AyudaPausa", "TextoTiempo", "TituloResultado", "Resumen"].includes(i.name)) assert.equal(i.layer, "HUD", `${name}: ${i.name} is not on the HUD`);
    }
  }
});

test("every sound and music the events play is a declared audio file on disk, and none is left unused", () => {
  const audio = new Set(project.resources.resources.filter((r) => r.kind === "audio").map((r) => r.name));
  const played = new Set();
  for (const l of layouts) for (const x of instructions(l)) {
    if (x.type !== "PlaySound" && x.type !== "PlayMusicCanal") continue;
    const file = x.params[1];
    assert.ok(audio.has(file), `${l.name}: ${x.type} plays ${file}, which is not an audio resource`);
    played.add(file);
  }
  for (const name of audio) assert.ok(fs.existsSync(path.join(GAME, resources[name])), `${name} is missing on disk`);
  const onDisk = fs.readdirSync(path.join(GAME, "assets", "audio")).map((f) => `assets/audio/${f}`);
  for (const f of onDisk) assert.ok(played.has(f), `${f} is never played`);
  for (const l of layouts.filter((x) => !["Niveles", "Intro"].includes(x.name))) assert.equal(l.stopSoundsOnStartup, true, `${l.name} keeps the previous scene's sounds`);
});

test("the view stays 1280x720 (no blank bars past the art) and no scene has a light background", () => {
  assert.equal(project.properties.sizeOnStartupMode, "", "the game must not widen its view to the window");
  assert.equal(project.properties.adaptGameResolutionAtRuntime, false);
  for (const l of layouts) assert.ok(l.r + l.v + l.b < 150, `${l.name}: background ${l.r},${l.v},${l.b} shows white where the art ends`);
});

test("every ninja shows all its moves, and its shurikens can hurt and be reflected", () => {
  const MOVES = { ninjapatrullero: ["idle", "walk", "run", "attack"], ninjapatrullero2: ["idle", "walk", "run", "attack"], ninjarojo: ["idle", "walk", "run", "attack"], sombra: ["idle", "walk", "run", "jump", "attack"] };
  for (const name of LEVELS) {
    const l = scene(name);
    for (const [ninja, moves] of Object.entries(MOVES)) {
      const o = l.objects.find((x) => x.name === ninja);
      assert.ok(o, `${name}: no ${ninja}`);
      const anims = o.animations.map((a) => a.name);
      for (const m of moves) assert.ok(anims.includes(m), `${name}: ${ninja} has no ${m} animation`);
      const set = new Set(instructions(l).filter((x) => x.type === "AnimatableCapability::AnimatableBehavior::SetName" && (x.params[0] === ninja || x.params[0] === "Ninjas")).map((x) => x.params[3].replace(/"/g, "")));
      for (const m of moves) assert.ok(set.has(m), `${name}: the events never show ${ninja}'s ${m}`);
    }
    const peligro = l.objectsGroups.find((g) => g.name === "Peligro").objects.map((o) => o.name);
    assert.ok(peligro.includes("shurikenEnemigo"), `${name}: shurikens do not hurt`);
    assert.ok(instructions(l).some((x) => x.type === "Create" && x.params[1] === "shurikenReflejado"), `${name}: shurikens cannot be reflected`);
  }
});
