// Step 16 — Kaito's moves read apart.
// - Jump and gravity flip had the same look (the flip used the jump's falling frame). The jump now
//   crouches, pushes off and tucks (jump_4..6); the flip is its own spin with a violet aura (flip_0..3,
//   drawn by tools/gdevelop/assets/make-flip.mjs), both going up and coming back down.
// - Attacking while running is a dash: the same attack frames, but Kaito shoots forward for 0.22 s at
//   950 px/s leaving violet afterimages, with a puff of dust and a small shake.
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";
import { ensureImageResource, insertObjectFrom, serializeObject } from "../../lib/objects.mjs";
import { KAITO_MASK } from "./03-physics-and-gravity-rules.mjs";

const PLAYABLE = ["Tutorial", "Nivel1", "Nivel2", "Nivel3"];
const DASH = { speed: 950, time: 0.22, every: 3 };   // afterimage every 3 frames

export default function kaitoMoves({ gd, project }) {
  const { I, NOT, ev, q, setNum, numIs, timer, resetTimer } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const P = ["kaito", "PlatformerObject"];
  const frame = (file) => {
    const sp = new gd.Sprite();
    sp.setImageName(ensureImageResource(gd, project, file));
    sp.getOrigin().setXY(64, 64);
    sp.setFullImageCollisionMask(false);
    const polys = new gd.VectorPolygon2d(), poly = new gd.Polygon2d();
    for (const [x, y] of KAITO_MASK) { const v = new gd.Vector2f(); v.set_x(x); v.set_y(y); poly.getVertices().push_back(v); }
    polys.push_back(poly);
    sp.setCustomCollisionMask(polys);
    return sp;
  };
  const fillDirection = (dir, files, speed, loop) => {
    dir.removeAllSprites();
    dir.setTimeBetweenFrames(speed);
    dir.setLoop(loop);
    for (const f of files) dir.addSprite(frame(f));
  };

  for (const name of PLAYABLE) {
    const layout = project.getLayout(name);
    const objects = layout.getObjects();
    const events = layout.getEvents();
    const { find } = makeEventFinder(gd, events, `step 16 (${name})`);
    const vars = layout.getVariables();
    for (const v of ["Girando", "DashAtaque", "EstelaCuadros"]) if (!vars.has(v)) vars.insertNew(v, vars.count());

    // ---- animations ----
    const anims = gd.asSpriteConfiguration(objects.getObject("kaito").getConfiguration()).getAnimations();
    let jump = null;
    for (let i = 0; i < anims.getAnimationsCount(); i++) if (anims.getAnimation(i).getName() === "jump") jump = anims.getAnimation(i);
    if (!jump) throw new Error(`step 16 (${name}): no jump animation`);
    fillDirection(jump.getDirection(0), [4, 5, 6].map((i) => `assets/kaito/jump_${i}.png`), 0.08, false);
    const flip = new gd.Animation();
    flip.setName("flip");
    flip.setDirectionsCount(1);
    fillDirection(flip.getDirection(0), [0, 1, 2, 3].map((i) => `assets/kaito/flip_${i}.png`), 0.06, true);
    anims.addAnimation(flip);

    // Going up: the event that showed "fall" while flipped and not yet on the ceiling.
    const upward = find((c, a) => has(c, "FlippedY", "kaito") && has(c, "CollisionNP", "kaito", "techo") && has(a, "SetStringVariable", "Anim"), "flipped fall animation");
    const acts = upward.event.getActions();
    for (let i = 0; i < acts.size(); i++) if (acts.get(i).getType() === "SetStringVariable") acts.get(i).setParameter(2, q("flip"));
    // Coming down: from the drop until Kaito touches the floor again.
    const drop = find((c, a) => has(c, "NumberVariable", "Bajar", "=", "1") && has(a, "FlipGravity::Reset"), "drop");
    drop.event.getActions().insert(setNum("Girando", "=", "1"), drop.event.getActions().size());
    events.insertEvent(ev([NOT("FlippedY", ["kaito"]), numIs("Girando", "=", "1"), NOT("PlatformBehavior::IsOnFloor", P)],
      [I("SetStringVariable", ["Anim", "=", q("flip")])]), upward.index + 1);
    events.insertEvent(ev([I("PlatformBehavior::IsOnFloor", P)], [setNum("Girando", "=", "0")]), upward.index + 1);

    // ---- dash attack ----
    const estela = insertObjectFrom(gd, project, objects, "estela", serializeObject(gd, objects.getObject("kaito")));
    // An afterimage is a picture of Kaito, not a second platformer character: drop every behavior but the
    // built-in capabilities (opacity, flip, animation...).
    const names = estela.getAllBehaviorNames(), physical = [];
    for (let i = 0; i < names.size(); i++) if (!/Capability::/.test(estela.getBehavior(names.at(i)).getTypeName())) physical.push(names.at(i));
    for (const b of physical) estela.removeBehavior(b);
    const attack = find((c, a) => has(c, "KeyFromTextJustPressed", undefined, '"f"') && has(a, "SetNumberVariable", "Atacando", "=", "1"), "attack key");
    attack.event.getSubEvents().insertEvent(ev([numIs("Corriendo", "=", "1"), NOT("FlippedY", ["kaito"])], [
      setNum("DashAtaque", "=", "1"), resetTimer("Dash"), setNum("EstelaCuadros", "=", "0"),
      I("Create", ["", "fxPolvo", "kaito.X()", "kaito.Y() + 58", ""]), I("SetZOrder", ["fxPolvo", "=", "50"]),
      setNum("Temblor", "=", "max(Variable(Temblor), 3)"),
    ]), 0);
    const add = (e) => events.insertEvent(e, events.getEventsCount());
    const dashing = numIs("DashAtaque", "=", "1");
    const facingLeft = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"]);
    const facingRight = I("FlippableCapability::FlippableBehavior::FlippedX", ["kaito", "Flippable"], true);
    // After the walk/run events (they set the max speed every frame), so the dash wins.
    add(ev([dashing, facingRight], [I("PlatformBehavior::MaxSpeed", [...P, "=", String(DASH.speed)]),
      I("PlatformBehavior::PlatformerObjectBehavior::SetCurrentSpeed", [...P, "=", String(DASH.speed)]), I("PlatformBehavior::SimulateRightKey", P)]));
    add(ev([dashing, facingLeft], [I("PlatformBehavior::MaxSpeed", [...P, "=", String(DASH.speed)]),
      I("PlatformBehavior::PlatformerObjectBehavior::SetCurrentSpeed", [...P, "=", String(-DASH.speed)]), I("PlatformBehavior::SimulateLeftKey", P)]));
    add(ev([dashing], [setNum("EstelaCuadros", "+", "1")], [
      ev([I("BuiltinCommonInstructions::CompareNumbers", [`mod(Variable(EstelaCuadros), ${DASH.every})`, "=", "0"])], [
        I("Create", ["", "estela", "kaito.X()", "kaito.Y()", ""]),
        I("AnimatableCapability::AnimatableBehavior::SetName", ["estela", "Animation", "=", q("attack")]),
        I("ChangeColor", ["estela", q("170;130;255")]),
        I("OpacityCapability::OpacityBehavior::SetValue", ["estela", "Opacity", "=", "170"]),
        I("SetZOrder", ["estela", "=", "kaito.ZOrder() - 1"]),
      ], [
        ev([facingLeft], [I("FlippableCapability::FlippableBehavior::FlipX", ["estela", "Flippable", "yes"])]),
      ]),
    ]));
    add(ev([dashing, timer("Dash", ">", String(DASH.time))], [setNum("DashAtaque", "=", "0"), I("PlatformBehavior::MaxSpeed", [...P, "=", "450"])]));
    add(ev([], [I("OpacityCapability::OpacityBehavior::SetValue", ["estela", "Opacity", "-", "700 * TimeDelta()"])]));
    add(ev([I("OpacityCapability::OpacityBehavior::Value", ["estela", "Opacity", "<=", "5"])], [I("Delete", ["estela", ""])]));
  }
  return `${PLAYABLE.join(", ")}: jump crouch-push-tuck, flip spin with aura, dash attack while running (${DASH.speed} px/s, ${DASH.time} s, afterimages)`;
}
