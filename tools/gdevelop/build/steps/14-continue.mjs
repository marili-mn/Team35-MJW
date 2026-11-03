// Step 14 — Continue. Every level remembers in the browser (GDevelop storage) that Kaito got there, and
// the menu offers "CONTINUAR · NIVEL N" under its buttons (click or C), so closing the tab no longer
// means starting over from the Tutorial.
import { makeEventHelpers, makeEventFinder, makeLayoutHelpers } from "../../lib/events.mjs";
import { cloneTextObject, insertObjectFrom, serializeObject } from "../../lib/objects.mjs";

import { LEVEL_SCENES as LEVELS } from "../../lib/scenes.mjs";
const STORE = '"GravityRunnerDash"', KEY = '"ultimoNivel"';
const IDLE = "255;214;102", HOVER = "255;255;255";

export default function continueGame({ gd, project }) {
  const { I, NOT, ev, q } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));

  // ---- each level saves itself when it starts ----
  for (const name of LEVELS) {
    const events = project.getLayout(name).getEvents();
    const start = makeEventFinder(gd, events, `step 14 (${name})`).find((c, a) => has(c, "SceneJustBegins") && has(a, "SetStringVariable", "NivelActual"), "level start");
    start.event.getActions().insert(I("EcrireFichierTxt", [STORE, KEY, q(name)]), start.event.getActions().size());
  }

  // ---- the menu offers to continue ----
  const menu = project.getLayout("Menu");
  const objects = menu.getObjects();
  const template = project.getLayout("Nivel1").getObjects().getObject("TextoGemas");
  insertObjectFrom(gd, project, objects, "estiloTexto", serializeObject(gd, template));
  cloneTextObject(gd, project, objects, "estiloTexto", "TextoContinuar", { text: "CONTINUAR", size: 32, color: IDLE });
  objects.removeObject("estiloTexto");
  makeLayoutHelpers(gd, menu).addInst("TextoContinuar", 0, 520, 0, 0, { z: 10 });
  const vars = menu.getVariables();
  if (!vars.has("UltimoNivel")) { vars.insertNew("UltimoNivel", vars.count()); vars.get("UltimoNivel").setString(""); }

  const events = menu.getEvents();
  const add = (e) => events.insertEvent(e, events.getEventsCount());
  const label = (text) => I("TextContainerCapability::TextContainerBehavior::SetValue", ["TextoContinuar", "Text", "=", q(text)]);
  const saved = (n) => I("StringVariable", ["UltimoNivel", "=", q(n)]);
  add(ev([I("SceneJustBegins", [""])], [I("Cache", ["TextoContinuar"]), I("LireFichierTxt", [STORE, KEY, "", "UltimoNivel"])], [
    ...LEVELS.map((n, i) => ev([saved(n)], [label(`CONTINUAR · NIVEL ${i + 1}   (C)`), I("Montre", ["TextoContinuar", ""])])),
  ]));
  add(ev([], [I("SetX", ["TextoContinuar", "=", "640 - TextoContinuar.Width() / 2"])]));
  const over = I("CollisionPoint", ["TextoContinuar", "MouseX()", "MouseY()"]);
  add(ev([over], [I("TextObject::ChangeColor", ["TextoContinuar", q(HOVER)])]));
  add(ev([NOT("CollisionPoint", ["TextoContinuar", "MouseX()", "MouseY()"])], [I("TextObject::ChangeColor", ["TextoContinuar", q(IDLE)])]));
  const go = [I("Scene", ["", "VariableString(UltimoNivel)", ""])];
  const visible = NOT("StringVariable", ["UltimoNivel", "=", q("")]);
  add(ev([visible, over, I("SourisBouton", ["", "Left"]), I("BuiltinCommonInstructions::Once", [])], go));
  add(ev([visible, I("KeyFromTextJustPressed", ["", q("c")])], go));
  return `levels save their name on start; Menu: "CONTINUAR" (click or C) when there is a saved level`;
}
