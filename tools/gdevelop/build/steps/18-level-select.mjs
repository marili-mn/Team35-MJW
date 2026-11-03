// Step 18 — Level select. A button on the menu, "ELEGIR NIVEL" (or N), opens a screen to choose where to
// start: the Tutorial, the three levels and the hidden one ("Jugar" still starts the story). A level shows up locked until Kaito gets there by playing (the hidden one
// until the game is won); each row shows its record and best rank. Arrows or the mouse to choose, Enter,
// Space or a click to play, Esc to go back. Progress lives in the browser (GDevelop storage): every
// level saves how far the player got ("nivelMax") and its best rank. "Reiniciar progreso" (or R, twice
// to confirm) wipes it all.
import { makeEventHelpers, makeEventFinder, makeLayoutHelpers } from "../../lib/events.mjs";
import { cloneTextObject, insertObjectFrom, serializeObject } from "../../lib/objects.mjs";
import { LEVEL_SCENES, SURVIVAL_SCENE, LEVEL_SELECT_SCENE } from "../../lib/scenes.mjs";

const STORE = '"GravityRunnerDash"';
const ROWS = [
  { scene: "Tutorial", label: "TUTORIAL", locked: "", hint: "Aprendé a moverte, saltar e invertir la gravedad" },
  { scene: "Nivel1", label: "NIVEL 1 · Templo de la Luna", locked: "NIVEL 1 · ????", hint: "Llegá jugando para descubrirlo", rank: true },
  { scene: "Nivel2", label: "NIVEL 2 · Cueva de Cristal", locked: "NIVEL 2 · ????", hint: "Llegá jugando para descubrirlo", rank: true },
  { scene: "Nivel3", label: "NIVEL 3 · Templo de la Luna Roja", locked: "NIVEL 3 · ????", hint: "Llegá jugando para descubrirlo", rank: true },
  { scene: SURVIVAL_SCENE, label: "NIVEL OCULTO · Supervivencia", locked: "????", hint: "Terminá el juego para descubrirlo" },
];
const RANK_LETTERS = { 4: "S", 3: "A", 2: "B", 1: "C" };
const GOLD = "255;214;102", WHITE = "255;255;255", GREY = "140;130;160", GREY_SELECTED = "200;190;215";

export default function levelSelect({ gd, project }) {
  const { I, ev, q, setNum, numIs, keyJust } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const setStr = (v, expr) => I("SetStringVariable", [v, "=", expr]);
  const text = (o, expr) => I("TextContainerCapability::TextContainerBehavior::SetValue", [o, "Text", "=", expr]);
  const color = (o, c) => I("TextObject::ChangeColor", [o, q(c)]);
  const clock = (secondsVar, outVar) => [
    ev([I("BuiltinCommonInstructions::CompareNumbers", [`mod(floor(Variable(${secondsVar})), 60)`, "<", "10"])],
      [setStr(outVar, `ToString(floor(Variable(${secondsVar}) / 60)) + ":0" + ToString(mod(floor(Variable(${secondsVar})), 60))`)]),
    ev([I("BuiltinCommonInstructions::CompareNumbers", [`mod(floor(Variable(${secondsVar})), 60)`, ">=", "10"])],
      [setStr(outVar, `ToString(floor(Variable(${secondsVar}) / 60)) + ":" + ToString(mod(floor(Variable(${secondsVar})), 60))`)]),
  ];

  // ---- every level remembers how far the player got and the best rank ----
  LEVEL_SCENES.forEach((name, i) => {
    const layout = project.getLayout(name);
    const events = layout.getEvents();
    const vars = layout.getVariables();
    for (const v of ["NivelMax", "MejorRango", "RangoNum"]) if (!vars.has(v)) vars.insertNew(v, vars.count());
    const { find } = makeEventFinder(gd, events, `step 18 (${name})`);
    const start = find((c, a) => has(c, "SceneJustBegins") && has(a, "SetStringVariable", "NivelActual"), "level start");
    const acts = start.event.getActions();
    for (const a of [setNum("NivelMax", "=", "0"), I("LireFichierExp", [STORE, q("nivelMax"), "", "NivelMax"]),
      setNum("MejorRango", "=", "0"), I("LireFichierExp", [STORE, q(`rango_${name}`), "", "MejorRango"])]) acts.insert(a, acts.size());
    events.insertEvent(ev([I("SceneJustBegins", [""]), numIs("NivelMax", "<", String(i + 1))], [I("EcrireFichierExp", [STORE, q("nivelMax"), String(i + 1)])]), start.index + 1);
    // The rank letter of the results card (step 12) as a number, kept when it beats the stored one.
    const done = numIs("Completado", "=", "1");
    for (const [n, letter] of Object.entries(RANK_LETTERS)) events.insertEvent(ev([done, I("StringVariable", ["Rango", "=", q(letter)])], [setNum("RangoNum", "=", n)]), events.getEventsCount());
    events.insertEvent(ev([done, numIs("RangoNum", ">", "Variable(MejorRango)")], [
      setNum("MejorRango", "=", "Variable(RangoNum)"), I("EcrireFichierExp", [STORE, q(`rango_${name}`), "Variable(RangoNum)"]),
    ]), events.getEventsCount());
  });

  // ---- the screen ----
  if (project.hasLayoutNamed(LEVEL_SELECT_SCENE)) project.removeLayout(LEVEL_SELECT_SCENE);
  const screen = project.insertNewLayout(LEVEL_SELECT_SCENE, project.getLayoutsCount());
  const objects = screen.getObjects();
  const menu = project.getLayout("Menu");
  insertObjectFrom(gd, project, objects, "fondo", serializeObject(gd, menu.getObjects().getObject("fondo")));
  const veil = objects.insertNewObject(project, "PrimitiveDrawing::Drawer", "velo", objects.getObjectsCount());
  const shape = gd.asShapePainterConfiguration(veil.getConfiguration());
  shape.setCoordinatesAbsolute();
  shape.setClearBetweenFrames(true);
  shape.setFillColor("8;4;20");
  shape.setFillOpacity(165);
  shape.setOutlineSize(0);
  insertObjectFrom(gd, project, objects, "estiloTexto", serializeObject(gd, project.getLayout("Nivel1").getObjects().getObject("TextoGemas")));
  const label = (name, opts) => cloneTextObject(gd, project, objects, "estiloTexto", name, { align: "center", ...opts });
  label("TituloNiveles", { text: "ELEGÍ DÓNDE EMPEZAR", size: 52, color: GOLD });
  label("AyudaNiveles", { text: "Flechas: elegir   ·   ENTER: jugar   ·   ESC: volver", size: 22, color: "220;210;240" });
  label("AvisoNiveles", { text: "", size: 24, color: GOLD });
  cloneTextObject(gd, project, objects, "estiloTexto", "BotonReiniciar", { text: "Reiniciar progreso (R)", size: 20, color: "255;150;150" });
  ROWS.forEach((_, i) => { label(`Fila${i}`, { text: "", size: 34 }); label(`Detalle${i}`, { text: "", size: 20, color: "210;200;230" }); });
  objects.removeObject("estiloTexto");
  const { addInst } = makeLayoutHelpers(gd, screen);
  addInst("fondo", -3, -3, 1284, 728, { z: -10 });
  addInst("velo", 0, 0, 0, 0, { z: -5 });
  addInst("TituloNiveles", 0, 50, 0, 0, { z: 5 });
  ROWS.forEach((_, i) => { addInst(`Fila${i}`, 0, 160 + i * 92, 0, 0, { z: 5 }); addInst(`Detalle${i}`, 0, 202 + i * 92, 0, 0, { z: 5 }); });
  addInst("AvisoNiveles", 0, 615, 0, 0, { z: 5 });
  addInst("AyudaNiveles", 0, 660, 0, 0, { z: 5 });
  addInst("BotonReiniciar", 1010, 18, 0, 0, { z: 5 });

  const vars = screen.getVariables();
  for (const v of ["Sel", "NivelMax", "Confirmar", ...ROWS.flatMap((_, i) => [`Record${i}`, `Rango${i}`])]) if (!vars.has(v)) vars.insertNew(v, vars.count());
  for (const v of ROWS.flatMap((_, i) => [`Etiqueta${i}`, `RecordTxt${i}`])) if (!vars.has(v)) { vars.insertNew(v, vars.count()); vars.get(v).setString(""); }

  const events = screen.getEvents();
  const add = (e) => events.insertEvent(e, events.getEventsCount());
  add(ev([I("SceneJustBegins", [""])], [
    I("LireFichierExp", [STORE, q("nivelMax"), "", "NivelMax"]),
    ...ROWS.flatMap((row, i) => [
      I("LireFichierExp", [STORE, q(`record_${row.scene}`), "", `Record${i}`]),
      ...(row.rank ? [I("LireFichierExp", [STORE, q(`rango_${row.scene}`), "", `Rango${i}`])] : []),
    ]),
    I("Cache", ["AvisoNiveles"]),
  ], [
    // Rows: open or locked, and what the line under each one says.
    ...ROWS.flatMap((row, i) => {
      const open = i === 0 ? [] : [numIs("NivelMax", ">=", String(i))];
      const shut = [numIs("NivelMax", "<", String(i))];
      const recordLine = `"Récord " + VariableString(RecordTxt${i})`;
      return [
        ...clock(`Record${i}`, `RecordTxt${i}`),
        ev(open, [setStr(`Etiqueta${i}`, q(row.label)), text(`Detalle${i}`, q(i === 0 ? row.hint : row.scene === SURVIVAL_SCENE ? "Sobreviví a las oleadas todo lo que puedas" : "Sin completar todavía"))], [
          ev([numIs(`Record${i}`, ">", "0")], [text(`Detalle${i}`, recordLine)], row.rank ? Object.entries(RANK_LETTERS).map(([n, letter]) =>
            ev([numIs(`Rango${i}`, "=", n)], [text(`Detalle${i}`, `${recordLine} + "   ·   Rango ${letter}"`)])) : []),
        ]),
        ...(i === 0 ? [] : [ev(shut, [setStr(`Etiqueta${i}`, q(row.locked)), text(`Detalle${i}`, q(`Bloqueado: ${row.hint.charAt(0).toLowerCase()}${row.hint.slice(1)}`))])]),
      ];
    }),
  ]));

  // Choosing: arrows, or hovering a row with the mouse.
  add(ev([keyJust("Down")], [setNum("Sel", "=", `min(Variable(Sel) + 1, ${ROWS.length - 1})`), I("Cache", ["AvisoNiveles"])]));
  add(ev([keyJust("Up")], [setNum("Sel", "=", "max(Variable(Sel) - 1, 0)"), I("Cache", ["AvisoNiveles"])]));
  ROWS.forEach((_, i) => add(ev([I("CollisionPoint", [`Fila${i}`, "MouseX()", "MouseY()"])], [setNum("Sel", "=", String(i))])));
  // Drawing the rows: the chosen one with a mark, locked ones in grey.
  add(ev([], [I("PrimitiveDrawing::Rectangle", ["velo", "0", "0", "1280", "720"])]));
  ROWS.forEach((_, i) => {
    const locked = i === 0 ? null : numIs("NivelMax", "<", String(i));
    add(ev([numIs("Sel", "=", String(i))], [text(`Fila${i}`, `"» " + VariableString(Etiqueta${i}) + " «"`), color(`Fila${i}`, GOLD)],
      locked ? [ev([locked], [color(`Fila${i}`, GREY_SELECTED)])] : []));
    add(ev([numIs("Sel", "!=", String(i))], [text(`Fila${i}`, `VariableString(Etiqueta${i})`), color(`Fila${i}`, WHITE)],
      locked ? [ev([locked], [color(`Fila${i}`, GREY)])] : []));
  });
  add(ev([], ["TituloNiveles", "AyudaNiveles", "AvisoNiveles", ...ROWS.flatMap((_, i) => [`Fila${i}`, `Detalle${i}`])].map((o) => I("SetX", [o, "=", `640 - ${o}.Width() / 2`]))));
  // Playing: Enter, Space or a click on the chosen row; a locked one only says so.
  const go = (i) => [
    ev(i === 0 ? [] : [numIs("NivelMax", ">=", String(i))], [I("Scene", ["", q(ROWS[i].scene), ""])]),
    ...(i === 0 ? [] : [ev([numIs("NivelMax", "<", String(i))], [text("AvisoNiveles", q("Todavía no lo descubriste")), I("Montre", ["AvisoNiveles", ""])])]),
  ];
  ROWS.forEach((_, i) => {
    for (const k of ["Return", "Space"]) add(ev([keyJust(k), numIs("Sel", "=", String(i))], [], go(i)));
    add(ev([I("CollisionPoint", [`Fila${i}`, "MouseX()", "MouseY()"]), I("SourisBouton", ["", "Left"]), I("BuiltinCommonInstructions::Once", [])], [], go(i)));
  });
  for (const k of ["Escape", "m"]) add(ev([keyJust(k)], [I("Scene", ["", q("Menu"), ""])]));
  // Wiping the progress: the first press asks, a second one within 4 s does it.
  const overReset = I("CollisionPoint", ["BotonReiniciar", "MouseX()", "MouseY()"]);
  add(ev([overReset], [color("BotonReiniciar", WHITE)]));
  add(ev([I("CollisionPoint", ["BotonReiniciar", "MouseX()", "MouseY()"], true)], [color("BotonReiniciar", "255;150;150")]));
  add(ev([numIs("Confirmar", "=", "1"), I("CompareTimer", ["", q("Confirmar"), ">", "4"])], [setNum("Confirmar", "=", "0"), I("Cache", ["AvisoNiveles"])]));
  // Wipe first, then ask: on the first press the wipe is skipped and only then Confirmar becomes 1.
  const askOrWipe = () => [
    ev([numIs("Confirmar", "=", "1")], [I("DeleteFichier", [STORE]), I("Scene", ["", q(LEVEL_SELECT_SCENE), ""])]),
    ev([numIs("Confirmar", "=", "0")], [setNum("Confirmar", "=", "1"), I("ResetTimer", ["", q("Confirmar")]),
      text("AvisoNiveles", q("¿Seguro? Se borran récords, rangos y niveles: tocá de nuevo")), I("Montre", ["AvisoNiveles", ""])]),
  ];
  add(ev([overReset, I("SourisBouton", ["", "Left"]), I("BuiltinCommonInstructions::Once", [])], [], askOrWipe()));
  add(ev([keyJust("r")], [], askOrWipe()));

  // ---- the menu gets a visible "ELEGIR NIVEL" button (Continuar moves one line down) ----
  const menuObjects = menu.getObjects();
  insertObjectFrom(gd, project, menuObjects, "estiloTexto", serializeObject(gd, project.getLayout("Nivel1").getObjects().getObject("TextoGemas")));
  cloneTextObject(gd, project, menuObjects, "estiloTexto", "BotonNiveles", { text: "ELEGIR NIVEL   (N)", size: 32, color: GOLD });
  menuObjects.removeObject("estiloTexto");
  const menuLayout = makeLayoutHelpers(gd, menu);
  menuLayout.addInst("BotonNiveles", 0, 520, 0, 0, { z: 10 });
  for (const inst of menuLayout.allInstances()) if (inst.getObjectName() === "TextoContinuar") inst.setY(580);
  const menuEvents = menu.getEvents();
  const addMenu = (e) => menuEvents.insertEvent(e, menuEvents.getEventsCount());
  const overLevels = I("CollisionPoint", ["BotonNiveles", "MouseX()", "MouseY()"]);
  addMenu(ev([], [I("SetX", ["BotonNiveles", "=", "640 - BotonNiveles.Width() / 2"])]));
  addMenu(ev([overLevels], [color("BotonNiveles", WHITE)]));
  addMenu(ev([I("CollisionPoint", ["BotonNiveles", "MouseX()", "MouseY()"], true)], [color("BotonNiveles", GOLD)]));
  addMenu(ev([overLevels, I("SourisBouton", ["", "Left"]), I("BuiltinCommonInstructions::Once", [])], [I("Scene", ["", q(LEVEL_SELECT_SCENE), ""])]));
  addMenu(ev([keyJust("n")], [I("Scene", ["", q(LEVEL_SELECT_SCENE), ""])]));
  return `${LEVEL_SELECT_SCENE}: ${ROWS.length} rows (locked until reached, hidden level after winning), records and best ranks; a visible "ELEGIR NIVEL" button on the menu, "Reiniciar progreso" with confirmation`;
}
