// Step 17 — The hidden level: endless survival. Winning the game opens it (the Victory screen offers it
// and the level select shows it from then on). Kaito holds an arena between two walls while enemies
// come in from the sides in waves: blue ninjas first, then green ones, wraiths, guards and saws, each
// wave sooner, faster and with more of them at once. Crystals keep appearing for energy, healing is
// slower than in the story. It ends when Kaito dies: a card with the time survived, the kills, the wave
// reached and the record (kept in the browser). Space plays again, M goes back to the menu.
import { makeEventHelpers, makeEventFinder, makeLayoutHelpers } from "../../lib/events.mjs";
import { cloneTextObject, insertObjectFrom, serializeObject } from "../../lib/objects.mjs";
import { KINDS } from "../../lib/level.mjs";
import { SURVIVAL_SCENE } from "../../lib/scenes.mjs";

const STORE = '"GravityRunnerDash"', RECORD = '"record_Supervivencia"';
// [kind, from second, share of the draw out of 100, base speed px/s]
export const ROSTER = [["azul", 0, 40, 95], ["verde", 20, 30, 115], ["espectro", 45, 15, 85], ["guardia", 70, 8, 0], ["sierra", 90, 7, 160]];
const WAVE = 30;                  // seconds per wave
const HEAL = 9;                   // seconds per life healed (4 in the story)

export default function survival({ gd, project }) {
  const layout = project.getLayout(SURVIVAL_SCENE);
  const objects = layout.getObjects();
  const events = layout.getEvents();
  const { I, ev, q, setNum, numIs, keyJust, timer, resetTimer } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const { find, findAll } = makeEventFinder(gd, events, "step 17");
  const { allInstances, addInst } = makeLayoutHelpers(gd, layout);
  const vars = layout.getVariables();
  for (const v of ["TiempoSup", "Bajas", "Oleada", "OleadaVista", "Intervalo", "RecordSup", "Terminado", "NuevoRecordSup", "LadoSup", "SorteoSup", "SpawnXSup"]) {
    if (!vars.has(v)) vars.insertNew(v, vars.count());
  }
  for (const v of ["TiempoSupTxt", "RecordSupTxt"]) if (!vars.has(v)) { vars.insertNew(v, vars.count()); vars.get(v).setString(""); }

  // ---- the arena: walls at both ends (the portal is left out, behind the right wall) ----
  const instances = allInstances();
  const kaito = instances.find((i) => i.getObjectName() === "kaito");
  const F = kaito.getY() + 60;
  const portal = instances.find((i) => i.getObjectName() === "puerta");
  const right = Math.round(portal.getX() - 200);
  insertObjectFrom(gd, project, objects, "pared", serializeObject(gd, objects.getObject("techo")));
  addInst("pared", -60, 0, 60, F + 200, { z: 0 });
  addInst("pared", right, 0, 60, F + 200, { z: 0 });

  // ---- HUD and the closing card ----
  cloneTextObject(gd, project, objects, "TextoGemas", "TextoSup", { text: "", size: 24, color: "255;214;102" });
  cloneTextObject(gd, project, objects, "TextoGemas", "TituloSup", { text: "FIN DEL NIVEL OCULTO", size: 56, color: "255;214;102", align: "center" });
  cloneTextObject(gd, project, objects, "TextoGemas", "ResumenSup", { text: "", size: 30, align: "center" });
  cloneTextObject(gd, project, objects, "TextoGemas", "AyudaSup", { text: "ESPACIO: otra vez   ·   M: menú", size: 24, color: "220;210;240", align: "center" });
  addInst("TextoSup", 440, 84, 0, 0, { layer: "HUD", z: 6 });
  addInst("TituloSup", 0, 200, 0, 0, { layer: "HUD", z: 31 });
  addInst("ResumenSup", 0, 330, 0, 0, { layer: "HUD", z: 31 });
  addInst("AyudaSup", 0, 560, 0, 0, { layer: "HUD", z: 31 });
  const card = ["TituloSup", "ResumenSup", "AyudaSup"];
  const text = (o, expr) => I("TextContainerCapability::TextContainerBehavior::SetValue", [o, "Text", "=", expr]);
  const warn = (expr) => [text("Aviso", expr), I("Montre", ["Aviso", ""]), resetTimer("Aviso")];
  const clock = (secondsVar, outVar) => [
    ev([I("BuiltinCommonInstructions::CompareNumbers", [`mod(floor(Variable(${secondsVar})), 60)`, "<", "10"])],
      [I("SetStringVariable", [outVar, "=", `ToString(floor(Variable(${secondsVar}) / 60)) + ":0" + ToString(mod(floor(Variable(${secondsVar})), 60))`])]),
    ev([I("BuiltinCommonInstructions::CompareNumbers", [`mod(floor(Variable(${secondsVar})), 60)`, ">=", "10"])],
      [I("SetStringVariable", [outVar, "=", `ToString(floor(Variable(${secondsVar}) / 60)) + ":" + ToString(mod(floor(Variable(${secondsVar})), 60))`])]),
  ];
  // The crystals counter only shows how many were taken (they are energy here, there is no portal).
  const cameraEvent = find((c, a) => has(a, "FixCamera"), "camera");
  const camActs = cameraEvent.event.getActions();
  for (let i = 0; i < camActs.size(); i++) {
    const a = camActs.get(i);
    if (a.getType() === "TextContainerCapability::TextContainerBehavior::SetValue" && a.getParameter(0).getPlainString() === "TextoGemas") a.setParameter(3, '"Cristales: " + ToString(Variable(Gemas))');
  }

  const add = (e) => events.insertEvent(e, events.getEventsCount());
  add(ev([I("SceneJustBegins", [""])], [
    ...card.map((o) => I("Cache", [o])), I("Cache", ["puerta"]), I("Cache", ["pared"]),
    setNum("RecordSup", "=", "0"), I("LireFichierExp", [STORE, RECORD, "", "RecordSup"]),
    // Timers compared below must exist from the start: comparing one that was never started is false.
    resetTimer("Oleadas"), resetTimer("CristalSup"),
  ]));
  const playing = [numIs("Terminado", "=", "0"), numIs("Muerto", "=", "0")];

  // ---- time and waves ----
  add(ev(playing, [setNum("TiempoSup", "+", "TimeDelta()")]));
  add(ev([], [
    setNum("Oleada", "=", `1 + floor(Variable(TiempoSup) / ${WAVE})`),
    setNum("Intervalo", "=", "max(1.1, 3.6 - Variable(TiempoSup) / 45)"),
  ]));
  add(ev([numIs("Oleada", ">", "Variable(OleadaVista)")], [setNum("OleadaVista", "=", "Variable(Oleada)"), ...warn('"Oleada " + ToString(Variable(Oleada))')]));
  for (const e of clock("TiempoSup", "TiempoSupTxt")) add(e);
  add(ev([], [text("TextoSup", '"Tiempo " + VariableString(TiempoSupTxt) + "   ·   Bajas " + ToString(Variable(Bajas)) + "   ·   Oleada " + ToString(Variable(Oleada))')]));

  // ---- enemies from the sides: off screen, on the side drawn, walking at Kaito ----
  const crowd = I("BuiltinCommonInstructions::CompareNumbers", ["Count(Enemigos) + Count(cierra)", "<", "min(12, 3 + floor(Variable(TiempoSup) / 20))"]);
  const spawnKinds = [];
  let from = 0;
  for (const [kind, second, share, base] of ROSTER) {
    const { object: o, w, h, top } = KINDS[kind];
    const speed = `${base} * (1 + Variable(TiempoSup) / 150)`;
    spawnKinds.push(ev([numIs("SorteoSup", ">=", String(from)), numIs("SorteoSup", "<", String(from + share)), numIs("TiempoSup", ">=", String(second))], [
      I("Create", ["", o, "Variable(SpawnXSup)", String(F - top), ""]),
      I("ResizableCapability::ResizableBehavior::SetWidth", [o, "Resizable", "=", String(w)]),
      I("ResizableCapability::ResizableBehavior::SetHeight", [o, "Resizable", "=", String(h)]),
      I("SetNumberObjectVariable", [o, "MinX", "=", "100"]),
      I("SetNumberObjectVariable", [o, "MaxX", "=", String(right - 40 - w)]),
      I("SetNumberObjectVariable", [o, "Base", "=", speed]),
      I("SetNumberObjectVariable", [o, "Dir", "=", "1 - 2 * Variable(LadoSup)"]),
      ...(kind === "espectro" ? [I("SetNumberObjectVariable", [o, "Fase", "=", "RandomFloat(6.28)"])] : []),
      I("Create", ["", "fxMagia", `Variable(SpawnXSup) + ${Math.round(w / 2)}`, String(F - 60), ""]),
    ]));
    from += share;
  }
  add(ev([...playing, timer("Oleadas", ">", "Variable(Intervalo)"), crowd], [
    resetTimer("Oleadas"),
    setNum("SorteoSup", "=", `RandomInRange(0, ${from - 1})`),
    setNum("LadoSup", "=", "RandomInRange(0, 1)"),
    setNum("SpawnXSup", "=", `clamp(kaito.X() + (Variable(LadoSup) * 2 - 1) * 760, 120, ${right - 220})`),
  ], spawnKinds));

  // ---- crystals keep coming for the gravity flip ----
  add(ev([...playing, timer("CristalSup", ">", "6"), I("BuiltinCommonInstructions::CompareNumbers", ["Count(cristal)", "<", "8"])], [
    resetTimer("CristalSup"),
    I("Create", ["", "cristal", `RandomInRange(150, ${right - 300})`, String(F - 76), ""]),
    I("ResizableCapability::ResizableBehavior::SetWidth", ["cristal", "Resizable", "=", "49"]),
    I("ResizableCapability::ResizableBehavior::SetHeight", ["cristal", "Resizable", "=", "52"]),
  ]));

  // ---- kills are counted, healing is slower ----
  for (const { event } of findAll((c, a) => has(a, "Create", undefined, "cristaldorado"), "enemy kills", 3)) {
    event.getActions().insert(setNum("Bajas", "+", "1"), event.getActions().size());
  }
  const heal = find((c) => has(c, "CompareTimer", undefined, '"Curacion"'), "healing");
  const hc = heal.event.getConditions();
  for (let i = 0; i < hc.size(); i++) if (hc.get(i).getType() === "CompareTimer") hc.get(i).setParameter(3, String(HEAL));

  // ---- the end: instead of the Game Over scene, the card ----
  const death = find((c, a) => a.some((x) => x.type === "Scene" && x.params[1] === '"GameOver"'), "game over");
  const dActs = death.event.getActions();
  for (let i = dActs.size() - 1; i >= 0; i--) if (dActs.get(i).getType() === "Scene") dActs.removeAt(i);
  death.event.getConditions().insert(numIs("Terminado", "=", "0"), death.event.getConditions().size());
  for (const a of [setNum("Terminado", "=", "1"), I("ChangeTimeScale", ["", "0"]), I("Cache", ["Aviso"]), ...card.map((o) => I("Montre", [o, ""]))]) dActs.insert(a, dActs.size());
  const ended = numIs("Terminado", "=", "1");
  add(ev([ended, I("BuiltinCommonInstructions::Once", []), numIs("TiempoSup", ">", "Variable(RecordSup)")], [
    setNum("NuevoRecordSup", "=", "1"), setNum("RecordSup", "=", "Variable(TiempoSup)"), I("EcrireFichierExp", [STORE, RECORD, "Variable(TiempoSup)"]),
  ]));
  add(ev([ended], [], clock("RecordSup", "RecordSupTxt")));
  const summary = (recordLine) => text("ResumenSup",
    `"Sobreviviste " + VariableString(TiempoSupTxt) + "   ·   Bajas " + ToString(Variable(Bajas)) + NewLine() + "Llegaste a la oleada " + ToString(Variable(Oleada)) + "   ·   " + ${recordLine}`);
  add(ev([ended, numIs("NuevoRecordSup", "=", "1")], [summary('"¡Nuevo récord!"')]));
  add(ev([ended, numIs("NuevoRecordSup", "=", "0")], [summary('"Récord " + VariableString(RecordSupTxt)')]));
  add(ev([ended], [I("PrimitiveDrawing::Rectangle", ["fondoPausa", "0", "0", "1280", "720"]), ...card.map((o) => I("SetX", [o, "=", `640 - ${o}.Width() / 2`]))]));
  add(ev([ended, keyJust("Space")], [I("ChangeTimeScale", ["", "1"]), I("Scene", ["", q(SURVIVAL_SCENE), ""])]));
  add(ev([ended, keyJust("m")], [I("ChangeTimeScale", ["", "1"]), I("Scene", ["", q("Menu"), ""])]));

  // ---- winning the game opens it: the Victory screen offers the way in ----
  const victoria = project.getLayout("Victoria");
  const vEvents = victoria.getEvents();
  const vFind = makeEventFinder(gd, vEvents, "step 17 (Victoria)");
  const toMenu = vFind.find((c, a) => has(c, "KeyFromTextJustPressed", undefined, q("Space")) && a.some((x) => x.type === "Scene" && x.params[1] === q("Menu")), "space to menu");
  const tActs = toMenu.event.getActions();
  for (let i = 0; i < tActs.size(); i++) if (tActs.get(i).getType() === "Scene") tActs.get(i).setParameter(1, q(SURVIVAL_SCENE));
  vEvents.insertEvent(ev([keyJust("m")], [I("Scene", ["", q("Menu"), ""])]), vEvents.getEventsCount());
  vEvents.insertEvent(ev([I("SceneJustBegins", [""])], [
    I("TextContainerCapability::TextContainerBehavior::SetValue", ["Volver", "Text", "=", q("¡Se abrió un NIVEL OCULTO!   ESPACIO: entrar   ·   M: menú")]),
    I("SetX", ["Volver", "=", "640 - Volver.Width() / 2"]),
    I("EcrireFichierExp", [STORE, q("nivelMax"), "4"]),
  ]), vEvents.getEventsCount());

  return `${SURVIVAL_SCENE}: arena 0-${right} px, ${ROSTER.length} kinds of enemies in waves of ${WAVE} s, healing every ${HEAL} s; Victoria opens it`;
}
