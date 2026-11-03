// Step 09 — Game feel ("juice"), after researching what makes platformers feel good (Celeste's
// forgiveness tricks, Vlambeer's "The Art of Screenshake"): every hit now reads on screen.
// - Screen shake of the level layer (the HUD stays still), proportional to the hit.
// - Hit stop: the scene runs at 8% speed for a few frames when a blow lands (counted in frames, since
//   scene timers slow down with it).
// - Kaito flashes red while invulnerable; the sorceress too while hurt.
// - Particles: sparkle on crystals, sparks on kills, magic smoke where the sorceress is hit and where
//   she reappears, dust when Kaito lands from a jump or a flip.
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";

const PLAYABLE = ["Tutorial", "Nivel1", "Nivel2", "Nivel3"];
// [name, color from, color to, particles, speed min, speed max, life min, life max, gravity y, size, additive]
const EMITTERS = [
  ["fxCristal", "190;110;255", "255;220;255", 24, 160, 340, 0.35, 0.7, 120, 9, false],
  ["fxGolpe", "255;225;110", "255;70;20", 28, 260, 560, 0.25, 0.5, 900, 9, false],
  ["fxMagia", "200;110;255", "60;0;100", 34, 160, 380, 0.4, 0.8, -80, 11, false],
  ["fxPolvo", "215;200;185", "120;105;95", 14, 60, 160, 0.3, 0.6, 180, 11, false],
];

export default function gameFeel({ gd, project }) {
  const { I, NOT, ev, q, numIs, setNum, timer, resetTimer } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const report = [];

  for (const name of PLAYABLE) {
    const layout = project.getLayout(name);
    const objects = layout.getObjects();
    const events = layout.getEvents();
    const { find, findAll } = makeEventFinder(gd, events, `step 09 (${name})`);
    const vars = layout.getVariables();
    for (const v of ["Temblor", "HitStop", "EnAire"]) if (!vars.has(v)) vars.insertNew(v, vars.count());

    for (const [fx, c1, c2, n, f0, f1, l0, l1, gy, size, additive] of EMITTERS) {
      const obj = objects.insertNewObject(project, "ParticleSystem::ParticleEmitter", fx, objects.getObjectsCount());
      const p = gd.asParticleEmitterConfiguration(obj.getConfiguration());
      p.setRendererType(gd.ParticleEmitterObject.Point);
      p.setRendererParam1(size);
      p.setRenderingAdditive(additive);
      p.setMaxParticleNb(n);
      p.setTank(n);
      p.setFlow(1000);                       // the whole tank at once: a burst
      p.setDestroyWhenNoParticles(true);
      p.setEmitterForceMin(f0);
      p.setEmitterForceMax(f1);
      p.setConeSprayAngle(fx === "fxPolvo" ? 150 : 360);
      p.setZoneRadius(fx === "fxPolvo" ? 16 : 6);
      p.setParticleGravityX(0);
      p.setParticleGravityY(gy);
      p.setParticleLifeTimeMin(l0);
      p.setParticleLifeTimeMax(l1);
      p.setParticleColor1(c1);
      p.setParticleColor2(c2);
      p.setParticleAlpha1(fx === "fxPolvo" ? 170 : 255);
      p.setParticleAlpha2(0);
      p.setParticleSize1(100);
      p.setParticleSize2(fx === "fxPolvo" ? 160 : 20);
    }
    const burst = (fx, x, y, angle = 0) => [
      I("Create", ["", fx, x, y, ""]),
      ...(angle ? [I("SetAngle", [fx, "=", String(angle)])] : []),
      I("SetZOrder", [fx, "=", "50"]),
    ];
    const kick = (shake, frames) => [
      setNum("Temblor", "=", `max(Variable(Temblor), ${shake})`),
      ...(frames ? [setNum("HitStop", "=", String(frames)), I("ChangeTimeScale", ["", "0.08"])] : []),
    ];
    const prepend = (event, actions) => actions.slice().reverse().forEach((a) => event.getActions().insert(a, 0));
    const appendAll = (event, actions) => actions.forEach((a) => event.getActions().insert(a, event.getActions().size()));

    // ---- shake and hit stop, run every frame right after the camera follows Kaito ----
    const camera = find((c, a) => has(a, "FixCamera"), "camera");
    events.insertEvent(ev([numIs("Temblor", ">", "0")], [
      I("CameraX", ["", "+", "RandomFloatInRange(-1, 1) * Variable(Temblor)", "", "0"]),
      I("CameraY", ["", "+", "RandomFloatInRange(-1, 1) * Variable(Temblor) * 0.35", "", "0"]),
      setNum("Temblor", "=", "max(0, Variable(Temblor) - 40 * TimeDelta())"),
    ]), camera.index + 1);
    events.insertEvent(ev([numIs("HitStop", ">", "0")], [setNum("HitStop", "-", "1")], [
      ev([numIs("HitStop", "<=", "0")], [I("ChangeTimeScale", ["", "1"])]),
    ]), 0);

    // ---- Kaito gets hurt (spikes, enemies, spells, falls) ----
    const hurts = findAll((c, a) => has(a, "SetNumberVariable", "Vidas", "-"), "damage", 3);
    for (const { event } of hurts) appendAll(event, [...kick(11, 6), I("ChangeColor", ["kaito", q("255;90;90")])]);
    const healed = find((c, a) => has(a, "SetNumberVariable", "Invulnerable", "=", "0"), "invulnerability ends");
    appendAll(healed.event, [I("ChangeColor", ["kaito", q("255;255;255")])]);

    // ---- crystals ----
    const crystal = find((c) => has(c, "CollisionNP", "kaito", "cristal"), "crystal pickup");
    prepend(crystal.event, burst("fxCristal", "cristal.BoundingBoxCenterX()", "cristal.BoundingBoxCenterY()"));

    // ---- landing dust (only after a real jump or flip, not small steps) ----
    const onFloor = I("PlatformBehavior::IsOnFloor", ["kaito", "PlatformerObject"]);
    const landed = ev([onFloor, numIs("EnAire", "=", "1")], [setNum("EnAire", "=", "0")], [
      ev([timer("Suelo", ">", "0.35"), NOT("FlippedY", ["kaito"])], burst("fxPolvo", "kaito.X()", "kaito.Y() + 58", 270)),
      ev([timer("Suelo", ">", "0.35"), I("FlippedY", ["kaito"])], burst("fxPolvo", "kaito.X()", "kaito.Y() - 58", 90)),
    ]);
    events.insertEvent(landed, events.getEventsCount());
    events.insertEvent(ev([onFloor], [resetTimer("Suelo")]), events.getEventsCount());
    events.insertEvent(ev([NOT("PlatformBehavior::IsOnFloor", ["kaito", "PlatformerObject"])], [setNum("EnAire", "=", "1")]), events.getEventsCount());

    let extra = "";
    if (name !== "Tutorial") {
      // ---- enemies cut down (two katana sides + the stomp) ----
      const kills = findAll((c, a) => has(a, "Create", undefined, "cristaldorado"), "enemy kills", 3);
      for (const { event } of kills) prepend(event, [...burst("fxGolpe", "Enemigos.BoundingBoxCenterX()", "Enemigos.BoundingBoxCenterY()"), ...kick(6, 4)]);
      const golden = find((c) => has(c, "CollisionNP", "kaito", "cristaldorado"), "golden crystal");
      prepend(golden.event, burst("fxCristal", "cristaldorado.BoundingBoxCenterX()", "cristaldorado.BoundingBoxCenterY()"));
      extra = ", kills";
    }
    if (name === "Nivel3") {
      // ---- the sorceress: smoke where she is hit and where she reappears ----
      const magaHits = findAll((c, a) => has(a, "SetNumberVariable", "MagaVida", "-"), "boss hits", 4);
      for (const { event } of magaHits) {
        prepend(event, [...burst("fxMagia", "maga.X()", "maga.Y() - 70"), ...kick(8, 5)]);
        appendAll(event, [...burst("fxMagia", "maga.X()", "maga.Y() - 70"), I("ChangeColor", ["maga", q("255;130;130")])]);
      }
      const recovered = find((c, a) => has(a, "SetNumberVariable", "MagaHerida", "=", "0"), "boss recovers");
      appendAll(recovered.event, [I("ChangeColor", ["maga", q("255;255;255")])]);
      const defeat = find((c, a) => has(a, "SetNumberVariable", "MagaDerrotada", "=", "1"), "boss defeated");
      appendAll(defeat.event, [...burst("fxMagia", "maga.X()", "maga.Y() - 70"), ...kick(16, 10)]);
      const dash = find((c, a) => has(a, "SetNumberVariable", "MagaEstado", "=", "4"), "boss dash");
      appendAll(dash.event, kick(3, 0));
      extra += ", sorceress";
    }
    report.push(`${name}: shake, hit stop, red flash, crystals, dust${extra}`);
  }
  return report.join("; ");
}
