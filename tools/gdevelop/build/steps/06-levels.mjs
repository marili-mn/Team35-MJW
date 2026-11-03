// Step 06 — The levels. Each one is a copy of the finished Tutorial with its own art, 1.5 screens tall,
// laid out by lib/layout.mjs from a difficulty profile: the seed fixes the level (the build stays
// reproducible), "slots" are stretches drawn again on every restart (two or three alternatives each),
// and the profile grows from level to level (longer spike runs and pits, more alternatives, more and
// faster enemies, more crystals needed). Enemies are drawn again on every restart too. Game Over retries
// the level where Kaito died instead of the Tutorial.
import { captureOriginalObjects, buildLevel } from "../../lib/level.mjs";
import { generateSequence } from "../../lib/layout.mjs";
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";
import { SURVIVAL_SCENE } from "../../lib/scenes.mjs";

export const PROFILES = {
  Nivel1: { seed: 11, length: 15000, jump: [1, 2], flip: [2, 3], pit: [3, 4], zigzag: false, towers: 1, slots: 3, alternatives: 2,
    enemies: [900, 1000], saw: [600, 700], end: "end" },
  Nivel2: { seed: 22, length: 20000, jump: [2, 3], flip: [3, 5], pit: [4, 5], zigzag: true, towers: 2, slots: 4, alternatives: 2,
    enemies: [1000, 1200], saw: [700, 900], end: "end" },
  Nivel3: { seed: 33, length: 24000, jump: [2, 3], flip: [4, 6], pit: [5, 6], zigzag: true, towers: 2, slots: 5, alternatives: 3,
    enemies: [1100, 1300], saw: [800, 1000], end: "arena" },
};

export const LEVELS = [
  {
    name: "Nivel1", title: "NIVEL 1 · Templo de la Luna", next: "Nivel2",
    background: "assets/nivel1/fondo.png",
    platform: "assets/nivel1/assets de escena/pisoflotante.png", platformBottom: 0.924,
    portal: "assets/nivel1/assets de escena/puerta.png",
    topBorder: true,
    floorLine: 535, height: 1080,
    crystalsToOpen: 0.45,
    // Draw weights out of 100 (the rest: an empty zone), speeds in px/s.
    enemies: { perZone: 1, azul: 40, verde: 20, guardia: 10, sierra: 10, espectro: 8, speed: [70, 110], sawSpeed: [90, 140], wraithSpeed: [55, 75] },
  },
  {
    name: "Nivel2", title: "NIVEL 2 · Cueva de Cristal", next: "Nivel3",
    background: "assets/nivel2/fondonivel2.png",
    platform: "assets/nivel2/pisoflotante1.png", platformBottom: 0.8,
    portal: "assets/nivel1/assets de escena/puerta.png",
    floorSlabTop: 0.2,
    floorLine: 545, height: 1080,
    crystalsToOpen: 0.5,
    enemies: { perZone: 2, azul: 27, verde: 27, guardia: 10, sierra: 18, espectro: 18, speed: [90, 140], sawSpeed: [120, 180], wraithSpeed: [70, 95] },
  },
  {
    name: "Nivel3", title: "NIVEL 3 · Templo de la Luna Roja", next: "Victoria",
    background: "assets/nivel3/fondo.png",
    platform: "assets/nivel3/pisoflotante.png", platformBottom: 0.8,
    portal: "assets/nivel1/assets de escena/puerta.png",
    floorLine: 638, height: 1080,
    crystalsToOpen: 0.55,
    enemies: { perZone: 2, azul: 20, verde: 25, guardia: 15, sierra: 15, espectro: 25, speed: [110, 160], sawSpeed: [150, 210], wraithSpeed: [85, 115] },
  },
].map((def) => ({ ...def, segments: generateSequence(PROFILES[def.name]) }));

// The hidden level (step 17 turns it into endless survival): an arena on the red-moon temple with a tower,
// a slab and a high ceiling to escape upwards; no enemy zones, the enemies come in waves.
export const SURVIVAL = {
  name: SURVIVAL_SCENE, title: "NIVEL OCULTO · Supervivencia", next: "Menu",
  background: "assets/nivel3/fondo.png",
  platform: "assets/nivel3/pisoflotante.png", platformBottom: 0.8,
  portal: "assets/nivel1/assets de escena/puerta.png",
  floorLine: 638, height: 1080,
  crystalsToOpen: 1000,          // the portal stays shut (it is behind the arena's wall anyway)
  enemies: { perZone: 1, azul: 0, verde: 0, guardia: 0, sierra: 0, speed: [0, 0], sawSpeed: [0, 0] },
  segments: [["start"], ["open", 700, 2], ["bonus", 900], ["tower"], ["open", 700, 2], ["flip", 3], ["open", 500, 2], ["end"]],
};

export default function levels({ gd, project, gameDir }) {
  const captured = captureOriginalObjects(gd, project);
  const globals = project.getVariables();
  if (!globals.has("NivelActual")) globals.insertNew("NivelActual", globals.count());
  globals.get("NivelActual").setString("Tutorial");

  const built = [...LEVELS, SURVIVAL].map((def) => ({ name: def.name, ...buildLevel({ gd, project, gameDir }, def, captured) }));

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

  return built.map((b) => `${b.name}: ${b.width}x${b.height} px (${b.length} used), ${b.slots} slots (${b.draws} layouts), ${b.crystals} crystals, ${b.shurikens}+ shurikens, ${b.zones} enemy zones, ${b.checkpoints} checkpoints${b.boss ? ", final boss" : ""}`).join("; ");
}
