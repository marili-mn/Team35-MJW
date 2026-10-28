// Small builders for GDevelop events, instructions and scene instances (libGD objects).

export function makeEventHelpers(gd) {
  function I(type, params, inverted = false) {
    const instr = new gd.Instruction();
    instr.setType(type);
    instr.setParametersCount(params.length);
    params.forEach((p, i) => instr.setParameter(i, String(p)));
    if (inverted) instr.setInverted(true);
    return instr;
  }
  const NOT = (type, params) => I(type, params, true);
  function ev(conds, acts, subs = []) {
    const e = new gd.StandardEvent();
    e.setType("BuiltinCommonInstructions::Standard");
    conds.forEach((c) => e.getConditions().push_back(c));
    acts.forEach((a) => e.getActions().push_back(a));
    subs.forEach((s) => e.getSubEvents().insertEvent(s, e.getSubEvents().getEventsCount()));
    return e;
  }
  function jsEvent(lines) {
    const js = new gd.JsCodeEvent();
    js.setType("BuiltinCommonInstructions::JsCode");
    js.setInlineCode(lines.join("\n"));
    js.setParameterObjects("");
    return js;
  }
  const q = (s) => `"${s}"`;
  return {
    I, NOT, ev, jsEvent, q,
    setNum: (v, op, val) => I("SetNumberVariable", [v, op, val]),
    numIs: (v, op, val) => I("NumberVariable", [v, op, val]),
    setStr: (v, val) => I("SetStringVariable", [v, "=", q(val)]),
    coll: (a, b) => I("CollisionNP", [a, b, "", "", ""]),
    key: (k) => I("KeyFromTextPressed", ["", q(k)]),
    keyJust: (k) => I("KeyFromTextJustPressed", ["", q(k)]),
    timer: (n, op, v) => I("CompareTimer", ["", q(n), op, v]),
    resetTimer: (n) => I("ResetTimer", ["", q(n)]),
  };
}

export function makeLayoutHelpers(gd, layout) {
  const instances = layout.getInitialInstances();
  function allInstances() {
    const list = [];
    const f = new gd.InitialInstanceJSFunctor();
    f.invoke = (ptr) => list.push(gd.wrapPointer(ptr, gd.InitialInstance));
    instances.iterateOverInstances(f);
    return list;
  }
  function addInst(name, x, y, w, h, { layer = "", z = 0, flipX = false, flipY = false } = {}) {
    const inst = instances.insertNewInitialInstance();
    inst.setObjectName(name);
    inst.setX(x);
    inst.setY(y);
    if (w) {
      inst.setHasCustomSize(true);
      inst.setCustomWidth(w);
      inst.setCustomHeight(h);
    }
    inst.setLayer(layer);
    inst.setZOrder(z);
    if (flipX) inst.setFlippedX(true);
    if (flipY) inst.setFlippedY(true);
    return inst;
  }
  return { allInstances, addInst };
}
