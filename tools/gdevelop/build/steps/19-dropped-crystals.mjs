// Step 19 — Getting hurt costs crystals, but they can be won back. A hit makes Kaito drop up to 3 of the
// crystals he carries: they spring out, fall and bounce on the floor, and can be picked up again for a
// few seconds (not in the first 0.6 s, so they do not come straight back), blinking before they go.
// One that is not recovered is not lost for good: it turns up again as a normal crystal further along
// the level, so the portal can always be opened.
import { makeEventHelpers, makeEventFinder, makeLayoutHelpers } from "../../lib/events.mjs";
import { insertObjectFrom, serializeObject, declareObjectNumbers } from "../../lib/objects.mjs";
import { PLAYABLE, SURVIVAL_SCENE } from "../../lib/scenes.mjs";

const MAX_DROP = 3;
const LIFE = 4.5, PICKUP_AFTER = 0.6, BLINK_AFTER = 3;
const GRAVITY = 1400;

export default function droppedCrystals({ gd, project }) {
  const { I, ev, q, setNum, numIs, resetTimer } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const objVar = (v, op, val) => I("SetNumberObjectVariable", ["cristalCaido", v, op, val]);
  const objVarIs = (v, op, val) => I("NumberObjectVariable", ["cristalCaido", v, op, val]);
  const report = [];

  for (const name of PLAYABLE) {
    const layout = project.getLayout(name);
    const objects = layout.getObjects();
    const events = layout.getEvents();
    const { find } = makeEventFinder(gd, events, `step 19 (${name})`);
    const { allInstances } = makeLayoutHelpers(gd, layout);
    const vars = layout.getVariables();
    if (!vars.has("Perdidos")) vars.insertNew("Perdidos", vars.count());
    const dropped = insertObjectFrom(gd, project, objects, "cristalCaido", serializeObject(gd, objects.getObject("cristal")));
    declareObjectNumbers(dropped, ["VX", "VY", "Edad", "Lado"]);

    // Where they bounce and where a lost one comes back: the floor line and the playable width.
    const instances = allInstances();
    const kaito = instances.find((i) => i.getObjectName() === "kaito");
    const floorY = Math.round(kaito.getY() + 60 - 52);
    const camera = find((c, a) => has(a, "FixCamera"), "camera");
    let right = 0;
    const acts = camera.event.getActions();
    for (let i = 0; i < acts.size(); i++) if (acts.get(i).getType() === "FixCamera") right = Number(acts.get(i).getParameter(4).getPlainString()) - 600;
    const wall = instances.filter((i) => i.getObjectName() === "pared").map((i) => i.getX()).sort((a, b) => b - a)[0];
    if (name === SURVIVAL_SCENE && wall) right = wall - 300;
    const ahead = name === SURVIVAL_SCENE ? "RandomInRange(-700, 700)" : "RandomInRange(700, 2200)";

    // ---- the hit: lose up to MAX_DROP crystals, flung out of Kaito ----
    const hurt = find((c, a) => c.some((x) => x.type === "CollisionNP" && x.params[0] === "kaito") && has(a, "SetNumberVariable", "Vidas", "-"), "damage");
    const hurtActs = hurt.event.getActions();
    for (const a of [setNum("Perdidos", "=", `min(${MAX_DROP}, Variable(Gemas))`), setNum("Gemas", "-", "Variable(Perdidos)")]) hurtActs.insert(a, hurtActs.size());
    const fling = new gd.RepeatEvent();
    fling.setType("BuiltinCommonInstructions::Repeat");
    fling.setRepeatExpressionPlainString("Variable(Perdidos)");
    fling.getSubEvents().insertEvent(ev([], [
      I("Create", ["", "cristalCaido", "kaito.X() - 20", "kaito.Y() - 30", ""]),
      I("ResizableCapability::ResizableBehavior::SetWidth", ["cristalCaido", "Resizable", "=", "40"]),
      I("ResizableCapability::ResizableBehavior::SetHeight", ["cristalCaido", "Resizable", "=", "42"]),
      I("SetZOrder", ["cristalCaido", "=", "45"]),
      // Lado: the side it flies to, and the side it slides off a spike run to (one direction, so it cannot
      // bounce back and forth between two spikes).
      objVar("Lado", "=", "RandomInRange(0, 1) * 2 - 1"),
      objVar("VX", "=", "cristalCaido.Variable(Lado) * RandomInRange(60, 280)"),
      objVar("VY", "=", "RandomInRange(-560, -380)"),
      objVar("Edad", "=", "0"),
    ]), 0);
    hurt.event.getSubEvents().insertEvent(fling, hurt.event.getSubEvents().getEventsCount());
    hurt.event.getSubEvents().insertEvent(ev([numIs("Perdidos", ">", "0")], [
      I("TextContainerCapability::TextContainerBehavior::SetValue", ["Aviso", "Text", "=", '"-" + ToString(Variable(Perdidos)) + " cristales: ¡juntalos!"']),
      I("Montre", ["Aviso", ""]), resetTimer("Aviso"),
    ]), hurt.event.getSubEvents().getEventsCount());

    // ---- flight: gravity, a bouncing landing on the floor ----
    const add = (e) => events.insertEvent(e, events.getEventsCount());
    add(ev([], [
      objVar("VY", "+", `${GRAVITY} * TimeDelta()`),
      I("SetX", ["cristalCaido", "+", "cristalCaido.Variable(VX) * TimeDelta()"]),
      I("SetY", ["cristalCaido", "+", "cristalCaido.Variable(VY) * TimeDelta()"]),
      objVar("Edad", "+", "TimeDelta()"),
    ]));
    add(ev([I("PosY", ["cristalCaido", ">", String(floorY)])], [
      I("SetY", ["cristalCaido", "=", String(floorY)]), objVar("VY", "=", "-cristalCaido.Variable(VY) * 0.45"), objVar("VX", "*", "0.7"),
    ]));
    // A crystal that lands on a floor spike slides off along its side, so it can always be picked up.
    // Checked crystal by crystal with positions (not collision masks): the spike under its center.
    const slide = new gd.ForEachEvent();
    slide.setType("BuiltinCommonInstructions::ForEach");
    slide.setObjectToPick("cristalCaido");
    for (const c of [
      I("PosY", ["cristalCaido", ">=", String(floorY - 5)]),
      I("PosY", ["pinchos", ">", String(floorY - 30)]),
      I("PosX", ["pinchos", "<", "cristalCaido.X() + 20"]),
      I("PosX", ["pinchos", ">", "cristalCaido.X() + 20 - pinchos.Width()"]),
    ].reverse()) slide.getConditions().insert(c, 0);
    slide.getActions().insert(objVar("VX", "=", "0"), 0);
    slide.getSubEvents().insertEvent(ev([objVarIs("Lado", "<", "0")], [I("SetX", ["cristalCaido", "=", "pinchos.X() - 46"])]), 0);
    slide.getSubEvents().insertEvent(ev([objVarIs("Lado", ">=", "0")], [I("SetX", ["cristalCaido", "=", "pinchos.X() + pinchos.Width() + 6"])]), 1);
    add(slide);
    // ---- picking them up again ----
    add(ev([I("CollisionNP", ["kaito", "cristalCaido", "", "", ""]), objVarIs("Edad", ">", String(PICKUP_AFTER)), numIs("Muerto", "=", "0")], [
      setNum("Gemas", "+", "Count(cristalCaido)"),
      I("Create", ["", "fxCristal", "cristalCaido.X() + 20", "cristalCaido.Y() + 20", ""]),
      I("Delete", ["cristalCaido", ""]),
    ], [ev([numIs("SoundOn", "=", "1")], [I("PlaySound", ["", "assets/audio/cristal.wav", "no", "60", "1"])])]));
    // ---- blinking, then back somewhere further along as a normal crystal ----
    add(ev([objVarIs("Edad", ">", String(BLINK_AFTER))], [
      I("OpacityCapability::OpacityBehavior::SetValue", ["cristalCaido", "Opacity", "=", "60 + 195 * mod(floor(cristalCaido.Variable(Edad) * 10), 2)"]),
    ]));
    const back = new gd.ForEachEvent();
    back.setType("BuiltinCommonInstructions::ForEach");
    back.setObjectToPick("cristalCaido");
    back.getConditions().insert(objVarIs("Edad", ">", String(LIFE)), 0);
    back.getActions().insert(I("Delete", ["cristalCaido", ""]), 0);
    for (const a of [
      I("Create", ["", "cristal", `clamp(kaito.X() + ${ahead}, 200, ${right})`, String(floorY - 24), ""]),
      I("ResizableCapability::ResizableBehavior::SetWidth", ["cristal", "Resizable", "=", "49"]),
      I("ResizableCapability::ResizableBehavior::SetHeight", ["cristal", "Resizable", "=", "52"]),
    ].reverse()) back.getActions().insert(a, 0);
    // Not on top of spikes either: step along until it is clear of them.
    const clear = new gd.RepeatEvent();
    clear.setType("BuiltinCommonInstructions::Repeat");
    clear.setRepeatExpressionPlainString("8");
    clear.getSubEvents().insertEvent(ev([
      I("PosY", ["pinchos", ">", String(floorY - 30)]),
      I("PosX", ["pinchos", "<", "cristal.X() + 25"]),
      I("PosX", ["pinchos", ">", "cristal.X() + 25 - pinchos.Width()"]),
    ], [I("SetX", ["cristal", "+", "130"])]), 0);
    back.getSubEvents().insertEvent(clear, 0);
    add(back);
    report.push(name);
  }
  return `${report.join(", ")}: a hit drops up to ${MAX_DROP} crystals, ${LIFE} s to pick them up again, then they reappear further along`;
}
