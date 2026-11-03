// Step 07 — Victory screen with the credits (the course asks for the team's names and the UNER logo).
// The Victoria scene was empty. Names and roles as in the GDD (landing). If the logo file exists at
// GravityRunnerDash/assets/creditos/logo-uner.png it is shown; otherwise the university's name in text.
import { existsSync } from "node:fs";
import { makeEventHelpers, makeLayoutHelpers } from "../../lib/events.mjs";
import { cloneTextObject, ensureImageResource, insertObjectFrom, serializeObject, setAnimations } from "../../lib/objects.mjs";

export const TEAM = [
  ["Nahuel Marcilli", "Diseño, sprites, GDD"],
  ["Jorgelina Elizabeth Mendieta", "Arte, paleta"],
  ["Taoufik Saidi", "Narrativa, mecánicas"],
  ["Delcy Adalis Villalba Olmedo", "Audio, testing"],
];
const LOGO = "assets/creditos/logo-uner.png";
const GOLD = "255;214;102", LILAC = "220;180;255", WHITE = "255;255;255";

export default function victoryCredits({ gd, project, gameDir }) {
  const victoria = project.getLayout("Victoria");
  const tutorial = project.getLayout("Tutorial").getObjects();
  const objects = victoria.getObjects();
  const { I, ev, q } = makeEventHelpers(gd);
  const { addInst } = makeLayoutHelpers(gd, victoria);
  victoria.setBackgroundColor(18, 10, 32);

  // Background: the sunset temple, dimmed so the text reads well.
  insertObjectFrom(gd, project, objects, "fondo", serializeObject(gd, tutorial.getObject("fondo")));
  setAnimations(gd, objects.getObject("fondo"), [{ name: "", images: [ensureImageResource(gd, project, "assets/fondos/fondo2.png")] }]);
  addInst("fondo", 0, 0, 1280, 720, { z: -10 });

  // Kaito celebrating on both sides (a copy without the platformer behavior, so he does not fall).
  const kaito = insertObjectFrom(gd, project, objects, "kaito", serializeObject(gd, tutorial.getObject("kaito")));
  for (const b of kaito.getAllBehaviorNames().toJSArray()) kaito.removeBehavior(b);
  addInst("kaito", 150, 470, 256, 256, { z: 2 });
  addInst("kaito", 1130, 470, 256, 256, { z: 2, flipX: true });

  // Texts (style copied from the HUD), centered when the scene starts. With the logo, the university's name is
  // already in it, so the line under the team names shows the course instead.
  const hasLogo = existsSync(`${gameDir}/${LOGO}`);
  insertObjectFrom(gd, project, objects, "TextoGemas", serializeObject(gd, tutorial.getObject("TextoGemas")));
  const texts = [
    ["Titulo", "¡VICTORIA!", 84, GOLD, 40],
    ["Subtitulo", "Kaito venció a la Maga Oscura del Templo de la Luna Roja", 28, WHITE, 150],
    ["Equipo", "EQUIPO 35", 30, LILAC, 215],
    ["Integrantes", TEAM.map(([n, r]) => `${n} — ${r}`).join("\n"), 25, WHITE, 262],
    ["Universidad", hasLogo ? "Multimedia y Juegos en Web · 2026" : "Universidad Nacional de Entre Ríos · 2026", 24, LILAC, 435],
    ["Motor", "Hecho con GDevelop", 20, WHITE, hasLogo ? 622 : 615],
    ["Volver", "ESPACIO para volver al menú", 26, GOLD, 660],
  ];
  for (const [name, text, size, color, y] of texts) {
    cloneTextObject(gd, project, objects, "TextoGemas", name, { text, size, color, align: "center" });
    addInst(name, 0, y, 0, 0, { z: 5 });
  }
  objects.removeObject("TextoGemas");
  if (hasLogo) {
    const logo = objects.insertNewObject(project, "Sprite", "logoUNER", objects.getObjectsCount());
    setAnimations(gd, logo, [{ name: "", images: [ensureImageResource(gd, project, LOGO)] }]);
    addInst("logoUNER", 0, 472, 0, 0, { z: 5 });   // the white version of the logo on uner.edu.ar, 300 x 138
  }

  const events = victoria.getEvents();
  const add = (e) => events.insertEvent(e, events.getEventsCount());
  const centered = [...texts.map(([name]) => name), ...(hasLogo ? ["logoUNER"] : [])];
  add(ev([I("SceneJustBegins", [""])], [
    ...centered.map((n) => I("SetX", [n, "=", `640 - ${n}.Width() / 2`])),
    I("OpacityCapability::OpacityBehavior::SetValue", ["fondo", "Opacity", "=", "120"]),
    I("SetStringVariable", ["NivelActual", "=", q("Tutorial")]),
  ]));
  add(ev([], [I("OpacityCapability::OpacityBehavior::SetValue", ["Volver", "Opacity", "=", "155 + 100 * sin(TimeFromStart() * 4)"])]));
  add(ev([I("KeyFromTextJustPressed", ["", q("Space")])], [I("Scene", ["", q("Menu"), ""])]));
  return `Victoria: ${texts.length} texts, ${TEAM.length} team members, logo ${hasLogo ? "image" : "as text (no file yet)"}`;
}
