// Step 12 — Replay value: a clock on the HUD and a results card when a level is cleared (time, crystals,
// hits taken and a rank S/A/B/C), with the best time kept in the browser (GDevelop storage). The portal
// now shows the card first; Space or Enter goes on to the next scene. Rank score = % of crystals minus
// 8 per hit: S from 90, A from 75, B from 60, C below.
import { makeEventHelpers, makeEventFinder, makeLayoutHelpers } from "../../lib/events.mjs";
import { cloneTextObject } from "../../lib/objects.mjs";

const LEVELS = ["Nivel1", "Nivel2", "Nivel3"];
const STORE = '"GravityRunnerDash"';
const RANKS = [["S", 90, "255;214;102"], ["A", 75, "140;230;140"], ["B", 60, "140;190;255"], ["C", -1000, "220;200;230"]];

export default function levelResults({ gd, project }) {
  const { I, ev, q, numIs, setNum, keyJust } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const setStr = (v, expr) => I("SetStringVariable", [v, "=", expr]);
  const text = (o, expr) => I("TextContainerCapability::TextContainerBehavior::SetValue", [o, "Text", "=", expr]);
  const center = (o) => I("SetX", [o, "=", `640 - ${o}.Width() / 2`]);
  // m:ss of a number of seconds held in a variable, written into a string variable (two events, for the 0).
  const clock = (secondsVar, outVar) => [
    ev([I("BuiltinCommonInstructions::CompareNumbers", [`mod(floor(Variable(${secondsVar})), 60)`, "<", "10"])],
      [setStr(outVar, `ToString(floor(Variable(${secondsVar}) / 60)) + ":0" + ToString(mod(floor(Variable(${secondsVar})), 60))`)]),
    ev([I("BuiltinCommonInstructions::CompareNumbers", [`mod(floor(Variable(${secondsVar})), 60)`, ">=", "10"])],
      [setStr(outVar, `ToString(floor(Variable(${secondsVar}) / 60)) + ":" + ToString(mod(floor(Variable(${secondsVar})), 60))`)]),
  ];

  for (const name of LEVELS) {
    const layout = project.getLayout(name);
    const objects = layout.getObjects();
    const events = layout.getEvents();
    const { find } = makeEventFinder(gd, events, `step 12 (${name})`);
    const vars = layout.getVariables();
    for (const v of ["Tiempo", "Golpes", "Completado", "TotalCristales", "Puntaje", "Record", "NuevoRecord"]) if (!vars.has(v)) vars.insertNew(v, vars.count());
    for (const v of ["TiempoTxt", "RecordTxt", "Rango"]) if (!vars.has(v)) { vars.insertNew(v, vars.count()); vars.get(v).setString(""); }
    const key = q(`record_${name}`);

    // ---- HUD clock and result texts ----
    cloneTextObject(gd, project, objects, "TextoGemas", "TextoTiempo", { text: "0:00", size: 22, color: "230;220;255" });
    cloneTextObject(gd, project, objects, "TextoGemas", "TituloResultado", { text: "¡NIVEL COMPLETADO!", size: 58, color: "255;214;102", align: "center" });
    cloneTextObject(gd, project, objects, "TextoGemas", "Resumen", { text: "", size: 30, align: "center" });
    cloneTextObject(gd, project, objects, "TextoGemas", "RangoTexto", { text: "S", size: 130, align: "center" });
    cloneTextObject(gd, project, objects, "TextoGemas", "AyudaResultado", { text: "ESPACIO: continuar", size: 24, color: "220;210;240", align: "center" });
    const { addInst } = makeLayoutHelpers(gd, layout);
    addInst("TextoTiempo", 34, 84, 0, 0, { layer: "HUD", z: 6 });
    addInst("TituloResultado", 0, 120, 0, 0, { layer: "HUD", z: 31 });
    addInst("RangoTexto", 0, 200, 0, 0, { layer: "HUD", z: 31 });
    addInst("Resumen", 0, 380, 0, 0, { layer: "HUD", z: 31 });
    addInst("AyudaResultado", 0, 600, 0, 0, { layer: "HUD", z: 31 });
    const card = ["TituloResultado", "RangoTexto", "Resumen", "AyudaResultado"];

    const start = find((c, a) => has(c, "SceneJustBegins") && has(a, "SetNumberVariable", "Requeridas"), "level start");
    const startActs = start.event.getActions();
    for (const a of [
      setNum("TotalCristales", "=", "Count(cristal)"), setNum("Record", "=", "0"),
      I("LireFichierExp", [STORE, key, "", "Record"]), ...card.map((o) => I("Cache", [o])),
    ]) startActs.insert(a, startActs.size());

    // ---- counting: time while playing, hits taken ----
    const add = (e) => events.insertEvent(e, events.getEventsCount());
    add(ev([numIs("Completado", "=", "0")], [setNum("Tiempo", "+", "TimeDelta()")]));
    for (const e of clock("Tiempo", "TiempoTxt")) add(e);
    add(ev([], [text("TextoTiempo", 'VariableString(TiempoTxt)')]));
    const hurts = makeEventFinder(gd, events, `step 12 (${name})`).findAll((c, a) => has(a, "SetNumberVariable", "Vidas", "-"), "damage", 3);
    for (const { event } of hurts) event.getActions().insert(setNum("Golpes", "+", "1"), event.getActions().size());

    // ---- the portal shows the card instead of leaving at once ----
    const portal = find((c, a) => has(c, "CollisionNP", "kaito", "puerta") && has(c, "NumberVariable", "PortalAbierto", "=", "1") && has(a, "Scene"), "portal");
    const acts = portal.event.getActions();
    let next = null;
    for (let i = acts.size() - 1; i >= 0; i--) if (acts.get(i).getType() === "Scene") { next = acts.get(i).getParameter(1).getPlainString(); acts.removeAt(i); }
    if (!next) throw new Error(`step 12 (${name}): the portal has no scene change`);
    portal.event.getConditions().insert(numIs("Completado", "=", "0"), portal.event.getConditions().size());
    for (const a of [
      setNum("Completado", "=", "1"), setNum("HitStop", "=", "0"), I("ChangeTimeScale", ["", "0"]), I("Cache", ["Aviso"]),
      setNum("Puntaje", "=", "round(100 * Variable(Gemas) / max(1, Variable(TotalCristales))) - 8 * Variable(Golpes)"),
      ...card.map((o) => I("Montre", [o, ""])),
    ]) acts.insert(a, acts.size());
    // Rank, best time and the summary, worked out on the frame the level is cleared.
    const done = (extra = []) => [numIs("Completado", "=", "1"), I("BuiltinCommonInstructions::Once", []), ...extra];
    for (const [i, [rank, min, color]] of RANKS.entries()) {
      const below = i > 0 ? [numIs("Puntaje", "<", String(RANKS[i - 1][1]))] : [];
      add(ev(done([numIs("Puntaje", ">=", String(min)), ...below]), [setStr("Rango", q(rank)), I("TextObject::ChangeColor", ["RangoTexto", q(color)])]));
    }
    add(ev(done([numIs("Record", "=", "0")]), [setNum("NuevoRecord", "=", "1")]));
    add(ev(done([numIs("Record", ">", "0"), numIs("Tiempo", "<", "Variable(Record)")]), [setNum("NuevoRecord", "=", "1")]));
    add(ev(done([numIs("NuevoRecord", "=", "1")]), [setNum("Record", "=", "Variable(Tiempo)"), I("EcrireFichierExp", [STORE, key, "Variable(Tiempo)"])]));
    add(ev([numIs("Completado", "=", "1")], [], clock("Record", "RecordTxt")));
    const summary = (recordLine) => text("Resumen",
      `"Tiempo  " + VariableString(TiempoTxt) + "   ·   " + ${recordLine} + NewLine() + "Cristales  " + ToString(Variable(Gemas)) + " / " + ToString(Variable(TotalCristales)) + "   ·   Golpes  " + ToString(Variable(Golpes))`);
    add(ev([numIs("Completado", "=", "1"), numIs("NuevoRecord", "=", "1")], [summary('"¡Nuevo récord!"')]));
    add(ev([numIs("Completado", "=", "1"), numIs("NuevoRecord", "=", "0")], [summary('"Récord  " + VariableString(RecordTxt)')]));
    add(ev([numIs("Completado", "=", "1")], [
      text("RangoTexto", 'VariableString(Rango)'),
      I("PrimitiveDrawing::Rectangle", ["fondoPausa", "0", "0", "1280", "720"]),
      ...card.map(center),
    ]));
    // Space or Enter: on to the next scene.
    for (const k of ["Space", "Return"]) {
      add(ev([numIs("Completado", "=", "1"), keyJust(k)], [I("ChangeTimeScale", ["", "1"]), I("Scene", ["", next, ""])]));
    }
  }
  return `${LEVELS.join(", ")}: HUD clock, results card (rank S/A/B/C, best time saved)`;
}
