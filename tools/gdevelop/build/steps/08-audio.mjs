// Step 08 — Sound (the course asks for background music and collision sounds; the game had no audio).
// The files are synthesized by tools/gdevelop/assets/make-audio.mjs (docs/sonido.md). Effects hang as
// sub-events of the events that already do the thing (only when the options' SoundOn is 1); the frequent,
// noisy ones play at a slightly different pitch each time so they do not tire the ear. Music on channel 1
// when MusicOn is 1: a theme per level, the boss track when the sorceress wakes up (and in survival), the
// menu theme in the menu and after the victory fanfare. Effects are preloaded, so the first one is instant.
import { existsSync } from "node:fs";
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";
import { PLAYABLE, SURVIVAL_SCENE } from "../../lib/scenes.mjs";

// name -> format: what must sound the instant a key is pressed is WAV, the rest MP3 (smaller).
export const AUDIO = {
  salto: "wav", golpe: "wav", cristal: "wav", espada: "wav", gravedad: "wav", enemigo: "wav", hechizo: "wav",
  dash: "wav", reflejo: "wav", menu_mover: "wav", shuriken: "wav",
  espectro: "mp3", dispersion: "mp3", checkpoint: "mp3", oleada: "mp3", menu_ok: "mp3", sombra: "mp3",
  portal: "mp3", completado: "mp3", victoria: "mp3", derrota: "mp3",
  musica_menu: "mp3", musica_nivel: "mp3", musica_nivel2: "mp3", musica_nivel3: "mp3", musica_jefe: "mp3",
};
export const audioFile = (name) => `assets/audio/${name}.${AUDIO[name]}`;
export const THEME = { Tutorial: "musica_nivel", Nivel1: "musica_nivel", Nivel2: "musica_nivel2", Nivel3: "musica_nivel3", [SURVIVAL_SCENE]: "musica_jefe" };
export const VARY = "RandomFloatInRange(0.94, 1.06)";

export default function audio({ gd, project, gameDir }) {
  const rm = project.getResourcesManager();
  for (const name of Object.keys(AUDIO)) {
    const file = audioFile(name);
    if (!existsSync(`${gameDir}/${file}`)) throw new Error(`step 08: missing ${file} (run tools/gdevelop/assets/make-audio.mjs)`);
    if (rm.hasResource(file)) continue;
    const r = new gd.AudioResource();
    r.setName(file);
    r.setFile(file);
    if (!name.startsWith("musica_")) r.updateProperty("Preload as sound", "1");
    rm.addResource(r);
  }
  const { I, NOT, ev, numIs, timer, resetTimer } = makeEventHelpers(gd);
  const sound = (name, volume = 70, pitch = "1") => ev([numIs("SoundOn", "=", "1")], [I("PlaySound", ["", audioFile(name), "no", String(volume), pitch])]);
  const music = (name, volume = 40) => ev([numIs("MusicOn", "=", "1")], [I("PlayMusicCanal", ["", audioFile(name), "1", "yes", String(volume), "1"])]);
  const stopMusic = () => I("StopMusicCanal", ["", "1"]);
  const attach = (event, sub) => event.getSubEvents().insertEvent(sub, event.getSubEvents().getEventsCount());
  const at = (layout) => {
    const events = project.getLayout(layout).getEvents();
    const finder = makeEventFinder(gd, events, `step 08 (${layout})`);
    return { events, ...finder, add: (e) => events.insertEvent(e, events.getEventsCount()) };
  };
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  let hooks = 0;
  const hook = (event, name, volume, pitch) => { attach(event, sound(name, volume, pitch)); hooks++; };

  for (const layout of PLAYABLE) {
    const L = at(layout), theme = THEME[layout];
    L.add(ev([I("SceneJustBegins", [""])], [], [music(theme, layout === SURVIVAL_SCENE ? 42 : 40)]));
    L.add(ev([I("PlatformBehavior::IsJumping", ["kaito", "PlatformerObject"]), NOT("FlippedY", ["kaito"])], [],
      [ev([I("BuiltinCommonInstructions::Once", [])], [], [sound("salto", 50, VARY)])]));
    hook(L.find((c) => has(c, "CollisionNP", "kaito", "cristal"), "crystal pickup").event, "cristal");
    for (const { event } of L.findAll((c, a) => has(c, "CompareTimer", undefined, '"Golpe"', ">") && a.some((x) => x.params[0] === "Vidas"), "damage", 3)) hook(event, "golpe", 70, VARY);
    hook(L.find((c) => has(c, "KeyFromTextJustPressed", undefined, '"f"'), "attack").event, "espada", 55, VARY);
    const up = L.find((c, a) => c.length === 1 && c[0].type === "FlippedY" && !c[0].inverted && a.length === 0, "kaito is up");
    hook(gd.asStandardEvent(up.event.getSubEvents().getEventAt(0)), "gravedad", 60);
    hook(L.find((c, a) => has(c, "NumberVariable", "Bajar", "=", "1") && has(a, "FlipGravity::Reset"), "flip down").event, "gravedad", 45, "0.85");
    if (layout === "Tutorial") continue;
    for (const { event } of L.findAll((c, a) => has(a, "Create", undefined, "cristaldorado"), "enemy kills", 3)) hook(event, "enemigo", 70, VARY);
    hook(L.find((c) => has(c, "CollisionNP", "kaito", "cristaldorado"), "golden crystal").event, "cristal");
    hook(L.find((c, a) => has(a, "SetNumberVariable", "PortalAbierto", "=", "1"), "portal opens").event, "portal");
    if (layout !== "Nivel3") continue;
    const wake = L.find((c, a) => has(c, "NumberVariable", "MagaEstado", "=", "0") && has(a, "SetNumberVariable", "MagaEstado", "=", "1"), "boss wakes");
    wake.event.getActions().insert(stopMusic(), wake.event.getActions().size());
    attach(wake.event, music("musica_jefe", 45));
    for (const spell of ["hechizo", "dragonSombra"]) hook(L.find((c, a) => has(a, "Create", undefined, spell), `${spell} cast`).event, "hechizo", 55);
    for (const { event } of L.findAll((c, a) => has(a, "SetNumberVariable", "MagaVida", "-"), "boss hits", 4)) hook(event, "enemigo", 70, VARY);
    const defeat = L.find((c, a) => has(a, "SetNumberVariable", "MagaDerrotada", "=", "1"), "boss defeated");
    defeat.event.getActions().insert(stopMusic(), defeat.event.getActions().size());
    hook(defeat.event, "victoria");
    attach(defeat.event, music(theme, 40));   // she can fall before the arena: the level goes on
  }

  // Victory: the fanfare, then the menu theme under the credits.
  const victoria = at("Victoria");
  victoria.add(ev([I("SceneJustBegins", [""])], [stopMusic(), resetTimer("MusicaCreditos")], [sound("victoria", 80)]));
  victoria.add(ev([timer("MusicaCreditos", ">", "4.5"), I("BuiltinCommonInstructions::Once", [])], [], [music("musica_menu", 35)]));
  const gameOver = at("GameOver");
  gameOver.add(ev([I("SceneJustBegins", [""])], [stopMusic()], [sound("derrota", 80)]));
  const menu = at("Menu");
  menu.add(ev([I("SceneJustBegins", [""])], [], [music("musica_menu", 35)]));
  // Browsers keep a page silent until its first click or key press: if the theme could not start when the
  // game opened, it starts on that first input.
  const silent = [numIs("MusicOn", "=", "1"), NOT("MusicPlaying", ["", "1"])];
  const theme = I("PlayMusicCanal", ["", audioFile("musica_menu"), "1", "yes", "35", "1"]);
  for (const input of [I("AnyKeyPressed", [""]), I("HasAnyTouchOrMouseStarted", [""])]) menu.add(ev([...silent, input], [theme]));
  const options = at("Opciones");
  options.add(ev([numIs("MusicOn", "=", "0")], [stopMusic()]));

  return `${Object.keys(AUDIO).length} audio files, ${hooks} sound hooks, a theme per level, music in ${PLAYABLE.length + 2} scenes`;
}
