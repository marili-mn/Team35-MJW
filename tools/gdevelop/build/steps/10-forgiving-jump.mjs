// Step 10 — A forgiving jump (playtest: controls scored 3.43/5, the lowest). Two tricks every precise
// platformer uses (Celeste among them):
// - Jump buffer: a jump pressed up to 0.15 s before landing happens on the frame Kaito lands.
// - Coyote time: for 0.1 s after walking off an edge Kaito can still jump.
// Both only on the floor side (not while walking upside down).
import { makeEventHelpers } from "../../lib/events.mjs";

const PLAYABLE = ["Tutorial", "Nivel1", "Nivel2", "Nivel3"];
const BUFFER = 0.15, COYOTE = 0.1;

export default function forgivingJump({ gd, project }) {
  const { I, NOT, ev, numIs, setNum, keyJust, timer, resetTimer } = makeEventHelpers(gd);
  const P = ["kaito", "PlatformerObject"];
  for (const name of PLAYABLE) {
    const layout = project.getLayout(name);
    const events = layout.getEvents();
    const vars = layout.getVariables();
    if (!vars.has("BufferSalto")) vars.insertNew("BufferSalto", vars.count());
    const add = (e) => events.insertEvent(e, events.getEventsCount());
    const alive = numIs("Muerto", "=", "0");
    const upright = NOT("FlippedY", ["kaito"]);
    // Coyote: the jump key in the air, right after leaving the floor without jumping.
    add(ev([keyJust("Space"), alive, upright, NOT("PlatformBehavior::IsOnFloor", P), NOT("PlatformBehavior::IsJumping", P), timer("Coyote", "<", String(COYOTE))],
      [I("PlatformBehavior::SetCanJump", P), I("PlatformBehavior::SimulateJumpKey", P)]));
    // Buffer: remember a jump pressed in the air...
    add(ev([keyJust("Space"), NOT("PlatformBehavior::IsOnFloor", P)], [setNum("BufferSalto", "=", "1"), resetTimer("BufferSalto")]));
    // ...and do it on landing if it was recent enough.
    add(ev([I("PlatformBehavior::IsOnFloor", P), numIs("BufferSalto", "=", "1")], [setNum("BufferSalto", "=", "0")], [
      ev([timer("BufferSalto", "<", String(BUFFER)), alive, upright], [I("PlatformBehavior::SimulateJumpKey", P)]),
    ]));
    add(ev([I("PlatformBehavior::IsOnFloor", P)], [resetTimer("Coyote")]));
  }
  return `${PLAYABLE.join(", ")}: jump buffer ${BUFFER} s, coyote time ${COYOTE} s`;
}
