// The ninjas: two more of them, every move of their sheets, and agility.
// - The red ninja: the team's sheet that the game did not use (NewSprite24-55), a shuriken thrower who
//   throws in pairs. The shadow ninja: drawn by tools/gdevelop/assets/make-sombra.mjs, it vanishes in smoke
//   and appears behind Kaito.
// - Every ninja throws shurikens from a distance (never from off screen behind Kaito), hops, lunges at Kaito
//   with a dash, stops to look around at the ends of its patrol, and uses idle, walk, run, attack (and the
//   shadow, jump) for each of those.
// - A shuriken can be reflected with the katana like the sorceress's spells: it flies back golden and fells
//   any enemy it meets.
import { append, makeEventHelpers, makeEventFinder } from "./events.mjs";
import { setAnimations, ensureImageResource, declareObjectNumbers } from "./objects.mjs";

export const NINJAS = ["ninjapatrullero", "ninjapatrullero2", "ninjarojo", "sombra"];
export const SHURIKENS = ["shurikenEnemigo", "shurikenReflejado"];
// every: seconds between throws; speed: of the shuriken (px/s); hop: chance to leap when one is due.
const STYLE = {
  ninjapatrullero: { every: [3.2, 5.2], speed: 430, hop: 0.35, lunge: true },
  ninjapatrullero2: { every: [3.6, 5.8], speed: 430, hop: 0.5, lunge: true },
  ninjarojo: { every: [1.8, 3.0], speed: 520, hop: 0.45, pairs: true },
  sombra: { every: [2.8, 4.6], speed: 480, hop: 0.3, lunge: true, teleport: true },
};
const AGILE = ["Lanzar", "Pose", "Aparece", "VY", "Suelo", "Salto", "Embiste", "Arremete", "Tele", "Pausa", "Rafaga", "Alto"];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function setupExtraEnemies(gd, project, objects, patrolVars) {
  const rm = project.getResourcesManager();
  const sheet = (i) => (rm.hasResource(`NewSprite${i}`) ? `NewSprite${i}` : ensureImageResource(gd, project, `assets/NewSprite${i}.png`));
  const rojo = objects.insertNewObject(project, "Sprite", "ninjarojo", objects.getObjectsCount());
  setAnimations(gd, rojo, [
    { name: "idle", images: range(24, 32).map(sheet), speed: 0.11 },
    { name: "walk", images: range(33, 48).map(sheet), speed: 0.07 },
    { name: "run", images: range(33, 48).map(sheet), speed: 0.04 },
    { name: "attack", images: range(49, 55).map(sheet), speed: 0.06 },
  ], { mask: [[36, 14], [94, 14], [94, 124], [36, 124]] });
  const sombra = objects.insertNewObject(project, "Sprite", "sombra", objects.getObjectsCount());
  const moves = { idle: [15, 0.1], walk: [16, 0.06], run: [8, 0.06], jump: [8, 0.08], attack: [10, 0.05] };
  setAnimations(gd, sombra, Object.entries(moves).map(([name, [n, speed]]) => ({
    name, speed, images: range(0, n - 1).map((i) => ensureImageResource(gd, project, `assets/sombra/${name}_${i}.png`)),
  })), { mask: [[40, 8], [90, 8], [90, 123], [40, 123]] });
  for (const o of [rojo, sombra]) declareObjectNumbers(o, patrolVars);
  for (const n of ["ninjapatrullero", "ninjapatrullero2"]) declareObjectNumbers(objects.getObject(n), AGILE);
  for (const o of [rojo, sombra]) declareObjectNumbers(o, AGILE);
  for (const name of SHURIKENS) {
    const s = objects.insertNewObject(project, "Sprite", name, objects.getObjectsCount());
    setAnimations(gd, s, [{ name: "", images: [ensureImageResource(gd, project, "assets/items/shuriken.png")] }]);
    declareObjectNumbers(s, ["Vel", "Edad"]);
  }
}

// The behaviour, in a level or the survival scene. pace scales the shurikens' speed; sound(name, volume,
// pitch) makes the sub-event that plays an effect.
export function addEnemyAgility({ gd, layout, pace = 1, sound, vary }) {
  const { I, NOT, ev, numIs, setNum, q, resetTimer } = makeEventHelpers(gd);
  const events = layout.getEvents();
  const { find } = makeEventFinder(gd, events, `enemies (${layout.getName()})`);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const vars = layout.getVariables();
  if (!vars.has("AvisoReflejo")) vars.insertNew("AvisoReflejo", vars.count());
  const objVar = (o, v, op, val) => I("SetNumberObjectVariable", [o, v, op, val]);
  const objVarIs = (o, v, op, val) => I("NumberObjectVariable", [o, v, op, val]);
  const anim = (o, name) => I("AnimatableCapability::AnimatableBehavior::SetName", [o, "Animation", "=", q(name)]);
  const near = (o, d) => I("Distance", [o, "kaito", String(d), ""]);
  const far = (o, d) => NOT("Distance", [o, "kaito", String(d), ""]);
  const onFloorTier = [NOT("FlippedY", ["kaito"]), numIs("Muerto", "=", "0")];
  const facingRight = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"], true);
  const facingLeft = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"]);
  const size = (o, s) => [I("ResizableCapability::ResizableBehavior::SetWidth", [o, "Resizable", "=", String(s)]), I("ResizableCapability::ResizableBehavior::SetHeight", [o, "Resizable", "=", String(s)])];
  const forEach = (object, conds, acts, subs = []) => {
    const fe = new gd.ForEachEvent();
    fe.setType("BuiltinCommonInstructions::ForEach");
    fe.setObjectToPick(object);
    for (const c of conds) append(fe.getConditions(), c);
    for (const a of acts) append(fe.getActions(), a);
    subs.forEach((s, i) => fe.getSubEvents().insertEvent(s, i));
    return fe;
  };
  const center = (o) => [`${o}.X() + ${o}.Width() / 2`, `${o}.Y() + ${o}.Height() / 2`];
  const before = [], after = [];

  // ---- clocks, and what a ninja learns when it appears (where its floor is) ----
  after.push(ev([], ["Lanzar", "Pose", "Aparece", "Salto", "Embiste", "Arremete", "Tele", "Pausa"].map((v) => objVar("Ninjas", v, "-", "TimeDelta()"))));
  after.push(ev([objVarIs("sombra", "Suelo", "=", "0"), objVarIs("sombra", "Alto", "=", "0")], [
    objVar("sombra", "MinX", "=", "max(100, sombra.Variable(MinX) - 800)"), objVar("sombra", "MaxX", "+", "800"),
    I("OpacityCapability::OpacityBehavior::SetValue", ["sombra", "Opacity", "=", "225"]),
  ]));
  after.push(ev([objVarIs("Ninjas", "Suelo", "=", "0")], [
    objVar("Ninjas", "Suelo", "=", "Ninjas.Y()"), objVar("Ninjas", "Lanzar", "=", "RandomFloatInRange(1.5, 3.5)"),
    objVar("Ninjas", "Salto", "=", "RandomFloatInRange(0.5, 2)"), objVar("Ninjas", "Embiste", "=", "RandomFloatInRange(0.8, 2.4)"),
    objVar("Ninjas", "Tele", "=", "RandomFloatInRange(1.5, 3)"),
  ]));

  for (const N of NINJAS) {
    const s = STYLE[N];
    // ---- leaps ----
    after.push(ev([objVarIs(N, "Salto", "<=", "0"), objVarIs(N, "VY", "=", "0"), near(N, 560), numIs("Muerto", "=", "0")],
      [objVar(N, "Salto", "=", "RandomFloatInRange(1.4, 3.2)")],
      [ev([I("BuiltinCommonInstructions::CompareNumbers", ["RandomFloat(1)", "<", String(s.hop)])], [objVar(N, "VY", "=", "-RandomFloatInRange(470, 600)")])]));
    // ---- a dash at Kaito ----
    if (s.lunge) after.push(ev([objVarIs(N, "Embiste", "<=", "0"), objVarIs(N, "VY", "=", "0"), near(N, 330), far(N, 140), ...onFloorTier], [
      objVar(N, "Embiste", "=", "RandomFloatInRange(2.4, 4.2)"), objVar(N, "Arremete", "=", "0.3"),
      I("Create", ["", "fxPolvo", center(N)[0], `${N}.Y() + ${N}.Height() - 8`, ""]),
    ]));
    // ---- shurikens: from ahead up to 760 px, from behind only while on screen (470 px) ----
    const throwAt = (dir) => [
      I("Create", ["", "shurikenEnemigo", `${N}.X() + ${N}.Width() / 2 - 18`, `${N}.Y() + ${N}.Height() - 100`, ""]),
      ...size("shurikenEnemigo", 36),
      I("ChangeColor", ["shurikenEnemigo", q("170;175;200")]),
      objVar("shurikenEnemigo", "Vel", "=", String(dir * Math.round(s.speed * pace))), objVar("shurikenEnemigo", "Edad", "=", "0"),
      objVar(N, "Pose", "=", "0.32"), objVar(N, "Dir", "=", String(dir)),
    ];
    const next = s.pairs
      ? [ // the red ninja throws two in a row, then waits
        ev([objVarIs(N, "Rafaga", "=", "1")], [objVar(N, "Rafaga", "=", "2"), objVar(N, "Lanzar", "=", `RandomFloatInRange(${s.every[0]}, ${s.every[1]})`)]),
        ev([objVarIs(N, "Rafaga", "=", "0")], [objVar(N, "Rafaga", "=", "1"), objVar(N, "Lanzar", "=", "0.3")]),
        ev([objVarIs(N, "Rafaga", "=", "2")], [objVar(N, "Rafaga", "=", "0")]),
      ]
      : [ev([], [objVar(N, "Lanzar", "=", `RandomFloatInRange(${s.every[0]}, ${s.every[1]})`)])];
    const level = I("BuiltinCommonInstructions::CompareNumbers", [`abs(kaito.Y() + 60 - (${N}.Y() + ${N}.Height()))`, "<", "110"]);
    after.push(forEach(N, [objVarIs(N, "Lanzar", "<=", "0"), objVarIs(N, "Aparece", "<=", "0"), objVarIs(N, "VY", "=", "0"), near(N, 760), far(N, 210), ...onFloorTier, level], [], [
      ev([I("PosX", [N, ">", "kaito.X()"])], throwAt(-1), [...next, sound("shuriken", 45, vary)]),
      ev([I("PosX", [N, "<=", "kaito.X()"]), near(N, 470), objVarIs(N, "Pose", "<=", "0")], throwAt(1), [...next, sound("shuriken", 45, vary)]),
    ]));
  }
  // ---- the shadow vanishes in smoke and appears behind Kaito, still for half a second before it strikes ----
  after.push(forEach("sombra", [objVarIs("sombra", "Tele", "<=", "0"), objVarIs("sombra", "Alto", "=", "0"), objVarIs("sombra", "VY", "=", "0"), near("sombra", 720), far("sombra", 280), ...onFloorTier], [
    I("Create", ["", "fxMagia", ...center("sombra"), ""]),
    objVar("sombra", "Tele", "=", "RandomFloatInRange(3.8, 6.2)"), objVar("sombra", "Aparece", "=", "0.5"),
  ], [
    ev([facingRight], [I("SetX", ["sombra", "=", "kaito.X() - 175 - sombra.Width() / 2"]), objVar("sombra", "Dir", "=", "1")]),
    ev([facingLeft], [I("SetX", ["sombra", "=", "kaito.X() + 175 - sombra.Width() / 2"]), objVar("sombra", "Dir", "=", "-1")]),
    ev([], [I("Create", ["", "fxMagia", ...center("sombra"), ""])], [sound("sombra", 60)]),
  ]));
  // ---- hops: up, and back down on its own floor ----
  after.push(ev([objVarIs("Ninjas", "VY", "!=", "0")], [objVar("Ninjas", "VY", "+", "1750 * TimeDelta()"), I("SetY", ["Ninjas", "+", "Ninjas.Variable(VY) * TimeDelta()"])]));
  after.push(ev([objVarIs("Ninjas", "VY", ">", "0"), I("PosY", ["Ninjas", ">=", "Ninjas.Variable(Suelo)"])], [I("SetY", ["Ninjas", "=", "Ninjas.Variable(Suelo)"]), objVar("Ninjas", "VY", "=", "0")]));

  // ---- speed, worked out before the patrol moves them: chase sooner and faster, dash, stop and look ----
  before.push(ev([near("Ninjas", 430), ...onFloorTier], [objVar("Ninjas", "Vel", "=", "Ninjas.Variable(Base) * 2.1")], [
    ev([I("BoundingBoxCenterX", ["Ninjas", "<", "kaito.X()"])], [objVar("Ninjas", "Dir", "=", "1")]),
    ev([I("BoundingBoxCenterX", ["Ninjas", ">=", "kaito.X()"])], [objVar("Ninjas", "Dir", "=", "-1")]),
  ]));
  before.push(ev([objVarIs("Ninjas", "Arremete", ">", "0")], [objVar("Ninjas", "Vel", "=", "Ninjas.Variable(Base) * 4.2 + 200")]));
  for (const [op, edge] of [["<=", "Ninjas.Variable(MinX) + 1"], [">=", "Ninjas.Variable(MaxX) - 1"]]) {
    before.push(ev([I("PosX", ["Ninjas", op, edge]), objVarIs("Ninjas", "Pausa", "<", "-1"), far("Ninjas", 430)], [objVar("Ninjas", "Pausa", "=", "0.7")]));
  }
  for (const v of ["Pausa", "Pose", "Aparece"]) before.push(ev([objVarIs("Ninjas", v, ">", "0")], [objVar("Ninjas", "Vel", "=", "0")]));

  // ---- the moves they show, over the walk/run/attack the level already sets ----
  after.push(ev([objVarIs("Ninjas", "Pausa", ">", "0")], [anim("Ninjas", "idle")]));
  after.push(ev([objVarIs("Ninjas", "Aparece", ">", "0")], [anim("Ninjas", "idle")]));
  for (const v of ["Arremete", "Pose"]) after.push(ev([objVarIs("Ninjas", v, ">", "0")], [anim("Ninjas", "attack")]));
  for (const N of NINJAS) after.push(ev([objVarIs(N, "VY", "!=", "0")], [anim(N, N === "sombra" ? "jump" : "attack")]));

  // ---- shurikens in flight ----
  after.push(ev([], [I("SetX", ["shurikenEnemigo", "+", "shurikenEnemigo.Variable(Vel) * TimeDelta()"]), I("Rotate", ["shurikenEnemigo", "-900", ""]), objVar("shurikenEnemigo", "Edad", "+", "TimeDelta()")]));
  after.push(ev([], [I("SetX", ["shurikenReflejado", "+", "shurikenReflejado.Variable(Vel) * TimeDelta()"]), I("Rotate", ["shurikenReflejado", "1300", ""]), objVar("shurikenReflejado", "Edad", "+", "TimeDelta()")]));
  for (const o of SHURIKENS) after.push(ev([objVarIs(o, "Edad", ">", "2.6")], [I("Delete", [o, ""])]));
  // reflected with the katana: it flies back golden, faster
  const reflect = [
    I("Create", ["", "shurikenReflejado", "shurikenEnemigo.X()", "shurikenEnemigo.Y()", ""]), ...size("shurikenReflejado", 36),
    objVar("shurikenReflejado", "Vel", "=", "-1.8 * shurikenEnemigo.Variable(Vel)"), objVar("shurikenReflejado", "Edad", "=", "0"),
    I("ChangeColor", ["shurikenReflejado", q("255;215;110")]),
    I("Create", ["", "fxCristal", ...center("shurikenEnemigo"), ""]),
    I("Delete", ["shurikenEnemigo", ""]),
    setNum("Temblor", "=", "max(Variable(Temblor), 4)"),
  ];
  const firstTime = ev([numIs("AvisoReflejo", "=", "0")], [setNum("AvisoReflejo", "=", "1"),
    I("TextContainerCapability::TextContainerBehavior::SetValue", ["Aviso", "Text", "=", q("¡Shuriken reflejado!")]), I("Montre", ["Aviso", ""]), resetTimer("Aviso")]);
  after.push(forEach("shurikenEnemigo", [numIs("Atacando", "=", "1"), near("shurikenEnemigo", 125), numIs("Muerto", "=", "0")], [], [
    ev([facingRight, I("PosX", ["shurikenEnemigo", ">=", "kaito.X() - 30"])], reflect, [sound("reflejo", 50, vary), firstTime]),
    ev([facingLeft, I("PosX", ["shurikenEnemigo", "<=", "kaito.X() + 30"])], reflect, [sound("reflejo", 50, vary), firstTime]),
  ]));
  // a reflected shuriken fells the enemy it meets (and leaves its golden crystal, like a katana blow)
  after.push(ev([I("CollisionNP", ["shurikenReflejado", "Enemigos", "", "", ""])], [
    I("Create", ["", "cristaldorado", "Enemigos.BoundingBoxCenterX() - 22", "Enemigos.BoundingBoxBottom() - 70", ""]), ...size("cristaldorado", 44),
    I("Create", ["", "fxGolpe", "Enemigos.BoundingBoxCenterX()", "Enemigos.BoundingBoxCenterY()", ""]),
    I("Delete", ["Enemigos", ""]), I("Delete", ["shurikenReflejado", ""]),
  ], [sound("enemigo", 65, vary)]));
  // one that reaches Kaito has done its damage (the damage event, earlier, hurts him through "Peligro")
  after.push(ev([I("CollisionNP", ["kaito", "shurikenEnemigo", "", "", ""])], [I("Delete", ["shurikenEnemigo", ""])]));

  const move = find((c, a) => has(a, "SetX", "Patrulla", "+"), "patrol movement");
  before.forEach((e, i) => events.insertEvent(e, move.index + i));
  for (const e of after) events.insertEvent(e, events.getEventsCount());
  return before.length + after.length;
}

// Ninjas up high: on top of the wide slabs and on the upper steps of the towers (not on the platforms over
// the pits, where one would make the jump unfair). Each surface draws on every (re)start, after the slots,
// whether a ninja stands guard on it and which one, and there is always at least one up high; it patrols the
// width of its surface (Alto = 1: the shadow neither widens its range nor teleports from up there, so it
// never ends up standing on air).
export function addUpperEnemies({ gd, layout, floorLine, chance, kinds, speed }) {
  const { I, ev, numIs, setNum } = makeEventHelpers(gd);
  const events = layout.getEvents(), vars = layout.getVariables();
  if (!vars.has("Guardias")) vars.insertNew("Guardias", vars.count());
  const surfaces = [["sueloLosa", 300], ["plataforma", 200]];
  const pass = (surface, minWidth, conds) => {
    const fe = new gd.ForEachEvent();
    fe.setType("BuiltinCommonInstructions::ForEach");
    fe.setObjectToPick(surface);
    for (const c of [I("SceneJustBegins", [""]), ...conds,
      I("BuiltinCommonInstructions::CompareNumbers", [`${surface}.Width()`, ">=", String(minWidth)]),
      I("BuiltinCommonInstructions::CompareNumbers", [`${surface}.Y() + 31`, "<", String(floorLine - 200)]),
    ]) append(fe.getConditions(), c);
    for (const a of [setNum("Sorteo", "=", "RandomInRange(0, 99)"), setNum("Guardias", "+", "1")]) append(fe.getActions(), a);
    let from = 0, i = 0;
    for (const [, weight, { object: o, w, h, top }] of kinds) {
      fe.getSubEvents().insertEvent(ev([numIs("Sorteo", ">=", String(from)), numIs("Sorteo", "<", String(from + weight))], [
        I("Create", ["", o, `${surface}.X() + RandomFloat(max(0, ${surface}.Width() - ${w}))`, `${surface}.Y() + 31 - ${top}`, ""]),
        I("ResizableCapability::ResizableBehavior::SetWidth", [o, "Resizable", "=", String(w)]),
        I("ResizableCapability::ResizableBehavior::SetHeight", [o, "Resizable", "=", String(h)]),
        I("SetNumberObjectVariable", [o, "MinX", "=", `${surface}.X()`]),
        I("SetNumberObjectVariable", [o, "MaxX", "=", `${surface}.X() + ${surface}.Width() - ${w}`]),
        I("SetNumberObjectVariable", [o, "Base", "=", `RandomInRange(${speed[0]}, ${speed[1]})`]),
        I("SetNumberObjectVariable", [o, "Dir", "=", "RandomInRange(0, 1) * 2 - 1"]),
        I("SetNumberObjectVariable", [o, "Alto", "=", "1"]),
      ]), i++);
      from += weight;
    }
    events.insertEvent(fe, events.getEventsCount());
  };
  events.insertEvent(ev([I("SceneJustBegins", [""])], [setNum("Guardias", "=", "0")]), events.getEventsCount());
  for (const [surface, minWidth] of surfaces) pass(surface, minWidth, [I("BuiltinCommonInstructions::CompareNumbers", ["RandomFloat(1)", "<", String(chance)])]);
  // none came out: one more draw at even odds, then the first high surface there is
  for (const [surface, minWidth] of surfaces) pass(surface, minWidth, [numIs("Guardias", "=", "0"), I("BuiltinCommonInstructions::CompareNumbers", ["RandomFloat(1)", "<", "0.5"])]);
  for (const [surface, minWidth] of surfaces) pass(surface, minWidth, [numIs("Guardias", "=", "0")]);
  return surfaces.length * 3;
}
