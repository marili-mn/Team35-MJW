// Builds a long level scene from the finished Tutorial: same Kaito, physics, energy, damage, healing and
// HUD, with the level's own art, a layout made of segments, procedural enemies that change on every
// restart, and a portal that opens with crystals.
import { append, makeEventHelpers, makeEventFinder, makeLayoutHelpers } from "./events.mjs";
import {
  setAnimations, spriteFrames, ensureImageResource, insertObjectFrom, declareObjectNumbers, setSpriteMask,
} from "./objects.mjs";

export const TILE = 1280;
const CEIL_GAP = 277;          // floor line to ceiling line, as in the Tutorial (proven flip distances)
const KAITO_HALF = 60;         // Kaito's origin is centered: feet at y + 60
const PIECE_W = 256, PIECE_H = 85, PIECE_STEP = 240;   // floating platform art pieces (3:1 images)
const TUTORIAL_ONLY = ["Hint1", "Hint2", "Hint3", "Hint4", "Hint5", "Hint6", "Hint7", "Hint8", "Hint9", "Hint10",
  "indicacion1", "indicacion2", "indicacion3", "Indicacion4", "indicacion5", "cartelInicio", "InstruccionGravedad", "roca"];
const HUD_OBJECTS = ["barradeenergia", "energiadebarra", "vida", "TextoGemas", "Aviso"];
const PATROL_VARS = ["Dir", "Vel", "Base", "MinX", "MaxX"];

// ======================= LAYOUT: segments =======================
// Each segment adds its pieces at x and returns its width. Rules found with the jump bot: spikes to be
// jumped sit in the open (a ceiling cuts the jump at ~155 px), spike runs sit under a ceiling that starts
// 200 px before them and ends 200 px after, so they are crossed upside down.
const SEGMENTS = {
  start: (x, L) => { L.floorGems.push(x + 260, x + 330, x + 400); return 600; },
  open: (x, L, w = 400, gems = 0) => {
    for (let i = 1; i <= gems; i++) L.floorGems.push(Math.round(x + (i * w) / (gems + 1) - 25));
    return w;
  },
  jump: (x, L) => { L.floorSpikes.push(x + 185); L.airGems.push(x + 235); return 520; },
  jump2: (x, L) => { L.floorSpikes.push(x + 185, x + 535); L.airGems.push(x + 235, x + 585); return 870; },
  flip: (x, L, n = 3) => {
    const run = n * 150;
    L.ceilings.push([x + 50, run + 400]);
    for (let i = 0; i < n; i++) L.floorSpikes.push(x + 250 + i * 150);
    for (let gx = x + 260; gx < x + 250 + run; gx += 110) L.ceilGems.push(gx);
    return run + 500;
  },
  // Up over a spike run, down before a hanging spike (180 px window), up again over a second run.
  zigzag: (x, L) => {
    L.ceilings.push([x + 50, 1600]);
    L.floorSpikes.push(x + 250, x + 400, x + 1150, x + 1300);
    L.hangingSpikes.push(x + 780);
    L.ceilGems.push(x + 280, x + 420, x + 1180, x + 1320);
    L.floorGems.push(x + 830);
    return 1750;
  },
  bonus: (x, L, w = 900) => {
    L.ceilings.push([x + 50, w - 100]);
    for (let gx = x + 150; gx < x + w - 150; gx += 120) L.ceilGems.push(gx);
    return w;
  },
  enemies: (x, L, w = 900) => { L.zones.push([x + 100, w - 200, "zonaEnemigo"]); return w; },
  saw: (x, L, w = 700) => { L.zones.push([x + 100, w - 200, "zonaSierra"]); return w; },
  end: (x, L) => { L.portal = x + 380; return 800; },
};

export function layoutLevel(sequence) {
  const L = { ceilings: [], floorSpikes: [], hangingSpikes: [], floorGems: [], ceilGems: [], airGems: [], zones: [], checkpoints: [], portal: null };
  let x = 0, lastCheckpoint = 0;
  for (const [kind, ...args] of sequence) {
    if (!SEGMENTS[kind]) throw new Error(`unknown segment ${kind}`);
    if (x - lastCheckpoint >= 1500) { L.checkpoints.push(x + 40); lastCheckpoint = x; }
    x += SEGMENTS[kind](x, L, ...args);
  }
  if (L.portal === null) throw new Error("a level needs an 'end' segment");
  return { ...L, length: x, width: Math.ceil(x / TILE) * TILE };
}

// ======================= OBJECTS captured from the team's original levels =======================
// Called once, before any level is rebuilt (rebuilding a level replaces its objects).
export function captureOriginalObjects(gd, project) {
  const take = (scene, names) => Object.fromEntries(names.map((n) => {
    const el = new gd.SerializerElement();
    const obj = project.getLayout(scene).getObjects().getObject(n);
    obj.serializeTo(el);
    return [n, { type: obj.getType(), element: el }];
  }));
  return {
    ...take("Nivel1", ["ninjapatrullero", "ninjapatrullero2", "enemigo", "cierra", "cristaldorado", "techosuperior"]),
    ...take("Nivel2", ["pisobase"]),
  };
}

// Enemy kinds created at runtime: size on screen and how far above the floor line their top-left is.
const KINDS = {
  azul: { object: "ninjapatrullero", w: 128, h: 128, top: 127 },
  verde: { object: "ninjapatrullero2", w: 136, h: 148, top: 138 },
  guardia: { object: "enemigo", w: 140, h: 140, top: 139 },
  sierra: { object: "cierra", w: 96, h: 77, top: 58 },
};

function setupEnemyObjects(gd, project, objects, captured) {
  for (const n of ["ninjapatrullero", "ninjapatrullero2", "enemigo", "cierra", "cristaldorado"]) insertObjectFrom(gd, project, objects, n, captured[n]);
  // The team's sheets hold every move in one animation: split them into named ones.
  const azul = objects.getObject("ninjapatrullero");
  const a = spriteFrames(gd, azul);
  setAnimations(gd, azul, [
    { name: "idle", images: a.slice(0, 8), speed: 0.12 },
    { name: "walk", images: a.slice(8, 16), speed: 0.09 },
    { name: "run", images: a.slice(16, 24), speed: 0.06 },
    { name: "attack", images: a.slice(24, 32), speed: 0.06 },
  ], { mask: [[26, 20], [104, 20], [104, 127], [26, 127]] });
  const verde = objects.getObject("ninjapatrullero2");
  const v = spriteFrames(gd, verde);
  setAnimations(gd, verde, [
    { name: "idle", images: v.slice(0, 7), speed: 0.12 },
    { name: "walk", images: v.slice(7, 15), speed: 0.1 },
    { name: "run", images: v.slice(7, 15), speed: 0.06 },
    { name: "attack", images: v.slice(15, 22), speed: 0.07 },
  ], { mask: [[44, 24], [178, 24], [178, 223], [44, 223]] });
  setSpriteMask(gd, objects.getObject("enemigo"), [[330, 120], [860, 120], [860, 1243], [330, 1243]]); // body, not the katana
  const saw = [];
  for (let k = 0; k < 8; k++) {
    const ang = ((22.5 + 45 * k) * Math.PI) / 180;
    saw.push([Math.round(700 + 560 * Math.cos(ang)), Math.round(561 + 480 * Math.sin(ang))]);
  }
  setSpriteMask(gd, objects.getObject("cierra"), saw);
  for (const n of ["ninjapatrullero", "ninjapatrullero2", "enemigo", "cierra"]) declareObjectNumbers(objects.getObject(n), PATROL_VARS);

  for (const zone of ["zonaEnemigo", "zonaSierra"]) {
    const obj = objects.insertNewObject(project, "Sprite", zone, objects.getObjectsCount());
    setAnimations(gd, obj, [{ name: "", images: ["NewSprite19"] }]);
  }
  const groups = objects.getObjectGroups();
  const group = (name, members) => {
    const g = groups.insertNew(name, groups.count());
    for (const m of members) g.addObject(m);
  };
  group("Patrulla", ["ninjapatrullero", "ninjapatrullero2", "enemigo", "cierra"]);
  group("Enemigos", ["ninjapatrullero", "ninjapatrullero2", "enemigo"]);
  group("Ninjas", ["ninjapatrullero", "ninjapatrullero2"]);
  group("Peligro", ["pinchos", "ninjapatrullero", "ninjapatrullero2", "enemigo", "cierra"]);
}

// ======================= LEVEL =======================
export function buildLevel({ gd, project }, def, captured) {
  const F = def.floorLine;                 // y of the floor collider line
  const C = F - CEIL_GAP;                  // y of the ceiling collider line
  const KAITO_Y = F - KAITO_HALF;
  const lay = layoutLevel(def.segments);
  const W = lay.width;

  // ---- 1. A fresh copy of the Tutorial under the level's name ----
  let position = 0;
  while (project.getLayoutAt(position).getName() !== def.name) position++;
  project.removeLayout(def.name);
  const level = project.insertNewLayout(def.name, position);
  const el = new gd.SerializerElement();
  project.getLayout("Tutorial").serializeTo(el);
  level.unserializeFrom(project, el);
  level.setName(def.name);

  const objects = level.getObjects();
  const instances = level.getInitialInstances();
  const events = level.getEvents();
  const { I, NOT, ev, q, setNum, numIs, setStr, coll, timer, resetTimer } = makeEventHelpers(gd);
  const { find, findAll } = makeEventFinder(gd, events, def.name);
  const { allInstances, addInst } = makeLayoutHelpers(gd, level);

  for (const n of TUTORIAL_ONLY) { instances.removeInitialInstancesOfObject(n); objects.removeObject(n); }
  for (let i = 0; i < objects.getObjectsCount(); i++) {
    const n = objects.getObjectAt(i).getName();
    if (n !== "kaito" && !HUD_OBJECTS.includes(n)) instances.removeInitialInstancesOfObject(n);
  }
  for (const inst of allInstances()) if (inst.getObjectName() === "kaito") { inst.setX(100); inst.setY(KAITO_Y); }

  // ---- 2. The level's art ----
  setAnimations(gd, objects.getObject("fondo"), [{ name: "", images: [ensureImageResource(gd, project, def.background)] }]);
  setAnimations(gd, objects.getObject("pisoflotante"), [{ name: "", images: [ensureImageResource(gd, project, def.platform)] }]);
  setAnimations(gd, objects.getObject("puerta"), [{ name: "", images: [ensureImageResource(gd, project, def.portal)] }]);
  if (def.topBorder) insertObjectFrom(gd, project, objects, "techosuperior", captured.techosuperior);
  if (def.floorArt) insertObjectFrom(gd, project, objects, "pisobase", captured.pisobase);
  setupEnemyObjects(gd, project, objects, captured);

  // ---- 3. Instances ----
  for (let i = 0; i < W / TILE; i++) {
    addInst("fondo", i * TILE, 0, TILE, 720, { z: -10, flipX: i % 2 === 1 });
    addInst("piso", i * TILE, F - 31, TILE, 64, { z: 0 });
    if (def.floorArt) addInst("pisobase", i * TILE - 6, F + def.floorArt.dy, TILE + 12, def.floorArt.h, { z: -5 });
  }
  if (def.topBorder) for (let x = 0; x < W; x += 920) addInst("techosuperior", x, 0, 928, 50, { z: -4 });
  addInst("techo", 0, -55, W, 64, { z: 0 });                       // safety ceiling over the whole level
  const pieceY = Math.round(C + 2 - PIECE_H * def.platformBottom);
  for (const [x, w] of lay.ceilings) {
    addInst("techo", x, C - 31, w, 64, { z: 0 });
    for (let px = x - 20; px < x + w; px += PIECE_STEP) addInst("pisoflotante", px, pieceY, Math.min(PIECE_W, x + w + 20 - px), PIECE_H, { z: 1 });
  }
  for (const x of lay.floorSpikes) addInst("pinchos", x, F - 47, 150, 50, { z: 2 });
  for (const x of lay.hangingSpikes) addInst("pinchos", x, C, 150, 50, { z: 2, flipY: true });
  for (const x of lay.floorGems) addInst("cristal", x, F - 76, 49, 52, { z: 3 });
  for (const x of lay.ceilGems) addInst("cristal", x, C + 51, 49, 52, { z: 3 });
  for (const x of lay.airGems) addInst("cristal", x, F - 176, 49, 52, { z: 3 });
  for (const [x, w, zone] of lay.zones) addInst(zone, x, F - 140, w, 20, { z: 0 });
  addInst("puerta", lay.portal, F - 158, 150, 164, { z: 1 });

  // ---- 4. Variables ----
  const vars = level.getVariables();
  const num = (n, v) => { if (!vars.has(n)) vars.insertNew(n, vars.count()); vars.get(n).setValue(v); };
  num("CheckX", 100);
  num("CheckY", KAITO_Y);
  for (const n of ["Sorteo", "SpawnX", "Requeridas", "PortalAbierto"]) num(n, 0);

  // ---- 5. Events taken from the Tutorial that need the level's numbers ----
  const camera = find((c, a) => a.some((x) => x.type === "FixCamera"), "camera");
  const camActions = camera.event.getActions();
  for (let i = 0; i < camActions.size(); i++) {
    const a = camActions.get(i);
    if (a.getType() === "FixCamera") a.setParameter(4, String(W));
    if (a.getType() === "TextContainerCapability::TextContainerBehavior::SetValue" && a.getParameter(0).getPlainString() === "TextoGemas") {
      a.setParameter(3, '"Cristales: " + ToString(Variable(Gemas)) + " / " + ToString(Variable(Requeridas))');
    }
  }
  const isCheckpoint = (c) => c.some((x) => x.type === "PosX" && x.params[0] === "kaito") && c.some((x) => x.params[0] === "CheckX");
  for (const { index } of findAll(isCheckpoint, "tutorial checkpoints", 4).reverse()) events.removeEventAt(index);
  const portal = find((c, a) => c.some((x) => x.type === "CollisionNP" && x.params[1] === "puerta") && a.some((x) => x.type === "Scene"), "portal");
  events.removeEventAt(portal.index);
  // Enemies and saws hurt like spikes (same invulnerability, bounce and healing).
  const damage = find((c) => c.some((x) => x.type === "CollisionNP" && x.params[1] === "pinchos"), "spike damage");
  const dconds = damage.event.getConditions();
  for (let i = 0; i < dconds.size(); i++) if (dconds.get(i).getType() === "CollisionNP") dconds.get(i).setParameter(1, "Peligro");

  // ---- 6. Killing enemies (before the damage event, so a kill wins over a hit in the same frame) ----
  const kill = () => [
    I("Create", ["", "cristaldorado", "Enemigos.BoundingBoxCenterX() - 22", "Enemigos.BoundingBoxBottom() - 70", ""]),
    I("ResizableCapability::ResizableBehavior::SetWidth", ["cristaldorado", "Resizable", "=", "44"]),
    I("ResizableCapability::ResizableBehavior::SetHeight", ["cristaldorado", "Resizable", "=", "44"]),
    I("Delete", ["Enemigos", ""]),
  ];
  const facingRight = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"], true);
  const facingLeft = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"]);
  const killEvents = [
    ev([numIs("Atacando", "=", "1"), I("Distance", ["Enemigos", "kaito", "140", ""]), facingRight, I("BoundingBoxCenterX", ["Enemigos", ">=", "kaito.X() - 10"])], kill()),
    ev([numIs("Atacando", "=", "1"), I("Distance", ["Enemigos", "kaito", "140", ""]), facingLeft, I("BoundingBoxCenterX", ["Enemigos", "<=", "kaito.X() + 10"])], kill()),
    ev([I("PlatformBehavior::IsFalling", ["kaito", "PlatformerObject"]), NOT("FlippedY", ["kaito"]), coll("kaito", "Enemigos"),
      I("BoundingBoxBottom", ["kaito", "<", "Enemigos.BoundingBoxTop() + 40"])],
    [...kill(), I("PlatformBehavior::SetCanJump", ["kaito", "PlatformerObject"]), I("PlatformBehavior::SimulateJumpKey", ["kaito", "PlatformerObject"])]),
  ];
  killEvents.forEach((e, i) => events.insertEvent(e, damage.index + i));

  const add = (e) => events.insertEvent(e, events.getEventsCount());
  const warn = (textExpr) => [
    I("TextContainerCapability::TextContainerBehavior::SetValue", ["Aviso", "Text", "=", textExpr]),
    I("Montre", ["Aviso", ""]),
    resetTimer("Aviso"),
  ];

  // ---- 7. Procedural enemies: every (re)start draws kind, amount, position, speed and direction ----
  const E = def.enemies;
  const create = (kind, base, zone) => {
    const { object: o, w, h, top } = KINDS[kind];
    return [
      I("Create", ["", o, "Variable(SpawnX)", String(F - top), ""]),
      I("ResizableCapability::ResizableBehavior::SetWidth", [o, "Resizable", "=", String(w)]),
      I("ResizableCapability::ResizableBehavior::SetHeight", [o, "Resizable", "=", String(h)]),
      I("SetNumberObjectVariable", [o, "MinX", "=", `${zone}.X()`]),
      I("SetNumberObjectVariable", [o, "MaxX", "=", `${zone}.X() + ${zone}.Width() - ${w}`]),
      I("SetNumberObjectVariable", [o, "Base", "=", base]),
      I("SetNumberObjectVariable", [o, "Dir", "=", "RandomInRange(0, 1) * 2 - 1"]),
    ];
  };
  const speed = ([lo, hi]) => `RandomInRange(${lo}, ${hi})`;
  // For each zone (when the scene starts): repeat 1..perZone times { draw a number, create the matching kind }.
  const spawner = (zone, perZone, choices) => {
    const fe = new gd.ForEachEvent();
    fe.setType("BuiltinCommonInstructions::ForEach");
    fe.setObjectToPick(zone);
    append(fe.getConditions(), I("SceneJustBegins", [""]));
    const rep = new gd.RepeatEvent();
    rep.setType("BuiltinCommonInstructions::Repeat");
    rep.setRepeatExpressionPlainString(perZone > 1 ? `RandomInRange(1, ${perZone})` : "1");
    const subs = rep.getSubEvents();
    subs.insertEvent(ev([], [
      setNum("Sorteo", "=", "RandomInRange(0, 99)"),
      setNum("SpawnX", "=", `RandomInRange(${zone}.X(), ${zone}.X() + ${zone}.Width() - 140)`),
    ]), 0);
    let from = 0;
    for (const [kind, weight, base] of choices) {
      if (!weight) continue;
      subs.insertEvent(ev([numIs("Sorteo", ">=", from), numIs("Sorteo", "<", from + weight)], create(kind, base, zone)), subs.getEventsCount());
      from += weight;
    }
    fe.getSubEvents().insertEvent(rep, 0);
    return fe;
  };
  // Zones and colliders are invisible helpers (hidden objects still collide).
  add(ev([I("SceneJustBegins", [""])], ["zonaEnemigo", "zonaSierra", "piso", "techo"].map((o) => I("Cache", [o]))));
  add(spawner("zonaEnemigo", E.perZone, [
    ["azul", E.azul, speed(E.speed)], ["verde", E.verde, speed(E.speed)], ["guardia", E.guardia, "0"], ["sierra", E.sierra, speed(E.sawSpeed)],
  ]));
  add(spawner("zonaSierra", 1, [["sierra", 100, speed(E.sawSpeed)]]));

  // ---- 8. Enemy behaviour: patrol their zone, chase Kaito when he is close on the floor ----
  const objVar = (o, v, op, val) => I("SetNumberObjectVariable", [o, v, op, val]);
  const objVarIs = (o, v, op, val) => I("NumberObjectVariable", [o, v, op, val]);
  const anim = (o, name) => I("AnimatableCapability::AnimatableBehavior::SetName", [o, "Animation", "=", q(name)]);
  add(ev([], [objVar("Patrulla", "Vel", "=", "Patrulla.Variable(Base)")]));
  add(ev([I("Distance", ["Enemigos", "kaito", "320", ""]), NOT("FlippedY", ["kaito"]), numIs("Muerto", "=", "0")],
    [objVar("Enemigos", "Vel", "=", "Enemigos.Variable(Base) * 1.8")], [
      ev([I("BoundingBoxCenterX", ["Enemigos", "<", "kaito.X()"])], [objVar("Enemigos", "Dir", "=", "1")]),
      ev([I("BoundingBoxCenterX", ["Enemigos", ">=", "kaito.X()"])], [objVar("Enemigos", "Dir", "=", "-1")]),
    ]));
  add(ev([objVarIs("Patrulla", "Dir", "=", "1")], [I("FlippableCapability::FlippableBehavior::FlipX", ["Patrulla", "Flippable", "no"])]));
  add(ev([objVarIs("Patrulla", "Dir", "=", "-1")], [I("FlippableCapability::FlippableBehavior::FlipX", ["Patrulla", "Flippable", "yes"])]));
  add(ev([], [I("SetX", ["Patrulla", "+", "Patrulla.Variable(Dir) * Patrulla.Variable(Vel) * TimeDelta()"])]));
  add(ev([I("PosX", ["Patrulla", "<", "Patrulla.Variable(MinX)"])], [I("SetX", ["Patrulla", "=", "Patrulla.Variable(MinX)"]), objVar("Patrulla", "Dir", "=", "1")]));
  add(ev([I("PosX", ["Patrulla", ">", "Patrulla.Variable(MaxX)"])], [I("SetX", ["Patrulla", "=", "Patrulla.Variable(MaxX)"]), objVar("Patrulla", "Dir", "=", "-1")]));
  add(ev([], [I("Rotate", ["cierra", "360", ""])]));
  add(ev([], [anim("Ninjas", "walk")]));
  add(ev([I("NumberObjectVariable", ["Ninjas", "Vel", ">", "Ninjas.Variable(Base)"])], [anim("Ninjas", "run")]));
  add(ev([I("Distance", ["Ninjas", "kaito", "120", ""])], [anim("Ninjas", "attack")]));
  // Golden crystals dropped by defeated enemies: a big energy refill.
  add(ev([coll("kaito", "cristaldorado"), numIs("Muerto", "=", "0")],
    [setNum("EnergiaGravedad", "+", "25"), I("Delete", ["cristaldorado", ""]), ...warn(q("+25 energía"))]));

  // ---- 9. Checkpoints (only used when falling out of the level) ----
  for (const cx of lay.checkpoints) {
    add(ev([I("PosX", ["kaito", ">", cx - 20]), numIs("CheckX", "<", cx)], [setNum("CheckX", "=", cx), setNum("CheckY", "=", KAITO_Y)]));
  }

  // ---- 10. Portal: opens with a share of the level's crystals ----
  add(ev([I("SceneJustBegins", [""])], [
    setNum("Requeridas", "=", `round(Count(cristal) * ${def.crystalsToOpen})`),
    setStr("NivelActual", def.name),
    ...warn(q(def.title)),
  ]));
  add(ev([numIs("Gemas", "<", "Variable(Requeridas)")], [I("OpacityCapability::OpacityBehavior::SetValue", ["puerta", "Opacity", "=", "110"])]));
  add(ev([numIs("Gemas", ">=", "Variable(Requeridas)"), numIs("PortalAbierto", "=", "0")], [
    setNum("PortalAbierto", "=", "1"),
    I("OpacityCapability::OpacityBehavior::SetValue", ["puerta", "Opacity", "=", "255"]),
    ...warn(q("¡El portal se abrió!")),
  ]));
  add(ev([coll("kaito", "puerta"), numIs("Muerto", "=", "0"), numIs("PortalAbierto", "=", "1")], [I("Scene", ["", q(def.next), ""])]));
  add(ev([coll("kaito", "puerta"), numIs("PortalAbierto", "=", "0"), timer("Aviso", ">", "1.6")],
    warn('"Faltan " + ToString(Variable(Requeridas) - Variable(Gemas)) + " cristales para abrir el portal"')));

  return { width: W, length: lay.length, crystals: lay.floorGems.length + lay.ceilGems.length + lay.airGems.length, zones: lay.zones.length, checkpoints: lay.checkpoints.length };
}
