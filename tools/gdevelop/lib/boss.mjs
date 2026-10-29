// The sorceress, final boss of the last level. She sleeps at the far side of the arena until Kaito walks
// in, then alternates two spells: an energy burst along the floor (jump it or flip up) and a smoke dragon
// along the ceiling (drop down). Each katana hit takes one of her lives and she teleports to the other side;
// at half life she casts faster. Defeating her opens the portal. Frames: tools/gdevelop/assets/slice-maga.mjs.
import { makeEventHelpers } from "./events.mjs";
import { setAnimations, ensureImageResource, serializeObject, insertObjectFrom, declareObjectNumbers, cloneTextObject } from "./objects.mjs";

export const BOSS_LIVES = 12;
const SCALE = 1.15;                         // frames are 400x230, body centered at x=200 with the feet at y=222
const FRAME = (i) => `assets/maga/maga_${i}.png`;
const BURST = { w: 64, h: 90 }, DRAGON = { w: 48, h: 118 };

export function addBoss({ gd, project }, level, { floorLine: F, ceilingLine: C, arena }) {
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
    { name: "hurt", images: [img(FRAME(0))], speed: 0.2, loop: false },
  ], { origin: [200, 222], mask: [[172, 60], [228, 60], [228, 222], [172, 222]] });
  for (const [name, file] of [["hechizo", "assets/maga/hechizo.png"], ["dragonSombra", "assets/maga/dragon.png"]]) {
    const o = objects.insertNewObject(project, "Sprite", name, objects.getObjectsCount());
    setAnimations(gd, o, [{ name: "", images: [img(file)] }]);
    declareObjectNumbers(o, ["Vel"]);
  }
  const peligro = objects.getObjectGroups().get("Peligro");
  for (const n of ["maga", "hechizo", "dragonSombra"]) peligro.addObject(n);
  insertObjectFrom(gd, project, objects, "barraMaga", serializeObject(gd, objects.getObject("energiadebarra")));
  cloneTextObject(gd, project, objects, "TextoGemas", "TextoMaga", { text: "MAGA", size: 26, color: "220;180;255" });

  // ---- instances ----
  const instances = level.getInitialInstances();
  const place = (name, x, y, w, h, layer = "") => {
    const inst = instances.insertNewInitialInstance();
    inst.setObjectName(name); inst.setX(x); inst.setY(y); inst.setLayer(layer); inst.setZOrder(4);
    if (w) { inst.setHasCustomSize(true); inst.setCustomWidth(w); inst.setCustomHeight(h); }
  };
  const RIGHT = arena.x1 - 260, LEFT = arena.x0 + 260;
  place("maga", RIGHT, F, Math.round(400 * SCALE), Math.round(230 * SCALE));
  place("TextoMaga", 820, 34, 0, 0, "HUD");
  place("barraMaga", 930, 5, BOSS_LIVES * 25, 85, "HUD");   // the bar image is the red band of an 85 px tall frame

  // ---- variables ----
  const vars = level.getVariables();
  for (const [n, v] of [["MagaVida", BOSS_LIVES], ["MagaEstado", 0], ["MagaAtaque", 0], ["MagaDerrotada", 0], ["MagaLado", 1], ["MagaHerida", 0]]) {
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
  add(ev([I("SceneJustBegins", [""])], [I("Cache", ["TextoMaga"]), I("Cache", ["barraMaga"]), anim("idle")]));
  // Wakes up when Kaito enters the arena.
  add(ev([numIs("MagaEstado", "=", "0"), I("PosX", ["kaito", ">", arena.x0 + 120])], [
    setNum("MagaEstado", "=", "1"), resetTimer("Maga"), I("Montre", ["TextoMaga", ""]), I("Montre", ["barraMaga", ""]),
    ...warn("¡La Maga del Templo! Esquivá sus hechizos y atacala con F"),
  ]));
  add(ev([awake], [I("ResizableCapability::ResizableBehavior::SetWidth", ["barraMaga", "Resizable", "=", "Variable(MagaVida) * 25"])]));
  add(ev([awake, I("PosX", ["maga", ">", "kaito.X()"])], [I("FlippableCapability::FlippableBehavior::FlipX", ["maga", "Flippable", "yes"])]));
  add(ev([awake, I("PosX", ["maga", "<=", "kaito.X()"])], [I("FlippableCapability::FlippableBehavior::FlipX", ["maga", "Flippable", "no"])]));
  // Waiting -> chooses a spell (faster at half life).
  const choose = [setNum("MagaAtaque", "=", "RandomInRange(1, 2)"), setNum("MagaEstado", "=", "2"), resetTimer("Maga")];
  add(ev([numIs("MagaEstado", "=", "1"), numIs("MagaVida", ">", BOSS_LIVES / 2), timer("Maga", ">", "1.6")], choose));
  add(ev([numIs("MagaEstado", "=", "1"), numIs("MagaVida", "<=", BOSS_LIVES / 2), timer("Maga", ">", "1")], choose));
  add(ev([numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", "1")], [anim("cast")]));
  add(ev([numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", "2")], [anim("summon")]));
  // Casting -> the spell leaves towards Kaito.
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
  add(ev([numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", "1"), timer("Maga", ">", "0.55")],
    [...spell("hechizo", BURST, F - BURST.h - 4), ...release], towardsKaito("hechizo", 430)));
  add(ev([numIs("MagaEstado", "=", "2"), numIs("MagaAtaque", "=", "2"), timer("Maga", ">", "0.55")],
    [...spell("dragonSombra", DRAGON, C - 8), ...release], towardsKaito("dragonSombra", 360)));
  add(ev([numIs("MagaEstado", "=", "1"), numIs("MagaHerida", "=", "0")], [anim("idle")]));
  for (const p of ["hechizo", "dragonSombra"]) {
    add(ev([], [I("SetX", [p, "+", `${p}.Variable(Vel) * TimeDelta()`])]));
    add(ev([I("NumberObjectVariable", [p, "Vel", "<", "0"])], [I("FlippableCapability::FlippableBehavior::FlipX", [p, "Flippable", p === "hechizo" ? "yes" : "no"])]));
    add(ev([I("NumberObjectVariable", [p, "Vel", ">", "0"])], [I("FlippableCapability::FlippableBehavior::FlipX", [p, "Flippable", p === "hechizo" ? "no" : "yes"])]));
    add(ev([I("PosX", [p, "<", arena.x0 - 200])], [I("Delete", [p, ""])]));
    add(ev([I("PosX", [p, ">", arena.x1 + 200])], [I("Delete", [p, ""])]));
  }
  // Katana hits: one life each, then she teleports to the other side of the arena.
  const facingRight = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"], true);
  const facingLeft = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"]);
  const hit = [setNum("MagaVida", "-", "1"), setNum("MagaHerida", "=", "1"), resetTimer("MagaGolpe"), anim("hurt")];
  // One action, mirrored around the arena: two "if left / if right" sub-events would both run in the same frame.
  const teleport = [I("SetX", ["maga", "=", `${LEFT + RIGHT} - maga.X()`]), setNum("MagaLado", "=", "-Variable(MagaLado)")];
  const canBeHit = [awake, numIs("MagaDerrotada", "=", "0"), numIs("MagaHerida", "=", "0"), numIs("Atacando", "=", "1"), I("Distance", ["maga", "kaito", "190", ""])];
  add(ev([...canBeHit, facingRight, I("PosX", ["maga", ">=", "kaito.X() - 10"])], [...hit, ...teleport]));
  add(ev([...canBeHit, facingLeft, I("PosX", ["maga", "<=", "kaito.X() + 10"])], [...hit, ...teleport]));
  add(ev([numIs("MagaHerida", "=", "1")], [opacity("maga", '100 + 155 * mod(floor(TimerElapsedTime("MagaGolpe") * 10), 2)')]));
  add(ev([numIs("MagaHerida", "=", "1"), timer("MagaGolpe", ">", "0.8")], [setNum("MagaHerida", "=", "0"), opacity("maga", "255")]));
  // Defeat.
  add(ev([numIs("MagaVida", "<=", "0"), numIs("MagaDerrotada", "=", "0")], [
    setNum("MagaDerrotada", "=", "1"), setNum("MagaEstado", "=", "3"), resetTimer("Maga"),
    I("Delete", ["hechizo", ""]), I("Delete", ["dragonSombra", ""]), I("Cache", ["barraMaga"]), I("Cache", ["TextoMaga"]),
    ...warn("¡Derrotaste a la Maga!"),
  ]));
  add(ev([numIs("MagaEstado", "=", "3")], [opacity("maga", '255 - TimerElapsedTime("Maga") * 200')]));
  add(ev([numIs("MagaEstado", "=", "3"), timer("Maga", ">", "1.3")], [I("Delete", ["maga", ""])]));
}
