// Step 20 — Sound for what came after step 08: the dash, a spell reflected by the katana, the wraiths, the
// crystals lost to a hit, checkpoints, a cleared level, survival waves and the level select. Each effect
// hangs as a sub-event of the event that already does the thing (only when SoundOn is 1), as in step 08. The
// level select does not stop the sounds when it starts, so the menu theme goes on under it.
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";
import { PLAYABLE, SURVIVAL_SCENE, LEVEL_SELECT_SCENE } from "../../lib/scenes.mjs";
import { audioFile, VARY } from "./08-audio.mjs";

export default function soundDesign({ gd, project }) {
  const { I, ev, numIs } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const sound = (name, volume, pitch = "1") => ev([numIs("SoundOn", "=", "1")], [I("PlaySound", ["", audioFile(name), "no", String(volume), pitch])]);
  let hooks = 0;
  const hook = (event, name, volume, pitch) => { event.getSubEvents().insertEvent(sound(name, volume, pitch), event.getSubEvents().getEventsCount()); hooks++; };
  const inside = (parent, label) => makeEventFinder(gd, parent.getSubEvents(), label);

  for (const name of PLAYABLE) {
    const label = `step 20 (${name})`, { find, findAll, findSome } = makeEventFinder(gd, project.getLayout(name).getEvents(), label);
    const attack = find((c, a) => has(c, "KeyFromTextJustPressed", undefined, '"f"') && has(a, "SetNumberVariable", "Atacando", "=", "1"), "attack key");
    hook(inside(attack.event, `${label}, attack`).find((c, a) => has(a, "SetNumberVariable", "DashAtaque", "=", "1"), "dash").event, "dash", 60, VARY);
    const hurt = find((c, a) => c.some((x) => x.type === "CollisionNP" && x.params[0] === "kaito") && has(a, "SetNumberVariable", "Vidas", "-"), "damage");
    hook(inside(hurt.event, `${label}, damage`).find((c) => has(c, "NumberVariable", "Perdidos", ">", "0"), "crystals lost").event, "dispersion", 60);
    if (name === "Tutorial") continue;
    if (name === SURVIVAL_SCENE) {
      hook(find((c) => has(c, "NumberVariable", "Oleada", ">", "Variable(OleadaVista)"), "new wave").event, "oleada", 75);
      const spawn = find((c, a) => has(a, "ResetTimer", undefined, '"Oleadas"') && has(a, "SetNumberVariable", "SorteoSup", "="), "spawn");
      hook(inside(spawn.event, `${label}, spawn`).find((c, a) => has(a, "Create", undefined, "fantasma"), "a wraith comes").event, "espectro", 40);
      continue;
    }
    for (const { event } of findSome((c, a) => has(a, "TextContainerCapability::TextContainerBehavior::SetValue", "Aviso", "Text", "=", '"Punto de control"'), "checkpoints")) hook(event, "checkpoint", 45);
    hook(find((c, a) => has(a, "SetNumberVariable", "Completado", "=", "1"), "level cleared").event, "completado", 80);
    if (name !== "Nivel3") continue;
    for (const { event } of findAll((c, a) => has(a, "Create", undefined, "hechizoReflejado") || has(a, "Create", undefined, "dragonReflejado"), "reflected spells", 4)) hook(event, "reflejo", 75);
    hook(find((c, a) => has(a, "Create", undefined, "fantasma") && has(a, "SetNumberVariable", "MagaEstado", "=", "1"), "wraiths summoned").event, "espectro", 70);
  }

  const select = project.getLayout(LEVEL_SELECT_SCENE);
  select.setStopSoundsOnStartup(false);
  const S = makeEventFinder(gd, select.getEvents(), "step 20 (level select)");
  for (const k of ["Down", "Up"]) hook(S.find((c) => has(c, "KeyFromTextJustPressed", undefined, `"${k}"`), `${k} key`).event, "menu_mover", 60);
  hook(S.find((c) => has(c, "KeyFromTextJustPressed", undefined, '"r"'), "reset key").event, "menu_ok", 60);
  return `${hooks} more sound hooks (dash, reflections, wraiths, lost crystals, checkpoints, cleared levels, waves, level select)`;
}
