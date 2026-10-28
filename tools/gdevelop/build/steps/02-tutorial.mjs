// Step 02 — Tutorial: 6400 px level with camera, text hints along the path, gems, checkpoints,
// lives with respawn, death animation, double-tap run, attack and Kaito's animations.
import { existsSync } from "node:fs";
import { makeEventHelpers, makeLayoutHelpers } from "../../lib/events.mjs";

// ======================= LEVEL DATA =======================
const TILE = 1280;
const TILES = 5;
const LEVEL_W = TILE * TILES;          // 6400
const FLOOR_Y = 525;                    // piso instance y (collider line at +31)
const CEIL_Y = 248;                     // techo instance y (collider line at +31)
const KAITO_FLOOR_Y = 496;              // kaito origin y when standing on floor

// Background roofs double as ceilings (original tile vs mirrored tile).
const roofsFor = (i) => {
  const x = i * TILE;
  return i % 2 === 0 ? [[x + 5, 496], [x + 939, 338]] : [[x + 3, 338], [x + 779, 496]];
};
// Gaps between roofs filled with a visible floating ceiling (pisoflotante + techo collider).
const ceilingFillers = [[3061, 438], [4181, 438]];

const smallBlocks = [[1450, 468]];                         // piso 73x64 steps
const floorSpikes = [1700, 1900, 2750, 2900, 3050, 3200, 3950, 4100, 4850, 5000];
const hangingSpikes = [4420];
const floorGems = [650, 720, 790, 860, 930, 1000, 1070, 4450, 4550, 5400, 5500, 5600];
const ceilingGems = [2800, 2900, 3000, 3100, 3200, 3300, 4000, 4150, 4900, 5050];
const airGems = [[1775, 380], [1975, 380]];
const portal = [6050, 367];
const checkpoints = [1320, 2600, 3870, 5160];

// Tutorial hints: add new ones here, they appear along the path.
const HINT_Y = 110;
const hints = [
  [60,   "← →  CAMINAR"],
  [430,  "Doble toque ← ← / → →\npara CORRER"],
  [800,  "Juntá CRISTALES\npara recargar energía"],
  [1330, "ESPACIO para SALTAR"],
  [1640, "¡Cuidado con los PINCHOS!"],
  [2580, "ALT invierte la GRAVEDAD\n(solo bajo un techo, gasta energía)"],
  [3380, "ALT otra vez para BAJAR"],
  [3880, "Alterná techo y piso\npara esquivar los pinchos"],
  [5200, "F para ATACAR con la katana"],
  [5750, "¡Llegá al PORTAL!"],
];

// Kaito animations (frames in assets/kaito/<name>_<i>.png, 128x128).
const ANIMS = [
  ["idle",    "idle",    [0,1,2,3,4,5,6,7], 0.14, true],
  ["walk",    "walk",    [0,1,2,3,4,5,6,7], 0.09, true],
  ["run",     "run",     [0,1,2,3,4,5,6,7], 0.06, true],
  ["jump",    "jump",    [5,6],             0.12, false],
  ["fall",    "jump",    [7],               0.10, true],
  ["wounded", "wounded", [0,1],             0.10, true],
  ["death",   "death",   [0,1,2,3,4,5,6,7], 0.12, false],
  ["attack",  "attack",  [0,1,2,3,4,5,6,7,8,9], 0.045, false],
];
const KAITO_MASK = [[28,4],[113,4],[113,124],[28,124]];
const WALK_SPEED = 250, RUN_SPEED = 450, DOUBLE_TAP = 0.3;

// ======================= STEP =======================
export default function tutorial({ gd, project, gameDir: DIR }) {
  const t = project.getLayout("Tutorial");
  const objects = t.getObjects();
  const instances = t.getInitialInstances();
  const { I, NOT, ev, jsEvent, q, setNum, numIs, setStr, coll, key, keyJust, timer, resetTimer } = makeEventHelpers(gd);
  const { allInstances, addInst } = makeLayoutHelpers(gd, t);

  // ======================= 1. KAITO ANIMATIONS =======================
  const rm = project.getResourcesManager();
  function ensureImage(path) {
    if (!existsSync(`${DIR}/${path}`)) throw new Error("missing frame " + path);
    if (rm.hasResource(path)) return path;
    const r = new gd.ImageResource();
    r.setName(path); r.setFile(path); r.setSmooth(false);
    rm.addResource(r);
    return path;
  }
  const kaito = gd.asSpriteConfiguration(objects.getObject("kaito").getConfiguration());
  const animList = kaito.getAnimations();
  animList.removeAllAnimations();
  animList.setAdaptCollisionMaskAutomatically(false);
  for (const [name, sheet, frames, speed, loop] of ANIMS) {
    const anim = new gd.Animation();
    anim.setName(name);
    anim.setDirectionsCount(1);
    const dir = anim.getDirection(0);
    dir.setLoop(loop);
    dir.setTimeBetweenFrames(speed);
    for (const f of frames) {
      const sp = new gd.Sprite();
      sp.setImageName(ensureImage(`assets/kaito/${sheet}_${f}.png`));
      sp.getOrigin().setXY(64, 64);
      sp.setFullImageCollisionMask(false);
      const polys = new gd.VectorPolygon2d();
      const poly = new gd.Polygon2d();
      for (const [x, y] of KAITO_MASK) { const v = new gd.Vector2f(); v.set_x(x); v.set_y(y); poly.getVertices().push_back(v); }
      polys.push_back(poly);
      sp.setCustomCollisionMask(polys);
      dir.addSprite(sp);
    }
    animList.addAnimation(anim);
  }

  // ======================= 2. TEXT OBJECTS (hints + HUD) =======================
  const template = new gd.SerializerElement();
  objects.getObject("InstruccionGravedad").serializeTo(template);
  function makeText(name, text, size) {
    if (objects.hasObjectNamed(name)) objects.removeObject(name);
    const obj = objects.insertNewObject(project, "TextObject::Text", name, objects.getObjectsCount());
    obj.unserializeFrom(project, template);
    obj.setName(name);
    const el = new gd.SerializerElement();
    obj.serializeTo(el);
    const c = el.getChild("content");
    el.getChild("string").setStringValue(text);
    c.getChild("text").setStringValue(text);
    el.getChild("characterSize").setIntValue(size);
    c.getChild("characterSize").setIntValue(size);
    c.getChild("color").setStringValue("255;255;255");
    c.getChild("outlineColor").setStringValue("20;12;30");
    c.getChild("outlineThickness").setIntValue(4);
    c.getChild("isOutlineEnabled").setBoolValue(true);
    c.getChild("isShadowEnabled").setBoolValue(true);
    c.getChild("textAlignment").setStringValue("left");
    obj.unserializeFrom(project, el);
    obj.setName(name);
  }
  hints.forEach(([, text], i) => makeText(`Hint${i + 1}`, text, 26));
  makeText("TextoGemas", "Cristales: 0", 26);

  // ======================= 3. LEVEL GEOMETRY =======================
  for (const n of ["fondo", "piso", "techo", "pinchos", "cristal", "pisoflotante", "roca", "puerta",
    "indicacion1", "indicacion2", "indicacion3", "Indicacion4", "indicacion5"]) {
    instances.removeInitialInstancesOfObject(n);
  }
  for (const inst of allInstances()) if (inst.getObjectName() === "kaito") { inst.setX(100); inst.setY(KAITO_FLOOR_Y); inst.setZOrder(20); }

  for (let i = 0; i < TILES; i++) {
    addInst("fondo", i * TILE, 0, TILE, 719, { z: -10, flipX: i % 2 === 1 });
    addInst("piso", i * TILE, FLOOR_Y, TILE, 64, { z: 0 });
    for (const [x, w] of roofsFor(i)) addInst("techo", x, CEIL_Y, w, 64, { z: 0 });
  }
  for (const [x, w] of ceilingFillers) {
    addInst("pisoflotante", x - 16, CEIL_Y - 54, w + 32, 133, { z: 1 });
    addInst("techo", x, CEIL_Y, w, 64, { z: 0 });
  }
  for (const [x, y] of smallBlocks) addInst("piso", x, y, 73, 64, { z: 1 });
  for (const x of floorSpikes) addInst("pinchos", x, 509, 150, 50, { z: 2 });
  for (const x of hangingSpikes) addInst("pinchos", x, CEIL_Y + 31, 150, 50, { z: 2, flipY: true });
  for (const x of floorGems) addInst("cristal", x, 480, 49, 52, { z: 3 });
  for (const x of ceilingGems) addInst("cristal", x, 330, 49, 52, { z: 3 });
  for (const [x, y] of airGems) addInst("cristal", x, y, 49, 52, { z: 3 });
  addInst("puerta", portal[0], portal[1], 300, 200, { z: 1 });
  hints.forEach(([x], i) => addInst(`Hint${i + 1}`, x, HINT_Y, 0, 0, { z: 5 }));
  addInst("TextoGemas", 440, 34, 0, 0, { layer: "HUD", z: 5 });

  // ======================= 4. SCENE VARIABLES =======================
  const vars = t.getVariables();
  const numVars = { Bajar: 0, Gemas: 0, TotalGemas: 0, Herido: 0, Muerto: 0, Atacando: 0, Corriendo: 0, CheckX: 100, CheckY: KAITO_FLOOR_Y };
  for (const [n, v] of Object.entries(numVars)) { if (!vars.has(n)) vars.insertNew(n, vars.count()); vars.get(n).setValue(v); }
  if (!vars.has("Anim")) vars.insertNew("Anim", vars.count());
  vars.get("Anim").setString("idle");

  // ======================= 5. EVENTS =======================
  const events = t.getEvents();
  // Drop the old anim/facing (5,6,7), spike (15), instant game over (16) and broken gem events (17,18).
  for (const i of [18, 17, 16, 15, 7, 6, 5]) events.removeEventAt(i);
  // Neutralize the extension's own animation switching (index 99 = no-op) so it doesn't reset ours every frame.
  const flipCall = gd.asStandardEvent(events.getEventAt(3)).getActions().get(0);
  if (flipCall.getType() !== "FlipGravity::FlipGravity2Objects") throw new Error("unexpected event #3: " + flipCall.getType());
  [9, 10, 11].forEach((p) => flipCall.setParameter(p, "99"));

  // The extension flips up with ALT but never flips back with the same key: detect "ALT while inverted"
  // before it runs, then reset gravity after it, blocking a re-flip until the key is released.
  events.insertEvent(ev([keyJust("LAlt"), I("FlippedY", ["kaito"])], [setNum("Bajar", "=", "1")]), 3);
  events.insertEvent(ev([numIs("Bajar", "=", "1")], [I("FlipGravity::Reset", ["", "kaito", "PlatformerObject", ""])]), 5);
  events.insertEvent(ev([numIs("Bajar", "=", "1")], [
    I("SetObjectVariableAsBoolean", ["kaito", "__FlipGravityExtension.FlippingTrigger", "True"]),
    setNum("EnTecho", "=", "0"),
    setNum("Bajar", "=", "0"),
  ]), 6);

  const add = (e) => events.insertEvent(e, events.getEventsCount());

  // Keep Chrome from stealing keyboard focus when ALT is pressed.
  add(jsEvent([
    "if (!window.__gravityAltFix) {",
    "  window.__gravityAltFix = true;",
    "  const block = (e) => { if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); };",
    "  window.addEventListener('keydown', block, true);",
    "  window.addEventListener('keyup', block, true);",
    "}",
  ]));

  add(ev([I("SceneJustBegins", [""])], [setNum("TotalGemas", "=", "Count(cristal)"), resetTimer("Golpe")]));
  add(ev([], [
    I("FixCamera", ["", "kaito", "0", "0", LEVEL_W, "720", "", "", ""]),
    I("ResizableCapability::ResizableBehavior::SetWidth", ["energiadebarra", "Resizable", "=", "Variable(EnergiaGravedad) * 1.58"]),
    I("TextContainerCapability::TextContainerBehavior::SetValue", ["TextoGemas", "Text", "=",
      '"Cristales: " + ToString(Variable(Gemas)) + " / " + ToString(Variable(TotalGemas))']),
  ]));

  // Gems
  add(ev([coll("kaito", "cristal"), numIs("Muerto", "=", "0")], [
    setNum("Gemas", "+", "Count(cristal)"),
    setNum("EnergiaGravedad", "+", "10 * Count(cristal)"),
    I("Delete", ["cristal", ""]),
  ]));
  add(ev([numIs("EnergiaGravedad", ">", "100")], [setNum("EnergiaGravedad", "=", "100")]));

  // Checkpoints
  for (const cx of checkpoints) {
    add(ev([I("PosX", ["kaito", ">", cx - 20]), numIs("CheckX", "<", cx)], [setNum("CheckX", "=", cx), setNum("CheckY", "=", KAITO_FLOOR_Y)]));
  }

  // Damage: spikes and falling out of the level -> lose a life, respawn at checkpoint.
  const respawn = () => ev([numIs("Vidas", ">", "0")], [
    I("FlipGravity::Reset", ["", "kaito", "PlatformerObject", ""]),
    I("SetXY", ["kaito", "=", "Variable(CheckX)", "=", "Variable(CheckY)"]),
    I("PlatformBehavior::PlatformerObjectBehavior::SetCurrentSpeed", ["kaito", "PlatformerObject", "=", "0"]),
    I("PlatformBehavior::PlatformerObjectBehavior::SetCurrentFallSpeed", ["kaito", "PlatformerObject", "=", "0"]),
    setNum("EnTecho", "=", "0"),
  ]);
  const hit = () => [setNum("Vidas", "-", "1"), resetTimer("Golpe"), setNum("Herido", "=", "1")];
  const canBeHit = () => [timer("Golpe", ">", "1"), numIs("Muerto", "=", "0")];
  add(ev([coll("kaito", "pinchos"), ...canBeHit()], hit(), [respawn()]));
  add(ev([I("PosY", ["kaito", ">", "760"]), ...canBeHit()], hit(), [respawn()]));
  add(ev([I("PosY", ["kaito", "<", "-150"]), ...canBeHit()], hit(), [respawn()]));
  add(ev([numIs("Herido", "=", "1"), timer("Golpe", ">", "0.6")], [setNum("Herido", "=", "0")]));

  // Death -> death animation -> Game Over
  add(ev([numIs("Vidas", "<=", "0"), numIs("Muerto", "=", "0")], [
    setNum("Muerto", "=", "1"), resetTimer("Muerte"),
    I("PlatformBehavior::IgnoreDefaultControls", ["kaito", "PlatformerObject", "yes"]),
  ]));
  add(ev([numIs("Muerto", "=", "1")], [I("PlatformBehavior::PlatformerObjectBehavior::SetCurrentSpeed", ["kaito", "PlatformerObject", "=", "0"])]));
  add(ev([numIs("Muerto", "=", "1"), timer("Muerte", ">", "1.5")], [I("Scene", ["", q("GameOver"), ""])]));

  // Portal -> Nivel1
  add(ev([coll("kaito", "puerta"), numIs("Muerto", "=", "0")], [I("Scene", ["", q("Nivel1"), ""])]));

  // Facing + walk / double-tap run
  add(ev([key("Right"), numIs("Muerto", "=", "0")], [I("FlippableCapability::FlippableBehavior::FlipX", ["kaito", "Flippable", ""])]));
  add(ev([key("Left"), numIs("Muerto", "=", "0")], [I("FlippableCapability::FlippableBehavior::FlipX", ["kaito", "Flippable", "yes"])]));
  for (const [k, tmr] of [["Right", "TapDer"], ["Left", "TapIzq"]]) {
    add(ev([keyJust(k)], [], [
      ev([timer(tmr, "<", DOUBLE_TAP)], [setNum("Corriendo", "=", "1")]),
      ev([], [resetTimer(tmr)]),
    ]));
  }
  add(ev([NOT("KeyFromTextPressed", ["", q("Right")]), NOT("KeyFromTextPressed", ["", q("Left")])], [setNum("Corriendo", "=", "0")]));
  add(ev([numIs("Corriendo", "=", "1")], [I("PlatformBehavior::MaxSpeed", ["kaito", "PlatformerObject", "=", RUN_SPEED])]));
  add(ev([numIs("Corriendo", "=", "0")], [I("PlatformBehavior::MaxSpeed", ["kaito", "PlatformerObject", "=", WALK_SPEED])]));

  // Attack (F)
  add(ev([keyJust("f"), numIs("Muerto", "=", "0"), numIs("Atacando", "=", "0")], [setNum("Atacando", "=", "1")]));
  add(ev([numIs("Atacando", "=", "1"),
    I("AnimatableCapability::AnimatableBehavior::Name", ["kaito", "Animation", "=", q("attack")]),
    I("AnimatableCapability::AnimatableBehavior::HasAnimationEnded", ["kaito", "Animation"])], [setNum("Atacando", "=", "0")]));

  // Animation state machine: compute the name, then set it once per frame.
  add(ev([], [setStr("Anim", "idle")]));
  add(ev([key("Right")], [setStr("Anim", "walk")]));
  add(ev([key("Left")], [setStr("Anim", "walk")]));
  add(ev([numIs("Corriendo", "=", "1")], [setStr("Anim", "run")]));
  add(ev([NOT("FlippedY", ["kaito"]), I("PlatformBehavior::IsJumping", ["kaito", "PlatformerObject"])], [setStr("Anim", "jump")]));
  add(ev([NOT("FlippedY", ["kaito"]), I("PlatformBehavior::IsFalling", ["kaito", "PlatformerObject"])], [setStr("Anim", "fall")]));
  add(ev([I("FlippedY", ["kaito"]), NOT("CollisionNP", ["kaito", "techo", "", "", ""])], [setStr("Anim", "fall")]));
  add(ev([numIs("Herido", "=", "1")], [setStr("Anim", "wounded")]));
  add(ev([numIs("Atacando", "=", "1")], [setStr("Anim", "attack")]));
  add(ev([numIs("Muerto", "=", "1")], [setStr("Anim", "death")]));
  add(ev([], [I("AnimatableCapability::AnimatableBehavior::SetName", ["kaito", "Animation", "=", "VariableString(Anim)"])]));

  return `Tutorial: ${events.getEventsCount()} events, ${LEVEL_W} px, ${hints.length} hints`;
}
