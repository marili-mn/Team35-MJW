// Step 06 — The levels (playtest: the Tutorial portal led to an empty one-screen Nivel1). Each level is a
// copy of the finished Tutorial with its own art, 2-3x longer, built from segments (lib/level.mjs), with
// enemies drawn again on every restart and a portal that opens with 60% of the crystals. Game Over now
// retries the level where Kaito died instead of the Tutorial.
import { captureOriginalObjects, buildLevel } from "../../lib/level.mjs";
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";

export const LEVELS = [
  {
    name: "Nivel1", title: "NIVEL 1 · Templo de la Luna", next: "Nivel2",
    background: "assets/nivel1/fondo.png",
    platform: "assets/nivel1/assets de escena/pisoflotante.png", platformBottom: 0.924,
    portal: "assets/nivel1/assets de escena/puerta.png",
    topBorder: true,
    floorLine: 535,
    crystalsToOpen: 0.6,
    // Draw weights out of 100 (the rest: an empty zone), speeds in px/s.
    enemies: { perZone: 1, azul: 40, verde: 20, guardia: 10, sierra: 10, speed: [70, 110], sawSpeed: [90, 140] },
    segments: [
      ["start"], ["open", 500, 3], ["jump"], ["enemies", 900], ["flip", 3], ["open", 300, 2], ["enemies", 1000],
      ["jump2"], ["bonus", 900], ["enemies", 900], ["flip", 4], ["zigzag"], ["enemies", 1000], ["saw", 700],
      ["jump"], ["enemies", 1100], ["flip", 2], ["open", 400, 3], ["end"],
    ],
  },
  {
    name: "Nivel2", title: "NIVEL 2 · Cueva de Cristal", next: "Nivel3",
    background: "assets/nivel2/fondonivel2.png",
    platform: "assets/nivel2/pisoflotante1.png", platformBottom: 0.8,
    portal: "assets/nivel1/assets de escena/puerta.png",
    floorSlabTop: 0.2,
    floorLine: 545,
    crystalsToOpen: 0.6,
    enemies: { perZone: 2, azul: 30, verde: 30, guardia: 10, sierra: 20, speed: [90, 140], sawSpeed: [120, 180] },
    segments: [
      ["start"], ["jump"], ["enemies", 1000], ["flip", 4], ["saw", 800], ["zigzag"], ["enemies", 1100], ["jump2"],
      ["bonus", 1000], ["flip", 5], ["enemies", 1200], ["saw", 800], ["zigzag"], ["jump2"], ["enemies", 1200],
      ["flip", 3], ["bonus", 900], ["zigzag"], ["enemies", 1200], ["open", 400, 3], ["end"],
    ],
  },
  {
    name: "Nivel3", title: "NIVEL 3 · Templo de la Luna Roja", next: "Victoria",
    background: "assets/nivel3/fondo.png",
    platform: "assets/nivel3/pisoflotante.png", platformBottom: 0.8,
    portal: "assets/nivel1/assets de escena/puerta.png",
    floorLine: 638,
    crystalsToOpen: 0.6,
    enemies: { perZone: 2, azul: 25, verde: 35, guardia: 15, sierra: 20, speed: [110, 160], sawSpeed: [150, 210] },
    segments: [
      ["start"], ["enemies", 1000], ["zigzag"], ["jump2"], ["enemies", 1200], ["flip", 5], ["saw", 900], ["zigzag"],
      ["enemies", 1300], ["bonus", 1000], ["flip", 6], ["jump2"], ["enemies", 1300], ["zigzag"], ["saw", 900],
      ["enemies", 1300], ["flip", 4], ["zigzag"], ["enemies", 1400], ["open", 400, 3], ["end"],
    ],
  },
];

export default function levels({ gd, project }) {
  const captured = captureOriginalObjects(gd, project);
  const globals = project.getVariables();
  if (!globals.has("NivelActual")) globals.insertNew("NivelActual", globals.count());
  globals.get("NivelActual").setString("Tutorial");

  const built = LEVELS.map((def) => ({ name: def.name, ...buildLevel({ gd, project }, def, captured) }));

  // The Tutorial also remembers itself and hides its colliders, like the levels (added after the levels
  // were copied from it).
  const { I, ev, setStr } = makeEventHelpers(gd);
  const tutorial = project.getLayout("Tutorial").getEvents();
  tutorial.insertEvent(ev([I("SceneJustBegins", [""])], [setStr("NivelActual", "Tutorial"), I("Cache", ["piso"]), I("Cache", ["techo"])]),
    tutorial.getEventsCount());

  const gameOver = project.getLayout("GameOver").getEvents();
  const retry = makeEventFinder(gd, gameOver, "step 06").find((c, a) => a.some((x) => x.type === "Scene"), "game over retry");
  const acts = retry.event.getActions();
  for (let i = 0; i < acts.size(); i++) if (acts.get(i).getType() === "Scene") acts.get(i).setParameter(1, "GlobalVariableString(NivelActual)");

  return built.map((b) => `${b.name}: ${b.width} px (${b.length} used), ${b.crystals} crystals, ${b.zones} enemy zones, ${b.checkpoints} checkpoints`).join("; ");
}
