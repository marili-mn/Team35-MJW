// Step 03 — Physics, hitboxes and gravity rules, driven by the playtest (controls 3.43/5, 57% "slippery",
// floaty jump, unfair spike collisions, flying out of the map with the gravity flip).
import { append, makeEventHelpers, makeEventFinder, makeLayoutHelpers } from "../../lib/events.mjs";
import { setSpriteMask, useFullImageMask, setBehaviorProperties, cloneTextObject } from "../../lib/objects.mjs";

// Measured in the browser (open area, frame by frame): stops in 8 px walking / 32 px running (was slippery);
// jump apex 222 px tapped / 258 px held, 0.82 s in the air, 255 px long walking, so a 150 px spike can be
// cleared taking off anywhere in a ~73 px window. Was ~450 px tapped / ~700 px held (floaty) and then
// 1800/1200 (0.67 s in the air, felt like a trampoline).
export const KAITO_PHYSICS = {
  Acceleration: 2500, Deceleration: 4000, Gravity: 1000, JumpSpeed: 850, JumpSustainTime: 0.22, MaxFallingSpeed: 650,
};
// Body only, symmetric around the 64 px origin so flipping left/right does not move the hitbox
// (the old one was 28..113, centered 6.5 px to the right). Feet stay at y=124 (floor contact unchanged).
export const KAITO_MASK = [[40, 4], [88, 4], [88, 124], [40, 124]];
// pinchos.png is 2172x724: keep the solid lower part, not the empty space around the tips.
const SPIKE_MASK = [[110, 320], [2060, 320], [2148, 679], [25, 679]];
export const FLIP_COST = 20;         // energy to flip up; flipping down is free
const CEILING_RANGE = 400;           // max distance (px) above Kaito's head to accept a flip
const LEVEL_W = 6400;

export default function physicsAndGravityRules({ gd, project }) {
  const t = project.getLayout("Tutorial");
  const objects = t.getObjects();
  const events = t.getEvents();
  const { I, NOT, ev, q, setNum, numIs, keyJust, timer, resetTimer } = makeEventHelpers(gd);
  const { addInst } = makeLayoutHelpers(gd, t);
  const { find } = makeEventFinder(gd, events, "step 03");

  // ---- 1. Physics ----
  const applied = setBehaviorProperties(objects.getObject("kaito"), "PlatformerObject", KAITO_PHYSICS);
  for (const [k, v] of Object.entries(KAITO_PHYSICS)) {
    if (Number(applied[k]) !== v) throw new Error(`step 03: ${k} is ${applied[k]}, expected ${v}`);
  }

  // ---- 2. Hitboxes ----
  const kaitoFrames = setSpriteMask(gd, objects.getObject("kaito"), KAITO_MASK);
  setSpriteMask(gd, objects.getObject("pinchos"), SPIKE_MASK);
  useFullImageMask(gd, objects.getObject("detectodetecho")); // was a 14 px line: it never saw the ceiling

  // ---- 3. Ceiling detector: a 40x400 box right above Kaito's head ----
  const detector = find((c, a) => a.some((x) => x.type === "SetY" && x.params[0] === "detectodetecho"), "detector position");
  const detActions = detector.event.getActions();
  detActions.clear();
  for (const a of [
    I("SetX", ["detectodetecho", "=", "kaito.X() - 20"]),
    I("SetY", ["detectodetecho", "=", `kaito.Y() - 60 - ${CEILING_RANGE}`]),
    I("ResizableCapability::ResizableBehavior::SetWidth", ["detectodetecho", "Resizable", "=", "40"]),
    I("ResizableCapability::ResizableBehavior::SetHeight", ["detectodetecho", "Resizable", "=", CEILING_RANGE]),
  ]) append(detActions, a);
  const noCeiling = find((c) => c.length === 1 && c[0].inverted && c[0].type === "CollisionNP" && c[0].params[0] === "detectodetecho", "no-ceiling event");
  append(noCeiling.event.getActions(), setNum("puedeInvertir", "=", "0"));

  // ---- 4. Energy: flipping up costs FLIP_COST, hanging drains it, it only recharges on the floor ----
  const oldCost = find((c) => c.some((x) => x.type === "KeyFromTextJustPressed" && x.params[1] === '"LAlt"') && c.some((x) => x.params[0] === "EnergiaGravedad"), "old flip cost");
  events.removeEventAt(oldCost.index);
  const regen = find((c) => c.some((x) => x.type === "CompareTimer" && x.params[1] === '"RecuperacionEnergia"'), "energy regen");
  const regenTimer = regen.event.getConditions().get(0);
  regenTimer.setParameter(3, "0.5");
  append(regen.event.getConditions(), NOT("FlippedY", ["kaito"]));

  // ---- 5. Warning text (HUD) ----
  cloneTextObject(gd, project, objects, "TextoGemas", "Aviso", { text: "", size: 30, color: "255;214;102" });
  addInst("Aviso", 470, 90, 0, 0, { layer: "HUD", z: 6 });
  const warn = (text) => [
    I("TextContainerCapability::TextContainerBehavior::SetValue", ["Aviso", "Text", "=", q(text)]),
    I("Montre", ["Aviso", ""]),
    resetTimer("Aviso"),
  ];
  // The extension only flips while its FlippingTrigger is false: setting it blocks the flip until ALT is released.
  const blockFlip = () => I("SetObjectVariableAsBoolean", ["kaito", "__FlipGravityExtension.FlippingTrigger", "True"]);

  // ---- 6. Gate the flip before the extension runs ----
  const flipCall = find((c, a) => a.some((x) => x.type === "FlipGravity::FlipGravity2Objects"), "flip extension call");
  events.insertEvent(ev([NOT("FlippedY", ["kaito"]), keyJust("LAlt"), numIs("puedeInvertir", "=", "0")],
    [blockFlip(), ...warn("No hay techo arriba")]), flipCall.index);
  events.insertEvent(ev([NOT("FlippedY", ["kaito"]), keyJust("LAlt"), numIs("puedeInvertir", "=", "1"), numIs("EnergiaGravedad", "<", FLIP_COST)],
    [blockFlip(), ...warn("Sin energía: juntá cristales")]), flipCall.index + 1);

  // ---- 7. Rules that run after the extension ----
  const add = (e) => events.insertEvent(e, events.getEventsCount());
  add(ev([I("SceneJustBegins", [""])], [I("Cache", ["Aviso"]), I("Cache", ["detectodetecho"])]));
  // Sub-events of "Kaito is up": the "Trigger once" is only evaluated while he hangs, so it fires once
  // per flip (a "Trigger once" evaluated every frame would be consumed while he is on the floor).
  add(ev([I("FlippedY", ["kaito"])], [], [
    ev([I("BuiltinCommonInstructions::Once", [])], [setNum("EnergiaGravedad", "-", FLIP_COST), resetTimer("Drenaje")]),
    ev([timer("Drenaje", ">", "0.5")], [setNum("EnergiaGravedad", "-", "1"), resetTimer("Drenaje")]),
    ev([numIs("EnergiaGravedad", "<=", "0"), numIs("Bajar", "=", "0")], [setNum("Bajar", "=", "1"), ...warn("Sin energía")]),
  ]));
  add(ev([numIs("EnergiaGravedad", "<", "0")], [setNum("EnergiaGravedad", "=", "0")]));
  add(ev([timer("Aviso", ">", "1.5")], [I("Cache", ["Aviso"])]));

  // ---- 8. Safety net: an invisible ceiling over the whole level, so Kaito can never leave the map upwards ----
  addInst("techo", 0, -55, LEVEL_W, 64, { z: 0 });

  return `Tutorial: physics ${JSON.stringify(KAITO_PHYSICS)}, Kaito mask on ${kaitoFrames} frames, ${events.getEventsCount()} events`;
}
