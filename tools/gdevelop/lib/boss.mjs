// The sorceress, final boss of the last level. She appears once Kaito leaves the start and follows him
// through the whole level, a few steps ahead or behind, gliding over the terrain. She attacks with an
// energy burst along the floor (jump it or flip up) and a dash through Kaito (jump her or cut her as she
// comes); in the arena at the end she also sends a smoke dragon along the ceiling (drop down). Outside the
// arena she holds her spells while Kaito is near spikes or upside down, so every attack can be dodged.
// Each katana hit takes one of her lives and she teleports to the other side of Kaito; in the arena she
// casts faster at half life, fires her burst twice and calls up to 3 dark-energy wraiths. A spell cut
// with the katana flies back at her and hurts her like a blow. Defeating her opens the portal.
// Frames: tools/gdevelop/assets/slice-maga.mjs.
import { makeEventHelpers } from "./events.mjs";
import { setAnimations, ensureImageResource, serializeObject, insertObjectFrom, declareObjectNumbers, cloneTextObject } from "./objects.mjs";

export const BOSS_LIVES = 16;
// Frames are 400x230, body centered at x=200 with the feet at y=222. At 0.70 she stands 120 px tall,
// like Kaito and every other character (lib/level.mjs KINDS).
const SCALE = 0.7;
const FRAME = (i) => `assets/maga/maga_${i}.png`;
const BURST = { w: 64, h: 90 }, DRAGON = { w: 48, h: 118 };
const SPELL_SPEED = { hechizo: 500, dragonSombra: 420 };
const KEEP = 420;          // distance she keeps from Kaito while she follows him
const GLIDE = 230;         // px/s, a bit slower than Kaito walking (250), so he can catch her
const DASH = { speed: 760, time: 1, past: 250 };
const COOLDOWN = { road: 1.9, arena: 1.3, arenaHalf: 0.8 };
const REFLECT_RANGE = 130, MAX_WRAITHS = 3;
const WAKE_X = 900;        // she shows up once Kaito leaves the start
const SAFE_FROM_SPIKES = 450;
const HIT_RANGE = 170;

export function addBoss({ gd, project }, level, { floorLine: F, ceilingLine: C, arena, width: W }) {
  const objects = level.getObjects();
  const events = level.getEvents();
  const { I, ev, q, setNum, numIs, timer, resetTimer } = makeEventHelpers(gd);
  const add = (e) => events.insertEvent(e, events.getEventsCount());
  const img = (f) => ensureImageResource(gd, project, f);

  // ---- objects ----
  const maga = objects.insertNewObject(project, "Sprite", "maga", objects.getObjectsCount());
  setAnimations(gd, maga, [
    { name: "idle", images: [12, 13, 14, 13].map((i) => img(FRAME(i))), speed: 0.3 },
    { name: "cast", images: [1, 2, 3].map((i) => img(FRAME(i))), speed: 0.15, loop: false },
    { name: "summon", images: [6, 7, 8].map((i) => img(FRAME(i))), speed: 0.15, loop: false },
    { name: "dash", images: [14, 13].map((i) => img(FRAME(i))), speed: 0.12 },
    { name: "hurt", images: [img(FRAME(0))], speed: 0.2, loop: false },
  ], { origin: [200, 222], mask: [[172, 60], [228, 60], [228, 222], [172, 222]] });
  // Her spells, and the same spells once Kaito cuts them back at her (not dangerous for him).
  for (const [name, file] of [["hechizo", "assets/maga/hechizo.png"], ["dragonSombra", "assets/maga/dragon.png"],
    ["hechizoReflejado", "assets/maga/hechizo.png"], ["dragonReflejado", "assets/maga/dragon.png"]]) {
    const o = objects.insertNewObject(project, "Sprite", name, objects.getObjectsCount());
    setAnimations(gd, o, [{ name: "", images: [img(file)] }]);
    declareObjectNumbers(o, ["Vel"]);
  }
  const peligro = objects.getObjectGroups().get("Peligro");
  for (const n of ["maga", "hechizo", "dragonSombra"]) peligro.addObject(n);
  insertObjectFrom(gd, project, objects, "barraMaga", serializeObject(gd, objects.getObject("energiadebarra")));
  cloneTextObject(gd, project, objects, "TextoGemas", "TextoMaga", { text: "MAGA OSCURA", size: 26, color: "220;180;255" });

  // ---- instances ----
  const instances = level.getInitialInstances();
  const place = (name, x, y, w, h, layer = "") => {
    const inst = instances.insertNewInitialInstance();
    inst.setObjectName(name); inst.setX(x); inst.setY(y); inst.setLayer(layer); inst.setZOrder(4);
    if (w) { inst.setHasCustomSize(true); inst.setCustomWidth(w); inst.setCustomHeight(h); }
  };
  place("maga", WAKE_X + 600, F, Math.round(400 * SCALE), Math.round(230 * SCALE));
  place("TextoMaga", 735, 34, 0, 0, "HUD");
  place("barraMaga", 930, 5, BOSS_LIVES * 25, 85, "HUD");   // the bar image is the red band of an 85 px tall frame

  // ---- variables ----
  // MagaEstado: 0 hidden, 1 following, 2 casting, 3 defeated, 4 dashing. MagaLado: +1 ahead of Kaito, -1 behind.
  const vars = level.getVariables();
  for (const [n, v] of [["MagaVida", BOSS_LIVES], ["MagaEstado", 0], ["MagaAtaque", 0], ["MagaDerrotada", 0], ["MagaLado", 1],
    ["MagaHerida", 0], ["MagaDir", 1], ["MagaObjetivo", 0], ["MagaPuede", 0], ["MagaArena", 0], ["MagaMin", 200], ["MagaMax", W - 200],
    ["MagaRafaga", 0]]) {
    if (!vars.has(n)) vars.insertNew(n, vars.count());
    vars.get(n).setValue(v);
  }

  // ---- events ----
  const anim = (name) => I("AnimatableCapability::AnimatableBehavior::SetName", ["maga", "Animation", "=", q(name)]);
  const warn = (text) => [
    I("TextContainerCapability::TextContainerBehavior::SetValue", ["Aviso", "Text", "=", q(text)]), I("Montre", ["Aviso", ""]), resetTimer("Aviso"),
  ];
  const opacity = (o, v) => I("OpacityCapability::OpacityBehavior::SetValue", [o, "Opacity", "=", v]);
  const awake = numIs("MagaEstado", ">=", "1");
  const alive = numIs("MagaDerrotada", "=", "0");
  const beside = `clamp(kaito.X() + Variable(MagaLado) * ${KEEP}, Variable(MagaMin), Variable(MagaMax))`;
  add(ev([I("SceneJustBegins", [""])], [I("Cache", ["TextoMaga"]), I("Cache", ["barraMaga"]), I("Cache", ["maga"]), anim("idle")]));
  // Shows up ahead of Kaito once he leaves the start.
  add(ev([numIs("MagaEstado", "=", "0"), I("PosX", ["kaito", ">", WAKE_X])], [
    setNum("MagaEstado", "=", "1"), setNum("MagaLado", "=", "1"), I("SetX", ["maga", "=", beside]), resetTimer("Maga"),
    I("Montre", ["maga", ""]), I("Montre", ["TextoMaga", ""]), I("Montre", ["barraMaga", ""]),
    ...warn("¡La Maga Oscura te persigue!"),
  ]));
  // The arena: she waits for Kaito at its far side and stays inside it until the end.
  add(ev([numIs("MagaArena", "=", "0"), I("PosX", ["kaito", ">", arena.x0 + 120])], [
    setNum("MagaArena", "=", "1"), setNum("MagaMin", "=", String(arena.x0 + 150)), setNum("MagaMax", "=", String(arena.x1 - 150)),
  ], [
    ev([awake, alive], [
      I("SetX", ["maga", "=", String(arena.x1 - 260)]), setNum("MagaLado", "=", "1"), setNum("MagaEstado", "=", "1"), resetTimer("Maga"),
      I("Delete", ["hechizo", ""]), ...warn("¡Derrotá a la Maga Oscura!"),
    ]),
  ]));
  add(ev([awake], [I("ResizableCapability::ResizableBehavior::SetWidth", ["barraMaga", "Resizable", "=", "Variable(MagaVida) * 25"])]));
  add(ev([awake, numIs("MagaEstado", "!=", "4"), I("PosX", ["maga", ">", "kaito.X()"])], [I("FlippableCapability::FlippableBehavior::FlipX", ["maga", "Flippable", "yes"])]));
  add(ev([awake, numIs("MagaEstado", "!=", "4"), I("PosX", ["maga", "<=", "kaito.X()"])], [I("FlippableCapability::FlippableBehavior::FlipX", ["maga", "Flippable", "no"])]));

  // Following: glides towards her spot beside Kaito, or teleports there when he got far (running, respawn).
  const following = numIs("MagaEstado", "=", "1");
  add(ev([following], [setNum("MagaObjetivo", "=", beside)]));
  add(ev([following, I("PosX", ["maga", "<", "Variable(MagaObjetivo) - 900"])], [I("SetX", ["maga", "=", "Variable(MagaObjetivo)"])]));
  add(ev([following, I("PosX", ["maga", ">", "Variable(MagaObjetivo) + 900"])], [I("SetX", ["maga", "=", "Variable(MagaObjetivo)"])]));
  add(ev([following], [I("SetX", ["maga", "+", `clamp(Variable(MagaObjetivo) - maga.X(), -${GLIDE} * TimeDelta(), ${GLIDE} * TimeDelta())`])]));
  // She floats a little above the ground (she glides over spikes and gaps).
  add(ev([awake], [I("SetY", ["maga", "=", `${F - 14} - 6 * sin(TimeFromStart() * 3)`])]));

  // When she may attack: always in the arena; outside it, not while Kaito is near spikes or upside down.
  add(ev([], [setNum("MagaPuede", "=", "1")]));
  add(ev([numIs("MagaArena", "=", "0"), I("Distance", ["kaito", "pinchos", String(SAFE_FROM_SPIKES), ""])], [setNum("MagaPuede", "=", "0")]));
  add(ev([numIs("MagaArena", "=", "0"), I("FlippedY", ["kaito"])], [setNum("MagaPuede", "=", "0")]));
  add(ev([numIs("Muerto", "=", "1")], [setNum("MagaPuede", "=", "0")]));

  // Following -> chooses an attack: burst or dash on the way, also the dragon in the arena (faster at half life).
  const cast = [setNum("MagaEstado", "=", "2"), resetTimer("Maga")];
  const ready = [following, numIs("MagaPuede", "=", "1")];
  add(ev([...ready, numIs("MagaArena", "=", "0"), timer("Maga", ">", String(COOLDOWN.road))], [setNum("MagaAtaque", "=", "RandomInRange(0, 1) * 2 + 1"), ...cast]));
  // In the arena: burst, dragon, dash or (from two thirds of her life down, up to MAX_WRAITHS) wraiths.
  const arenaPick = [setNum("MagaAtaque", "=", "RandomInRange(1, 4)"), ...cast];
  const noWraiths = [
    ev([numIs("MagaAtaque", "=", "4"), I("BuiltinCommonInstructions::CompareNumbers", ["Count(fantasma)", ">=", String(MAX_WRAITHS)])], [setNum("MagaAtaque", "=", "1")]),
    ev([numIs("MagaAtaque", "=", "4"), numIs("MagaVida", ">", Math.round((BOSS_LIVES * 2) / 3))], [setNum("MagaAtaque", "=", "1")]),
  ];
  add(ev([...ready, numIs("MagaArena", "=", "1"), numIs("MagaVida", ">", BOSS_LIVES / 2), timer("Maga", ">", String(COOLDOWN.arena))], arenaPick, noWraiths));
  add(ev([...ready, numIs("MagaArena", "=", "1"), numIs("MagaVida", "<=", BOSS_LIVES / 2), timer("Maga", ">", String(COOLDOWN.arenaHalf))], arenaPick, noWraiths));
  add(ev([numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", "1")], [anim("cast")]));
  add(ev([numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", "2")], [anim("summon")]));
  add(ev([numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", "3")], [anim("dash")]));
  add(ev([numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", "4")], [anim("summon")]));
  // Casting -> the spell leaves towards Kaito, or she dashes at him.
  const spell = (name, size, y) => [
    I("Create", ["", name, "maga.X() - " + size.w / 2, String(y), ""]),
    I("ResizableCapability::ResizableBehavior::SetWidth", [name, "Resizable", "=", String(size.w)]),
    I("ResizableCapability::ResizableBehavior::SetHeight", [name, "Resizable", "=", String(size.h)]),
  ];
  const towardsKaito = (name, speed) => [
    ev([I("PosX", ["maga", ">", "kaito.X()"])], [I("SetNumberObjectVariable", [name, "Vel", "=", String(-speed)])]),
    ev([I("PosX", ["maga", "<=", "kaito.X()"])], [I("SetNumberObjectVariable", [name, "Vel", "=", String(speed)])]),
  ];
  const release = [setNum("MagaEstado", "=", "1"), resetTimer("Maga")];
  const casting = (n) => [numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", String(n)), timer("Maga", ">", "0.55")];
  add(ev(casting(1), [...spell("hechizo", BURST, F - BURST.h - 4), ...release], [
    ...towardsKaito("hechizo", SPELL_SPEED.hechizo),
    // In the arena at half life the burst comes twice.
    ev([numIs("MagaArena", "=", "1"), numIs("MagaVida", "<=", BOSS_LIVES / 2)], [setNum("MagaRafaga", "=", "1"), resetTimer("MagaRafaga")]),
  ]));
  add(ev([numIs("MagaRafaga", "=", "1"), timer("MagaRafaga", ">", "0.35"), alive], [...spell("hechizo", BURST, F - BURST.h - 4), setNum("MagaRafaga", "=", "0")],
    towardsKaito("hechizo", SPELL_SPEED.hechizo)));
  add(ev(casting(2), [...spell("dragonSombra", DRAGON, C - 8), ...release], towardsKaito("dragonSombra", SPELL_SPEED.dragonSombra)));
  // Wraiths rise on both sides of her (lib/level.mjs makes them glide at Kaito).
  const wraith = (dx) => [
    I("Create", ["", "fantasma", `maga.X() + ${dx} - 65`, String(F - 260), ""]),
    I("ResizableCapability::ResizableBehavior::SetWidth", ["fantasma", "Resizable", "=", "130"]),
    I("ResizableCapability::ResizableBehavior::SetHeight", ["fantasma", "Resizable", "=", "130"]),
    I("SetNumberObjectVariable", ["fantasma", "Base", "=", "115"]),
    I("SetNumberObjectVariable", ["fantasma", "Fase", "=", "RandomFloat(6.28)"]),
    I("Create", ["", "fxMagia", `maga.X() + ${dx}`, String(F - 195), ""]),
  ];
  add(ev(casting(4), [...wraith(-170), ...wraith(170), ...release, ...warn("¡Invoca espectros!")]));
  add(ev(casting(3), [setNum("MagaEstado", "=", "4"), resetTimer("Maga")], [
    ev([I("PosX", ["maga", ">", "kaito.X()"])], [setNum("MagaDir", "=", "-1")]),
    ev([I("PosX", ["maga", "<=", "kaito.X()"])], [setNum("MagaDir", "=", "1")]),
  ]));
  // Dashing: straight through Kaito until she is well past him, runs out of time or reaches her bounds.
  const dashing = numIs("MagaEstado", "=", "4");
  add(ev([dashing], [I("SetX", ["maga", "+", `Variable(MagaDir) * ${DASH.speed} * TimeDelta()`])]));
  const endDash = [setNum("MagaLado", "=", "Variable(MagaDir)"), ...release];
  add(ev([dashing, numIs("MagaDir", "=", "1"), I("PosX", ["maga", ">", `kaito.X() + ${DASH.past}`])], endDash));
  add(ev([dashing, numIs("MagaDir", "=", "-1"), I("PosX", ["maga", "<", `kaito.X() - ${DASH.past}`])], endDash));
  add(ev([dashing, timer("Maga", ">", String(DASH.time))], endDash));
  add(ev([dashing, I("PosX", ["maga", "<", "Variable(MagaMin)"])], [I("SetX", ["maga", "=", "Variable(MagaMin)"]), ...endDash]));
  add(ev([dashing, I("PosX", ["maga", ">", "Variable(MagaMax)"])], [I("SetX", ["maga", "=", "Variable(MagaMax)"]), ...endDash]));
  add(ev([following, numIs("MagaHerida", "=", "0")], [anim("idle")]));
  for (const p of ["hechizo", "dragonSombra"]) {
    add(ev([], [I("SetX", [p, "+", `${p}.Variable(Vel) * TimeDelta()`])]));
    add(ev([I("NumberObjectVariable", [p, "Vel", "<", "0"])], [I("FlippableCapability::FlippableBehavior::FlipX", [p, "Flippable", p === "hechizo" ? "yes" : "no"])]));
    add(ev([I("NumberObjectVariable", [p, "Vel", ">", "0"])], [I("FlippableCapability::FlippableBehavior::FlipX", [p, "Flippable", p === "hechizo" ? "no" : "yes"])]));
    add(ev([I("PosX", [p, "<", "kaito.X() - 1400"])], [I("Delete", [p, ""])]));
    add(ev([I("PosX", [p, ">", "kaito.X() + 1400"])], [I("Delete", [p, ""])]));
  }
  // Katana hits: one life each, then she teleports to the other side of Kaito (one action list, so the
  // new side is used right away).
  const facingRight = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"], true);
  const facingLeft = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"]);
  const hit = [setNum("MagaVida", "-", "1"), setNum("MagaHerida", "=", "1"), resetTimer("MagaGolpe"), anim("hurt"),
    setNum("MagaLado", "=", "-Variable(MagaLado)"), I("SetX", ["maga", "=", beside]), setNum("MagaEstado", "=", "1"), resetTimer("Maga")];
  const canBeHit = [awake, alive, numIs("MagaEstado", "!=", "3"), numIs("MagaHerida", "=", "0"), numIs("Atacando", "=", "1"),
    I("Distance", ["maga", "kaito", String(HIT_RANGE), ""])];
  add(ev([...canBeHit, facingRight, I("PosX", ["maga", ">=", "kaito.X() - 10"])], hit));
  add(ev([...canBeHit, facingLeft, I("PosX", ["maga", "<=", "kaito.X() + 10"])], hit));
  // Reflecting: a spell in front of the katana while Kaito attacks flies back, faster and golden; it
  // hurts her like a blow and dissolves any wraith in its way.
  for (const [spellName, back, size] of [["hechizo", "hechizoReflejado", BURST], ["dragonSombra", "dragonReflejado", DRAGON]]) {
    const reflect = [
      I("Create", ["", back, `${spellName}.X()`, `${spellName}.Y()`, ""]),
      I("ResizableCapability::ResizableBehavior::SetWidth", [back, "Resizable", "=", String(size.w)]),
      I("ResizableCapability::ResizableBehavior::SetHeight", [back, "Resizable", "=", String(size.h)]),
      I("SetNumberObjectVariable", [back, "Vel", "=", `-1.5 * ${spellName}.Variable(Vel)`]),
      I("ChangeColor", [back, q("255;215;110")]),
      I("Create", ["", "fxMagia", `${spellName}.X() + ${size.w / 2}`, `${spellName}.Y() + ${size.h / 2}`, ""]),
      I("Delete", [spellName, ""]),
      setNum("Temblor", "=", "max(Variable(Temblor), 5)"),
      ...warn("¡Reflejado!"),
    ];
    const near = [numIs("Atacando", "=", "1"), I("Distance", [spellName, "kaito", String(REFLECT_RANGE), ""])];
    add(ev([...near, facingRight, I("PosX", [spellName, ">=", "kaito.X() - 40"])], reflect));
    add(ev([...near, facingLeft, I("PosX", [spellName, "<=", "kaito.X() + 40"])], reflect));
    add(ev([], [I("SetX", [back, "+", `${back}.Variable(Vel) * TimeDelta()`])]));
    add(ev([I("NumberObjectVariable", [back, "Vel", "<", "0"])], [I("FlippableCapability::FlippableBehavior::FlipX", [back, "Flippable", back === "hechizoReflejado" ? "yes" : "no"])]));
    add(ev([I("NumberObjectVariable", [back, "Vel", ">", "0"])], [I("FlippableCapability::FlippableBehavior::FlipX", [back, "Flippable", back === "hechizoReflejado" ? "no" : "yes"])]));
    add(ev([I("CollisionNP", [back, "maga", "", "", ""]), awake, alive, numIs("MagaEstado", "!=", "3"), numIs("MagaHerida", "=", "0")],
      [I("Delete", [back, ""]), ...hit]));
    add(ev([I("CollisionNP", [back, "fantasma", "", "", ""])], [I("Create", ["", "fxMagia", "fantasma.X() + 65", "fantasma.Y() + 65", ""]), I("Delete", ["fantasma", ""]), I("Delete", [back, ""])]));
    add(ev([I("PosX", [back, "<", "kaito.X() - 1400"])], [I("Delete", [back, ""])]));
    add(ev([I("PosX", [back, ">", "kaito.X() + 1400"])], [I("Delete", [back, ""])]));
  }
  add(ev([numIs("MagaHerida", "=", "1")], [opacity("maga", '100 + 155 * mod(floor(TimerElapsedTime("MagaGolpe") * 10), 2)')]));
  add(ev([numIs("MagaHerida", "=", "1"), timer("MagaGolpe", ">", "0.8")], [setNum("MagaHerida", "=", "0"), opacity("maga", "255")]));
  // Defeat.
  add(ev([numIs("MagaVida", "<=", "0"), alive], [
    setNum("MagaDerrotada", "=", "1"), setNum("MagaEstado", "=", "3"), resetTimer("Maga"),
    ...["hechizo", "dragonSombra", "hechizoReflejado", "dragonReflejado", "fantasma"].map((o) => I("Delete", [o, ""])), I("Cache", ["barraMaga"]), I("Cache", ["TextoMaga"]),
    ...warn("¡Derrotaste a la Maga Oscura!"),
  ]));
  add(ev([numIs("MagaEstado", "=", "3")], [opacity("maga", '255 - TimerElapsedTime("Maga") * 200')]));
  add(ev([numIs("MagaEstado", "=", "3"), timer("Maga", ">", "1.3")], [I("Delete", ["maga", ""])]));
}
