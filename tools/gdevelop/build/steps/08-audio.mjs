// Step 08 — Sound (the course asks for background music and collision sounds; the game had no audio).
// The files are synthesized by tools/gdevelop/assets/make-audio.mjs. Effects hang as sub-events of the
// events that already do the thing (only when the options' SoundOn is 1); music on channel 1 when MusicOn
// is 1, switching to the boss track when the sorceress wakes up.
import { existsSync } from "node:fs";
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";

const AUDIO = ["salto", "golpe", "cristal", "espada", "gravedad", "enemigo", "hechizo", "portal", "victoria", "musica_nivel", "musica_jefe"];
const file = (name) => `assets/audio/${name}.wav`;
const PLAYABLE = ["Tutorial", "Nivel1", "Nivel2", "Nivel3"];

export default function audio({ gd, project, gameDir }) {
  const rm = project.getResourcesManager();
  for (const name of AUDIO) {
    if (!existsSync(`${gameDir}/${file(name)}`)) throw new Error(`step 08: missing ${file(name)} (run tools/gdevelop/assets/make-audio.mjs)`);
    if (rm.hasResource(file(name))) continue;
    const r = new gd.AudioResource();
    r.setName(file(name));
    r.setFile(file(name));
    rm.addResource(r);
  }
  const { I, NOT, ev, numIs } = makeEventHelpers(gd);
  const sound = (name, volume = 70) => ev([numIs("SoundOn", "=", "1")], [I("PlaySound", ["", file(name), "no", String(volume), "1"])]);
  const music = (name, volume = 40) => ev([numIs("MusicOn", "=", "1")], [I("PlayMusicCanal", ["", file(name), "1", "yes", String(volume), "1"])]);
  const stopMusic = () => I("StopMusicCanal", ["", "1"]);
  const attach = (event, sub) => event.getSubEvents().insertEvent(sub, event.getSubEvents().getEventsCount());
  const at = (layout) => {
    const events = project.getLayout(layout).getEvents();
    const finder = makeEventFinder(gd, events, `step 08 (${layout})`);
    return { events, ...finder, add: (e) => events.insertEvent(e, events.getEventsCount()) };
  };
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  let hooks = 0;
  const hook = (event, name, volume) => { attach(event, sound(name, volume)); hooks++; };

  for (const layout of PLAYABLE) {
    const L = at(layout);
    L.add(ev([I("SceneJustBegins", [""])], [], [music("musica_nivel")]));
    L.add(ev([I("PlatformBehavior::IsJumping", ["kaito", "PlatformerObject"]), NOT("FlippedY", ["kaito"])], [],
      [ev([I("BuiltinCommonInstructions::Once", [])], [], [sound("salto", 50)])]));
    hook(L.find((c) => has(c, "CollisionNP", "kaito", "cristal"), "crystal pickup").event, "cristal");
    for (const { event } of L.findAll((c, a) => has(c, "CompareTimer", undefined, '"Golpe"', ">") && a.some((x) => x.params[0] === "Vidas"), "damage", 3)) hook(event, "golpe");
    hook(L.find((c) => has(c, "KeyFromTextJustPressed", undefined, '"f"'), "attack").event, "espada", 55);
    const up = L.find((c, a) => c.length === 1 && c[0].type === "FlippedY" && !c[0].inverted && a.length === 0, "kaito is up");
    hook(gd.asStandardEvent(up.event.getSubEvents().getEventAt(0)), "gravedad", 60);
    hook(L.find((c, a) => has(c, "NumberVariable", "Bajar", "=", "1") && has(a, "FlipGravity::Reset"), "flip down").event, "gravedad", 45);
    if (layout === "Tutorial") continue;
    for (const { event } of L.findAll((c, a) => has(a, "Create", undefined, "cristaldorado"), "enemy kills", 3)) hook(event, "enemigo");
    hook(L.find((c) => has(c, "CollisionNP", "kaito", "cristaldorado"), "golden crystal").event, "cristal");
    hook(L.find((c, a) => has(a, "SetNumberVariable", "PortalAbierto", "=", "1"), "portal opens").event, "portal");
    if (layout !== "Nivel3") continue;
    const wake = L.find((c, a) => has(c, "NumberVariable", "MagaEstado", "=", "0") && has(a, "SetNumberVariable", "MagaEstado", "=", "1"), "boss wakes");
    wake.event.getActions().insert(stopMusic(), wake.event.getActions().size());
    attach(wake.event, music("musica_jefe", 45));
    for (const spell of ["hechizo", "dragonSombra"]) hook(L.find((c, a) => has(a, "Create", undefined, spell), `${spell} cast`).event, "hechizo", 55);
    for (const { event } of L.findAll((c, a) => has(a, "SetNumberVariable", "MagaVida", "-"), "boss hits", 4)) hook(event, "enemigo");
    const defeat = L.find((c, a) => has(a, "SetNumberVariable", "MagaDerrotada", "=", "1"), "boss defeated");
    defeat.event.getActions().insert(stopMusic(), defeat.event.getActions().size());
    hook(defeat.event, "victoria");
    attach(defeat.event, music("musica_nivel", 40));   // she can fall before the arena: the level goes on
  }

  const victoria = at("Victoria");
  victoria.add(ev([I("SceneJustBegins", [""])], [stopMusic()], [sound("victoria", 80)]));
  const gameOver = at("GameOver");
  gameOver.add(ev([I("SceneJustBegins", [""])], [stopMusic()], [sound("golpe")]));
  const menu = at("Menu");
  menu.add(ev([I("SceneJustBegins", [""])], [], [music("musica_nivel", 30)]));
  const options = at("Opciones");
  options.add(ev([numIs("MusicOn", "=", "0")], [stopMusic()]));

  return `${AUDIO.length} audio files, ${hooks} sound hooks, music in ${PLAYABLE.length + 1} scenes`;
}
