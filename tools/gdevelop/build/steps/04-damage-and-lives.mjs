// Step 04 — Damage and lives (playtest: being sent back to the last checkpoint on every spike made the
// tutorial impossible to finish). A hit costs a life where Kaito is: he bounces off the spikes and blinks,
// invulnerable, for INVULNERABLE seconds; only falling out of the level respawns. Lives heal back one by
// one after HEAL_EVERY seconds without damage, and the HUD hearts finally follow the lives.
import { makeEventHelpers, makeEventFinder } from "../../lib/events.mjs";

export const INVULNERABLE = 1.5;     // seconds without taking damage after a hit
export const HEAL_EVERY = 4;         // seconds without damage to get one life back
const MAX_LIVES = 3;
const HEART_X0 = 300, HEART_STEP = 41; // HUD hearts at x = 315, 355, 396

export default function damageAndLives({ gd, project }) {
  const t = project.getLayout("Tutorial");
  const events = t.getEvents();
  const { I, NOT, ev, q, setNum, numIs, timer, resetTimer } = makeEventHelpers(gd);
  const { find, findAll } = makeEventFinder(gd, events, "step 04");

  const vars = t.getVariables();
  if (!vars.has("Invulnerable")) vars.insertNew("Invulnerable", vars.count());
  vars.get("Invulnerable").setValue(0);
  if (vars.get("Vidas").getValue() !== MAX_LIVES) throw new Error(`step 04: Vidas starts at ${vars.get("Vidas").getValue()}, expected ${MAX_LIVES}`);

  // Every damage event (spikes, falling below or above the level) shares the same invulnerability window
  // and restarts the healing countdown.
  const isGolpeGuard = (x) => x.type === "CompareTimer" && x.params[1] === '"Golpe"' && x.params[2] === ">";
  const damage = findAll((c, a) => c.some(isGolpeGuard) && a.some((x) => x.params[0] === "Vidas"), "damage", 3);
  for (const { event } of damage) {
    const conds = event.getConditions();
    for (let i = 0; i < conds.size(); i++) {
      const c = conds.get(i);
      if (c.getType() === "CompareTimer" && c.getParameter(1).getPlainString() === '"Golpe"') c.setParameter(3, String(INVULNERABLE));
    }
    event.getActions().push_back(setNum("Invulnerable", "=", "1"));
    event.getActions().push_back(resetTimer("Curacion"));
  }

  // Spikes: no more respawn, bounce away from them instead (up from the floor, down from the ceiling).
  const spikes = find((c) => c.some((x) => x.type === "CollisionNP" && x.params[1] === "pinchos"), "spike damage");
  const subs = spikes.event.getSubEvents();
  if (subs.getEventsCount() !== 1) throw new Error("step 04: the spike event should have only the respawn sub-event");
  subs.removeEventAt(0);
  subs.insertEvent(ev([NOT("FlippedY", ["kaito"])], [
    I("PlatformBehavior::SetCanJump", ["kaito", "PlatformerObject"]),
    I("PlatformBehavior::SimulateJumpKey", ["kaito", "PlatformerObject"]),
  ]), 0);
  subs.insertEvent(ev([I("FlippedY", ["kaito"])], [setNum("Bajar", "=", "1")]), 1);

  const opacity = (obj, value) => I("OpacityCapability::OpacityBehavior::SetValue", [obj, "Opacity", "=", value]);
  const add = (e) => events.insertEvent(e, events.getEventsCount());

  // Blink while invulnerable.
  add(ev([numIs("Invulnerable", "=", "1")], [opacity("kaito", '100 + 155 * mod(floor(TimerElapsedTime("Golpe") * 10), 2)')]));
  add(ev([numIs("Invulnerable", "=", "1"), timer("Golpe", ">", INVULNERABLE)], [setNum("Invulnerable", "=", "0"), opacity("kaito", "255")]));

  // Healing ("Curacion" only exists after the first hit, so nothing heals at full health from the start).
  add(ev([numIs("Vidas", ">", "0"), numIs("Vidas", "<", MAX_LIVES), numIs("Muerto", "=", "0"), timer("Curacion", ">", HEAL_EVERY)], [
    setNum("Vidas", "+", "1"),
    resetTimer("Curacion"),
    I("TextContainerCapability::TextContainerBehavior::SetValue", ["Aviso", "Text", "=", q("+1 vida")]),
    I("Montre", ["Aviso", ""]),
    resetTimer("Aviso"),
  ]));

  // HUD hearts: the ones beyond the current lives stay faded.
  const heartsUpTo = `${HEART_X0} + ${HEART_STEP} * Variable(Vidas)`;
  add(ev([I("PosX", ["vida", "<", heartsUpTo])], [opacity("vida", "255")]));
  add(ev([I("PosX", ["vida", ">=", heartsUpTo])], [opacity("vida", "60")]));

  return `Tutorial: damage in place, ${INVULNERABLE} s invulnerable, +1 life every ${HEAL_EVERY} s, ${events.getEventsCount()} events`;
}
