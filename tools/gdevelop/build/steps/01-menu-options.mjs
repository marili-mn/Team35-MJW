// Step 01 — Menu (play / options / quit) and Options (sound and music ON/OFF, back).
import { makeEventHelpers } from "../../lib/events.mjs";

export default function menuOptions({ gd, project }) {
  const { I, ev } = makeEventHelpers(gd);

  // Mouse click on a button sprite, fired once per press.
  function addClickEvent(layout, button, conditions, actions) {
    const clicked = [
      I("CollisionPoint", [button, "MouseX()", "MouseY()"]),
      I("SourisBouton", ["", "Left"]),
      I("BuiltinCommonInstructions::Once", []),
    ];
    layout.getEvents().insertEvent(ev([...clicked, ...conditions], actions), layout.getEvents().getEventsCount());
  }

  // Global settings state, read by every scene.
  const globalVars = project.getVariables();
  for (const name of ["SoundOn", "MusicOn"]) {
    if (!globalVars.has(name)) globalVars.insertNew(name, globalVars.count()).setValue(1);
  }

  const menu = project.getLayout("Menu");
  addClickEvent(menu, "botonjugar", [], [I("Scene", ["", "\"Tutorial\"", ""])]);
  addClickEvent(menu, "botonopciones", [], [I("Scene", ["", "\"Opciones\"", ""])]);
  addClickEvent(menu, "botonsalir", [], [I("Quit", [""])]);

  // Options: the ON/OFF sprites appear twice (sound row above y=280, music row below).
  const options = project.getLayout("Opciones");
  addClickEvent(options, "botonvolver", [], [I("Scene", ["", "\"Menu\"", ""])]);
  const row = (button, op, variable, value) =>
    addClickEvent(options, button,
      [I("BuiltinCommonInstructions::CompareNumbers", [`${button}.Y()`, op, "280"])],
      [I("ModVarGlobal", [variable, "=", value])]);
  row("btnOn", "<", "SoundOn", "1");
  row("btnOff", "<", "SoundOn", "0");
  row("btnOn", ">=", "MusicOn", "1");
  row("btnOff", ">=", "MusicOn", "0");

  return `Menu: ${menu.getEvents().getEventsCount()} events, Opciones: ${options.getEvents().getEventsCount()} events`;
}
