// Step 23 — The story and the credits as an intro (request: "credits as an introduction to the story, with a
// skip button and the arrows to move the text up or down", and then "the story when pressing Jugar"). The first
// time "Jugar" is pressed, the Intro scene comes before the Tutorial: the title, the story of the GDD and the
// credits scroll up slowly over the menu's night, with the menu theme still playing; ↓ speeds it up, ↑ takes it
// back, "SALTAR" (or Space, Enter) starts the game and Esc goes back to the menu. At the end the game starts by
// itself. Once seen it is remembered in the browser (GDevelop storage) and "Jugar" goes straight to the
// Tutorial; "Reiniciar progreso" in the level select wipes that too.
import { makeEventFinder, makeEventHelpers, makeLayoutHelpers } from "../../lib/events.mjs";
import { cloneTextObject, declareObjectNumbers, ensureImageResource, insertObjectFrom, serializeObject, setAnimations } from "../../lib/objects.mjs";
import { audioFile } from "./08-audio.mjs";
import { TEAM } from "./07-victory-credits.mjs";

const SCENE = "Intro", FIRST = "Tutorial";      // where "Jugar" goes
const STORE = '"GravityRunnerDash"';
const NIGHT = [18, 10, 32];
const GOLD = "255;214;102", LILAC = "220;180;255", WHITE = "255;255;255", SOFT = "235;228;245";
const SPEED = 40, FAST = 320;      // px/s: on its own, and holding an arrow
const HOLD = 2.5;                  // s on the title before it starts moving by itself

const STORY = [
  "En el Japón feudal de las sombras,",
  "el templo secreto del clan Shinobi custodiaba",
  "el Pergamino del Equilibrio Gravitatorio,",
  "una reliquia capaz de torcer la atracción de la tierra.",
  "",
  "Una noche, el clan rival Kuroshini asaltó el templo,",
  "rompió el sello sagrado y se robó el pergamino.",
  "",
  "Desde entonces las fortalezas flotan,",
  "los techos se vuelven suelo",
  "y el caos reina sobre la montaña.",
  "",
  "Kaito, el Caminante de las Sombras,",
  "es el único que sobrevivió.",
  "Con el sello del pergamino puede invertir su gravedad,",
  "pero cada giro le cuesta energía.",
  "",
  "Su camino cruza el Templo de la Luna,",
  "la Cueva de Cristal y el Templo de la Luna Roja,",
  "donde lo espera la Maga Oscura.",
  "",
  "Recuperá el pergamino.",
  "Devolvele el equilibrio al mundo.",
];
const CREDITS = [
  "Un juego del Grupo 35",
  "",
  ...TEAM.map(([name, role]) => `${name} — ${role}`),
  "",
  "Multimedia y Juegos en Web · 2026",
  "Hecho con GDevelop",
  "Música y sonido originales",
];

export default function introCrawl({ gd, project }) {
  const { I, NOT, ev, q, setNum, numIs, key, keyJust } = makeEventHelpers(gd);
  if (project.hasLayoutNamed(SCENE)) project.removeLayout(SCENE);
  const intro = project.insertNewLayout(SCENE, project.getLayoutsCount());
  intro.setBackgroundColor(...NIGHT);
  intro.setStopSoundsOnStartup(false);         // the menu theme keeps playing under the story
  const objects = intro.getObjects();
  const menu = project.getLayout("Menu").getObjects();

  // The menu's night and title, a veil so the text reads, and a frame (top and bottom bands) the text slides under.
  insertObjectFrom(gd, project, objects, "fondo", serializeObject(gd, menu.getObject("fondo")));
  insertObjectFrom(gd, project, objects, "titulojuego", serializeObject(gd, menu.getObject("titulojuego")));
  const drawer = (name, opacity) => {
    const shape = gd.asShapePainterConfiguration(objects.insertNewObject(project, "PrimitiveDrawing::Drawer", name, objects.getObjectsCount()).getConfiguration());
    shape.setCoordinatesAbsolute();
    shape.setClearBetweenFrames(true);
    shape.setFillColor("8;4;20");
    shape.setFillOpacity(opacity);
    shape.setOutlineSize(0);
  };
  drawer("velo", 175);
  drawer("marco", 255);
  const logo = objects.insertNewObject(project, "Sprite", "logoUNER", objects.getObjectsCount());
  setAnimations(gd, logo, [{ name: "", images: [ensureImageResource(gd, project, "assets/creditos/logo-uner.png")] }]);
  insertObjectFrom(gd, project, objects, "estiloTexto", serializeObject(gd, project.getLayout("Nivel1").getObjects().getObject("TextoGemas")));
  const label = (name, opts) => cloneTextObject(gd, project, objects, "estiloTexto", name, { align: "center", ...opts });
  label("Historia", { text: STORY.join("\n"), size: 30, color: SOFT });
  label("TituloCreditos", { text: "CRÉDITOS", size: 44, color: GOLD });
  label("Creditos", { text: CREDITS.join("\n"), size: 26, color: WHITE });
  label("Despedida", { text: "La leyenda de Kaito empieza ahora.", size: 32, color: GOLD });
  label("AyudaIntro", { text: "↑ ↓  para desplazar el texto", size: 20, color: LILAC });
  label("BotonSaltar", { text: "SALTAR  (ESPACIO)", size: 24, color: GOLD });
  objects.removeObject("estiloTexto");
  const rolling = ["titulojuego", "Historia", "TituloCreditos", "Creditos", "logoUNER", "Despedida"];
  for (const name of rolling) declareObjectNumbers(objects.getObject(name), ["BaseY"]);
  const group = objects.getObjectGroups().insertNew("Rollo", 0);
  for (const name of rolling) group.addObject(name);

  const { addInst } = makeLayoutHelpers(gd, intro);
  addInst("fondo", -3, -3, 1284, 728, { z: -10 });
  addInst("velo", 0, 0, 0, 0, { z: -5 });
  addInst("titulojuego", 362, 70, 556, 283, { z: 5 });
  addInst("Historia", 0, 420, 0, 0, { z: 5 });
  for (const name of ["TituloCreditos", "Creditos", "logoUNER", "Despedida"]) addInst(name, 0, 2000, 0, 0, { z: 5 });
  addInst("marco", 0, 0, 0, 0, { z: 8 });
  addInst("AyudaIntro", 0, 676, 0, 0, { z: 10 });   // centered: GDevelop's watermark is bottom left
  addInst("BotonSaltar", 1000, 672, 0, 0, { z: 10 });

  const vars = intro.getVariables();
  for (const v of ["Scroll", "Max", "IntroVista"]) if (!vars.has(v)) vars.insertNew(v, vars.count());
  const events = intro.getEvents();
  const add = (e) => events.insertEvent(e, events.getEventsCount());
  const centerX = (o) => I("SetX", [o, "=", `640 - ${o}.Width() / 2`]);
  const below = (o, above, gap) => I("SetY", [o, "=", `${above}.Y() + ${above}.Height() + ${gap}`]);
  const toGame = [I("EcrireFichierExp", [STORE, q("introVista"), "1"]), I("Scene", ["", q(FIRST), ""])];

  // The credits laid out under the story; every piece remembers where it starts.
  add(ev([I("SceneJustBegins", [""])], [
    ...["Historia", "TituloCreditos", "Creditos", "logoUNER", "Despedida", "AyudaIntro"].map(centerX),
    I("ResetTimer", ["", q("Espera")]),
    below("TituloCreditos", "Historia", 150), below("Creditos", "TituloCreditos", 30), below("logoUNER", "Creditos", 50), below("Despedida", "logoUNER", 70),
    I("SetNumberObjectVariable", ["Rollo", "BaseY", "=", "Rollo.Y()"]),
    setNum("Scroll", "=", "0"),
    setNum("Max", "=", "Despedida.Variable(BaseY) - 400"),
  ]));
  // The menu theme goes on from the menu; if the browser kept the page silent, it starts on the first key or click.
  const theme = I("PlayMusicCanal", ["", audioFile("musica_menu"), "1", "yes", "35", "1"]);
  const musicOn = numIs("MusicOn", "=", "1");
  for (const input of [I("AnyKeyPressed", [""]), I("HasAnyTouchOrMouseStarted", [""])]) add(ev([musicOn, NOT("MusicPlaying", ["", "1"]), input], [theme]));

  // Scrolling: slowly on its own (after a moment on the title), fast while an arrow is held, never past the ends.
  add(ev([key("Down")], [setNum("Scroll", "+", `${FAST} * TimeDelta()`)]));
  add(ev([key("Up")], [setNum("Scroll", "-", `${FAST} * TimeDelta()`)]));
  add(ev([NOT("KeyFromTextPressed", ["", q("Down")]), NOT("KeyFromTextPressed", ["", q("Up")]), I("CompareTimer", ["", q("Espera"), ">", String(HOLD)])], [setNum("Scroll", "+", `${SPEED} * TimeDelta()`)]));
  add(ev([], [setNum("Scroll", "=", "clamp(Variable(Scroll), 0, Variable(Max))"), I("SetY", ["Rollo", "=", "Rollo.Variable(BaseY) - Variable(Scroll)"])]));
  add(ev([], [
    I("PrimitiveDrawing::Rectangle", ["velo", "0", "0", "1280", "720"]),
    I("PrimitiveDrawing::Rectangle", ["marco", "0", "0", "1280", "56"]),
    I("PrimitiveDrawing::Rectangle", ["marco", "0", "652", "1280", "720"]),
  ]));
  // At the end, a few seconds to read the last line, then the game (going back up cancels it).
  add(ev([numIs("Scroll", ">=", "Variable(Max) - 0.5")], [], [ev([I("BuiltinCommonInstructions::Once", [])], [I("ResetTimer", ["", q("FinIntro")])])]));
  add(ev([numIs("Scroll", ">=", "Variable(Max) - 0.5"), I("CompareTimer", ["", q("FinIntro"), ">", "4"])], toGame));

  // Skipping: the button (it lights up under the mouse), Space or Enter; Esc goes back to the menu.
  const over = I("CollisionPoint", ["BotonSaltar", "MouseX()", "MouseY()"]);
  add(ev([over], [I("TextObject::ChangeColor", ["BotonSaltar", q(WHITE)])]));
  add(ev([NOT("CollisionPoint", ["BotonSaltar", "MouseX()", "MouseY()"])], [I("TextObject::ChangeColor", ["BotonSaltar", q(GOLD)])]));
  add(ev([over, I("SourisBouton", ["", "Left"]), I("BuiltinCommonInstructions::Once", [])], toGame));
  for (const k of ["Space", "Return"]) add(ev([keyJust(k)], toGame));
  add(ev([keyJust("Escape")], [I("Scene", ["", q("Menu"), ""])]));

  // The menu: "Jugar" opens the intro the first time, the Tutorial after that.
  const menuLayout = project.getLayout("Menu");
  const menuVars = menuLayout.getVariables();
  if (!menuVars.has("IntroVista")) menuVars.insertNew("IntroVista", menuVars.count());
  const menuEvents = menuLayout.getEvents();
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((v, i) => v === undefined || x.params[i] === v));
  const { find } = makeEventFinder(gd, menuEvents, "step 23 (Menu)");
  const play = find((c, a) => has(c, "CollisionPoint", "botonjugar") && has(a, "Scene", "", q(FIRST)), "the Jugar button");
  const acts = play.event.getActions();
  for (let i = acts.size() - 1; i >= 0; i--) if (acts.get(i).getType() === "Scene") acts.removeAt(i);
  const subs = play.event.getSubEvents();
  subs.insertEvent(ev([numIs("IntroVista", "=", "1")], [I("Scene", ["", q(FIRST), ""])]), subs.getEventsCount());
  subs.insertEvent(ev([numIs("IntroVista", "!=", "1")], [I("Scene", ["", q(SCENE), ""])]), subs.getEventsCount());
  menuEvents.insertEvent(ev([I("SceneJustBegins", [""])], [setNum("IntroVista", "=", "0"), I("LireFichierExp", [STORE, q("introVista"), "", "IntroVista"])]), 0);

  return `${SCENE}: the first "Jugar" shows the story (${STORY.filter(Boolean).length} lines) and the credits scrolling up before the ${FIRST} (arrows to move, SALTAR to skip, then remembered)`;
}
