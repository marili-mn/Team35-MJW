// Step 22 — Agile ninjas that throw shurikens (playtest request: "more enemies", "more agility", "shurikens
// that can be reflected"). Two new ninjas join the levels and the survival waves, the red ninja and the
// shadow ninja (lib/level.mjs draws them with the rest), and every ninja now hops, dashes at Kaito, stops at
// the ends of its patrol, throws shurikens from a distance and shows each of its moves (lib/enemies.mjs).
// A shuriken met with the katana flies back golden and fells the enemy it hits. Faster in each level.
// Ninjas also stand guard up high, on the slabs and the towers' upper steps (request: "enemies on the
// upper platforms"), more often in each level. From Nivel 2 on every kind shows up in every attempt: after
// the draw, a kind that came out missing is placed in a random enemy zone (saws have zones of their own).
import { makeEventHelpers, makeLayoutHelpers } from "../../lib/events.mjs";
import { addEnemyAgility, addUpperEnemies } from "../../lib/enemies.mjs";
import { KINDS } from "../../lib/level.mjs";
import { LEVEL_SCENES, SURVIVAL_SCENE } from "../../lib/scenes.mjs";
import { audioFile, VARY } from "./08-audio.mjs";

const PACE = { Nivel1: 1, Nivel2: 1.1, Nivel3: 1.2, [SURVIVAL_SCENE]: 1.15 };
const UPPER = { Nivel1: [0.45, [55, 85]], Nivel2: [0.55, [65, 95]], Nivel3: [0.65, [75, 110]] };   // chance per surface, patrol speed
const UPPER_KINDS = [["rojo", 35], ["azul", 25], ["verde", 20], ["sombra", 20]];
const EVERY_KIND = { Nivel2: { speed: [90, 140], wraith: [70, 95] }, Nivel3: { speed: [110, 160], wraith: [85, 115] } };

export default function agileEnemies({ gd, project }) {
  const { I, ev, numIs } = makeEventHelpers(gd);
  const sound = (name, volume, pitch = "1") => ev([numIs("SoundOn", "=", "1")], [I("PlaySound", ["", audioFile(name), "no", String(volume), pitch])]);
  const done = [];
  for (const name of [...LEVEL_SCENES, SURVIVAL_SCENE]) {
    const added = addEnemyAgility({ gd, layout: project.getLayout(name), pace: PACE[name], sound, vary: VARY });
    let upper = "";
    if (UPPER[name]) {
      const layout = project.getLayout(name);
      const kaito = makeLayoutHelpers(gd, layout).allInstances().find((i) => i.getObjectName() === "kaito");
      const [chance, speed] = UPPER[name];
      addUpperEnemies({ gd, layout, floorLine: Math.round(kaito.getY() + 60), chance, speed, kinds: UPPER_KINDS.map(([k, wgt]) => [k, wgt, KINDS[k]]) });
      upper = `, ${Math.round(chance * 100)} % of the high surfaces guarded`;
      if (EVERY_KIND[name]) {
        const F = Math.round(kaito.getY() + 60), { speed: sp, wraith } = EVERY_KIND[name];
        for (const kind of ["azul", "verde", "rojo", "sombra", "guardia", "espectro"]) {
          const { object: o, w, h, top } = KINDS[kind];
          const base = kind === "guardia" ? "0" : `RandomInRange(${(kind === "espectro" ? wraith : sp).join(", ")})`;
          layout.getEvents().insertEvent(ev([I("SceneJustBegins", [""]), I("BuiltinCommonInstructions::CompareNumbers", [`Count(${o})`, "=", "0"]), I("AjoutHasard", ["", "zonaEnemigo"])], [
            I("Create", ["", o, `RandomInRange(zonaEnemigo.X(), zonaEnemigo.X() + zonaEnemigo.Width() - ${w})`, String(F - top), ""]),
            I("ResizableCapability::ResizableBehavior::SetWidth", [o, "Resizable", "=", String(w)]),
            I("ResizableCapability::ResizableBehavior::SetHeight", [o, "Resizable", "=", String(h)]),
            I("SetNumberObjectVariable", [o, "MinX", "=", "zonaEnemigo.X()"]),
            I("SetNumberObjectVariable", [o, "MaxX", "=", `zonaEnemigo.X() + zonaEnemigo.Width() - ${w}`]),
            I("SetNumberObjectVariable", [o, "Base", "=", base]),
            I("SetNumberObjectVariable", [o, "Dir", "=", "RandomInRange(0, 1) * 2 - 1"]),
            ...(kind === "espectro" ? [I("SetNumberObjectVariable", [o, "Fase", "=", "RandomFloat(6.28)"])] : []),
          ]), layout.getEvents().getEventsCount());
        }
        upper += ", every kind in every attempt";
      }
    }
    done.push(`${name} (${added} events, shurikens x${PACE[name]}${upper})`);
  }
  return `agile ninjas with reflectable shurikens: ${done.join(", ")}`;
}
