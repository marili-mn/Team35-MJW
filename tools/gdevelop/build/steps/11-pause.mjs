// Step 11 — Pause (any game on sale has one). P or Esc stops the level (time scale 0: physics, timers,
// enemies and spells freeze) under a dark veil with "PAUSA"; P/Esc again resumes and M goes back to the
// menu. While paused the game ignores its other keys, so no attack or flip slips through.
import { append, makeEventHelpers, makeLayoutHelpers } from "../../lib/events.mjs";
import { cloneTextObject } from "../../lib/objects.mjs";

const PLAYABLE = ["Tutorial", "Nivel1", "Nivel2", "Nivel3"];
const KEY_CONDITIONS = ["KeyFromTextJustPressed", "KeyFromTextPressed", "KeyFromTextReleased", "KeyPressed", "KeyReleased"];

export default function pause({ gd, project }) {
  const { I, ev, q, numIs, setNum, keyJust } = makeEventHelpers(gd);
  let guarded = 0;
  for (const name of PLAYABLE) {
    const layout = project.getLayout(name);
    const objects = layout.getObjects();
    const events = layout.getEvents();
    const vars = layout.getVariables();
    for (const v of ["Pausado", "TeclaPausa"]) if (!vars.has(v)) vars.insertNew(v, vars.count());

    // ---- every key the game reads now waits while paused ----
    const notPaused = () => numIs("Pausado", "=", "0");
    const guard = (list) => {
      for (let i = 0; i < list.getEventsCount(); i++) {
        const e = list.getEventAt(i);
        if (e.getType() === "BuiltinCommonInstructions::Standard") {
          const conds = gd.asStandardEvent(e).getConditions();
          let reads = false;
          for (let j = 0; j < conds.size(); j++) if (KEY_CONDITIONS.includes(conds.get(j).getType())) reads = true;
          if (reads) { append(conds, notPaused()); guarded++; }
        }
        if (e.canHaveSubEvents()) guard(e.getSubEvents());
      }
    };
    guard(events);

    // ---- the veil and its texts, on the HUD ----
    const veil = objects.insertNewObject(project, "PrimitiveDrawing::Drawer", "fondoPausa", objects.getObjectsCount());
    const shape = gd.asShapePainterConfiguration(veil.getConfiguration());
    shape.setCoordinatesAbsolute();
    shape.setClearBetweenFrames(true);
    shape.setFillColor("8;4;20");
    shape.setFillOpacity(175);
    shape.setOutlineSize(0);
    cloneTextObject(gd, project, objects, "TextoGemas", "TextoPausa", { text: "PAUSA", size: 76, color: "255;214;102", align: "center" });
    cloneTextObject(gd, project, objects, "TextoGemas", "AyudaPausa", { text: "P o Esc: seguir jugando   ·   M: volver al menú", size: 26, align: "center" });
    cloneTextObject(gd, project, objects, "TextoGemas", "PistaPausa", { text: "P: pausa", size: 18, color: "220;210;240" });
    const { addInst } = makeLayoutHelpers(gd, layout);
    addInst("fondoPausa", 0, 0, 0, 0, { layer: "HUD", z: 30 });
    addInst("TextoPausa", 0, 250, 0, 0, { layer: "HUD", z: 31 });
    addInst("AyudaPausa", 0, 370, 0, 0, { layer: "HUD", z: 31 });
    addInst("PistaPausa", 1170, 688, 0, 0, { layer: "HUD", z: 6 });

    const texts = ["TextoPausa", "AyudaPausa"];
    const first = [
      ev([I("SceneJustBegins", [""])], [...texts.map((t) => I("Cache", [t])), I("OpacityCapability::OpacityBehavior::SetValue", ["PistaPausa", "Opacity", "=", "150"])]),
      ev([], [setNum("TeclaPausa", "=", "0")]),
      ev([keyJust("p")], [setNum("TeclaPausa", "=", "1")]),
      ev([keyJust("Escape")], [setNum("TeclaPausa", "=", "1")]),
      // Resume first; it clears the key so the pause below does not fire again in the same frame.
      ev([numIs("TeclaPausa", "=", "1"), numIs("Pausado", "=", "1")],
        [setNum("Pausado", "=", "0"), setNum("TeclaPausa", "=", "0"), I("ChangeTimeScale", ["", "1"]), ...texts.map((t) => I("Cache", [t]))]),
      ev([numIs("TeclaPausa", "=", "1"), numIs("Pausado", "=", "0"), numIs("Muerto", "=", "0")],
        [setNum("Pausado", "=", "1"), setNum("HitStop", "=", "0"), I("ChangeTimeScale", ["", "0"]), ...texts.map((t) => I("Montre", [t, ""]))]),
      ev([numIs("Pausado", "=", "1")], [
        I("PrimitiveDrawing::Rectangle", ["fondoPausa", "0", "0", "1280", "720"]),
        ...texts.map((t) => I("SetX", [t, "=", `640 - ${t}.Width() / 2`])),
      ]),
      ev([numIs("Pausado", "=", "1"), keyJust("m")], [I("ChangeTimeScale", ["", "1"]), I("Scene", ["", q("Menu"), ""])]),
    ];
    first.reverse().forEach((e) => events.insertEvent(e, 0));
  }
  return `${PLAYABLE.join(", ")}: P/Esc pause, M menu, ${guarded} key events wait while paused`;
}
