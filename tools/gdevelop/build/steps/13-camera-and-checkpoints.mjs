// Step 13 — Reading ahead and feedback.
// - Camera look-ahead: the view eases 150 px towards where Kaito faces, so the spikes, saws and spells
//   coming at him show up earlier (at 450 px/s running, that is a third of a second more to react).
// - Checkpoints (levels): passing one now says so, with a sparkle, instead of happening silently.
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";

import { PLAYABLE } from "../../lib/scenes.mjs";
const LOOK_AHEAD = 150, HALF_SCREEN = 640;

export default function cameraAndCheckpoints({ gd, project }) {
  const { I, ev, q, setNum, resetTimer } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const report = [];
  for (const name of PLAYABLE) {
    const layout = project.getLayout(name);
    const events = layout.getEvents();
    const { find } = makeEventFinder(gd, events, `step 13 (${name})`);
    const vars = layout.getVariables();
    if (!vars.has("Mirada")) vars.insertNew("Mirada", vars.count());

    // ---- look-ahead, between the camera follow and the shake (step 09) ----
    const camera = find((c, a) => has(a, "FixCamera"), "camera");
    const fix = camera.event.getActions();
    let width = null, height = null;
    for (let i = 0; i < fix.size(); i++) {
      if (fix.get(i).getType() !== "FixCamera") continue;
      width = Number(fix.get(i).getParameter(4).getPlainString());
      height = Number(fix.get(i).getParameter(5).getPlainString());
    }
    if (!width || !height) throw new Error(`step 13 (${name}): camera bounds not found`);
    if (!vars.has("CamY")) vars.insertNew("CamY", vars.count());
    vars.get("CamY").setValue(height - 360);
    const facingLeft = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"]);
    const facingRight = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"], true);
    const ease = (target) => setNum("Mirada", "=", `Variable(Mirada) + (${target} - Variable(Mirada)) * min(1, 3 * TimeDelta())`);
    [
      ev([facingRight], [ease(LOOK_AHEAD)]),
      ev([facingLeft], [ease(-LOOK_AHEAD)]),
      // From Kaito, not from the camera: near the ends of the level the camera is already held at the
      // edge, and adding the look-ahead to it pushed Kaito off the screen (at the start he was at x=-50).
      ev([], [I("CameraX", ["", "=", `clamp(kaito.X() + Variable(Mirada), ${HALF_SCREEN}, ${width - HALF_SCREEN})`, "", "0"])]),
      // Up and down (levels taller than the screen): a normal jump does not move the view, climbing to the
      // platforms or flipping up to a high ceiling does, smoothly. Kaito stays ~150 px under the top edge.
      ev([], [
        setNum("CamY", "=", `Variable(CamY) + (clamp(kaito.Y() + 210, 360, ${height - 360}) - Variable(CamY)) * min(1, 5 * TimeDelta())`),
        I("CameraY", ["", "=", "Variable(CamY)", "", "0"]),
      ]),
    ].reverse().forEach((e) => events.insertEvent(e, camera.index + 1));

    // ---- checkpoints say so ----
    let checkpoints = 0;
    if (name !== "Tutorial") {
      for (const event of checkpointEvents()) {
        const acts = event.getActions();
        for (const a of [
          I("TextContainerCapability::TextContainerBehavior::SetValue", ["Aviso", "Text", "=", q("Punto de control")]),
          I("Montre", ["Aviso", ""]), resetTimer("Aviso"),
          I("Create", ["", "fxCristal", "kaito.X()", "kaito.Y()", ""]), I("SetZOrder", ["fxCristal", "=", "50"]),
        ]) acts.insert(a, acts.size());
        checkpoints++;
      }
      if (!checkpoints) throw new Error(`step 13 (${name}): no checkpoints found`);
    }
    report.push(`${name}: look-ahead ${LOOK_AHEAD} px${checkpoints ? `, ${checkpoints} checkpoints announced` : ""}`);

    // Level checkpoints (lib/level.mjs, section 9): "Kaito past x, CheckX below x" -> "CheckX = x".
    function checkpointEvents() {
      const found = [];
      const named = (list, type) => {
        for (let j = 0; j < list.size(); j++) if (list.get(j).getType() === type && list.get(j).getParameter(0).getPlainString() === "CheckX") return true;
        return false;
      };
      for (let i = 0; i < events.getEventsCount(); i++) {
        const e = events.getEventAt(i);
        if (e.getType() !== "BuiltinCommonInstructions::Standard") continue;
        const s = gd.asStandardEvent(e);
        if (named(s.getConditions(), "NumberVariable") && named(s.getActions(), "SetNumberVariable")) found.push(s);
      }
      return found;
    }
  }
  return report.join("; ");
}
