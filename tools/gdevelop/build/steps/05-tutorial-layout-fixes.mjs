// Step 05 — Tutorial layout fixes found by the jump bot after the physics change of step 03.
import { makeLayoutHelpers } from "../../lib/events.mjs";

// Spikes to be jumped must sit in the open gaps between rooftops (1621..2059 and 5621..6059): under a roof
// the head bumps at ~155 px and the jump falls short. The first two floor spikes (1700 and 1900) left a 65 px
// gap between their tips for a 48 px body (a take-off window of ~18 px). Now: one spike centered in the
// first gap and the second one moved to the last gap, before the portal, as a final jump.
const MOVES = [
  ["pinchos", 1700, 1760],
  ["cristal", 1775, 1810],
  ["pinchos", 1900, 5780],
  ["cristal", 1975, 5830],
];

export default function tutorialLayoutFixes({ gd, project }) {
  const t = project.getLayout("Tutorial");
  const { allInstances } = makeLayoutHelpers(gd, t);
  for (const [name, from, to] of MOVES) {
    const found = allInstances().filter((i) => i.getObjectName() === name && i.getLayer() === "" && Math.round(i.getX()) === from);
    if (found.length !== 1) throw new Error(`step 05: expected one ${name} at x=${from}, found ${found.length}`);
    found[0].setX(to);
  }
  return `Tutorial: ${MOVES.map(([n, a, b]) => `${n} ${a}→${b}`).join(", ")}`;
}
