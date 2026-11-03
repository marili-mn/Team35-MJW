// Step 15 — Standing on platforms, keeping Kaito on screen, and a tighter gravity flip.
// - Platforms: the slabs only had a collider along their underside (for walking upside down), so Kaito
//   standing on one sank 45-80 px into the art. Each slab now also gets a collider on its drawn surface
//   (measured from the image: the first row that is mostly opaque).
// - The safety ceiling over the whole level counted as a ceiling for the flip, so from the top of a slab
//   Kaito could flip up to it and walk off the top of the screen. It is now its own object (solid, but
//   not a ceiling for the flip) and sits at the visible top edge; a flipped Kaito that ends up up there
//   drops on his own.
// - Gravity flip, harder level by level: it costs more energy, hanging drains it faster, crystals give
//   less, and after dropping there is a short wait before the next flip.
import fs from "node:fs";
import path from "node:path";
import { makeEventHelpers, makeEventFinder, makeLayoutHelpers } from "../../lib/events.mjs";
import { insertObjectFrom, serializeObject } from "../../lib/objects.mjs";
import { readPng, opaqueTop } from "../../lib/png.mjs";

// Energy to flip up, seconds per energy point while hanging, energy per crystal, wait after dropping.
export const GRAVITY = {
  Tutorial: { cost: 24, drain: 0.45, crystal: 9, cooldown: 0.4 },
  Nivel1: { cost: 28, drain: 0.38, crystal: 8, cooldown: 0.5 },
  Nivel2: { cost: 32, drain: 0.32, crystal: 7, cooldown: 0.5 },
  Nivel3: { cost: 36, drain: 0.28, crystal: 6, cooldown: 0.5 },
  Supervivencia: { cost: 32, drain: 0.32, crystal: 7, cooldown: 0.5 },
};
const MASK_TOP = 31;   // the collider image (techo, piso) is 64 px tall with its solid line 31 px down

export default function platformsAndGravity({ gd, project, gameDir }) {
  const { I, NOT, ev, q, setNum, numIs, keyJust, timer, resetTimer } = makeEventHelpers(gd);
  const has = (list, type, ...params) => list.some((x) => x.type === type && params.every((p, i) => p === undefined || x.params[i] === p));
  const surfaceOf = (file) => opaqueTop(readPng(fs.readFileSync(path.join(gameDir, file))));
  const report = [];

  for (const [name, g] of Object.entries(GRAVITY)) {
    const layout = project.getLayout(name);
    const objects = layout.getObjects();
    const events = layout.getEvents();
    const { find } = makeEventFinder(gd, events, `step 15 (${name})`);
    const { allInstances, addInst } = makeLayoutHelpers(gd, layout);
    const vars = layout.getVariables();
    if (!vars.has("CostoGravedad")) vars.insertNew("CostoGravedad", vars.count());
    vars.get("CostoGravedad").setValue(g.cost);

    // ---- colliders: slab surfaces (the levels already got theirs from lib/level.mjs) and the safety ceiling ----
    const techo = serializeObject(gd, objects.getObject("techo"));
    const needsSlabTops = !objects.hasObjectNamed("sueloLosa");
    if (needsSlabTops) insertObjectFrom(gd, project, objects, "sueloLosa", techo);
    insertObjectFrom(gd, project, objects, "techoSeguridad", techo);
    const slabArt = objects.getObject("pisoflotante");
    const slabImage = gd.asSpriteConfiguration(slabArt.getConfiguration()).getAnimations().getAnimation(0).getDirection(0).getSprite(0).getImageName();
    const surface = surfaceOf(project.getResourcesManager().getResource(slabImage).getFile());
    const instances = allInstances();
    const topLine = instances.some((i) => i.getObjectName() === "techosuperior") ? 50 : 4;
    let slabs = 0, safety = 0;
    for (const inst of instances) {
      const n = inst.getObjectName();
      if (n === "techo" && inst.getY() === -55) { inst.setObjectName("techoSeguridad"); inst.setY(topLine - MASK_TOP); safety++; }
      if (needsSlabTops && n === "pisoflotante" && inst.getZOrder() >= 1) {
        const w = inst.hasCustomSize() ? inst.getCustomWidth() : 256, h = inst.hasCustomSize() ? inst.getCustomHeight() : 85;
        addInst("sueloLosa", inst.getX(), Math.round(inst.getY() + h * surface) - MASK_TOP, w, 64, { z: 0 });
        slabs++;
      }
    }
    if (safety !== 1) throw new Error(`step 15 (${name}): expected one safety ceiling, found ${safety}`);
    events.insertEvent(ev([I("SceneJustBegins", [""])], [I("Cache", ["sueloLosa"]), I("Cache", ["techoSeguridad"])]), 0);

    // ---- a flipped Kaito that floats off the slabs drops on his own ----
    const warn = (text) => [I("TextContainerCapability::TextContainerBehavior::SetValue", ["Aviso", "Text", "=", q(text)]), I("Montre", ["Aviso", ""]), resetTimer("Aviso")];
    events.insertEvent(ev([I("FlippedY", ["kaito"]), I("PosY", ["kaito", "<", "150"]), numIs("Bajar", "=", "0")],
      [setNum("Bajar", "=", "1"), ...warn("Sin techo: Kaito baja")]), events.getEventsCount());

    // ---- gravity numbers (they live in sub-events too) ----
    let changed = 0;
    const walk = (list) => {
      for (let i = 0; i < list.getEventsCount(); i++) {
        const e = list.getEventAt(i);
        if (e.getType() === "BuiltinCommonInstructions::Standard") {
          const s = gd.asStandardEvent(e);
          const conds = s.getConditions(), acts = s.getActions();
          for (let j = 0; j < conds.size(); j++) {
            const c = conds.get(j), p = (k) => c.getParameter(k).getPlainString();
            if (c.getType() === "NumberVariable" && p(0) === "EnergiaGravedad" && p(1) === "<" && p(2) === "20") { c.setParameter(2, "Variable(CostoGravedad)"); changed++; }
            if (c.getType() === "CompareTimer" && p(1) === '"Drenaje"') { c.setParameter(3, String(g.drain)); changed++; }
          }
          for (let j = 0; j < acts.size(); j++) {
            const a = acts.get(j), p = (k) => a.getParameter(k).getPlainString();
            if (a.getType() === "SetNumberVariable" && p(0) === "EnergiaGravedad" && p(1) === "-" && p(2) === "20") { a.setParameter(2, "Variable(CostoGravedad)"); changed++; }
            if (a.getType() === "SetNumberVariable" && p(0) === "EnergiaGravedad" && p(1) === "+" && p(2) === "10 * Count(cristal)") { a.setParameter(2, `${g.crystal} * Count(cristal)`); changed++; }
          }
        }
        if (e.canHaveSubEvents()) walk(e.getSubEvents());
      }
    };
    walk(events);
    if (changed !== 4) throw new Error(`step 15 (${name}): expected 4 gravity numbers, changed ${changed}`);

    // ---- a short wait between dropping and flipping up again ----
    const drop = find((c, a) => has(c, "NumberVariable", "Bajar", "=", "1") && has(a, "FlipGravity::Reset"), "drop");
    drop.event.getActions().insert(resetTimer("EnfriarGravedad"), drop.event.getActions().size());
    const flipCall = find((c, a) => has(a, "FlipGravity::FlipGravity2Objects"), "flip extension call");
    const blockFlip = I("SetObjectVariableAsBoolean", ["kaito", "__FlipGravityExtension.FlippingTrigger", "True"]);
    events.insertEvent(ev([NOT("FlippedY", ["kaito"]), keyJust("LAlt"), numIs("Pausado", "=", "0"), timer("EnfriarGravedad", "<", String(g.cooldown))],
      [blockFlip, ...warn("La gravedad se recarga")]), flipCall.index);

    report.push(`${name}: ${slabs} slab tops, cost ${g.cost}, drain 1/${g.drain}s, crystal +${g.crystal}, wait ${g.cooldown}s`);
  }
  return report.join("; ");
}
