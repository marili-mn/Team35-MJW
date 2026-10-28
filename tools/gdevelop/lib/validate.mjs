// Checks a project the way the editor would: every instruction must exist in GDevelop's metadata
// with the right parameter count, every event must have a type, and each scene must compile to
// syntactically valid JavaScript.

export function validateProject(gd, project) {
  const platform = project.getCurrentPlatform();
  const problems = [];
  let instructions = 0;

  function checkList(list, isCondition, where) {
    for (let i = 0; i < list.size(); i++) {
      const instr = list.get(i);
      const type = instr.getType();
      instructions++;
      const meta = isCondition
        ? gd.MetadataProvider.getConditionMetadata(platform, type)
        : gd.MetadataProvider.getActionMetadata(platform, type);
      if (gd.MetadataProvider.isBadInstructionMetadata(meta)) {
        problems.push(`${where}: unknown ${isCondition ? "condition" : "action"} ${type}`);
        continue;
      }
      const expected = meta.getParametersCount();
      const got = instr.getParametersCount();
      if (got > expected) problems.push(`${where}: ${type} has ${got} parameters, metadata expects ${expected}`);
      if (instr.getSubInstructions().size()) checkList(instr.getSubInstructions(), isCondition, `${where} > ${type}`);
    }
  }

  function walk(events, where) {
    for (let i = 0; i < events.getEventsCount(); i++) {
      const e = events.getEventAt(i);
      const at = `${where}#${i}`;
      if (!e.getType()) problems.push(`${at}: event without type`);
      if (e.getType() === "BuiltinCommonInstructions::Standard") {
        const s = gd.asStandardEvent(e);
        checkList(s.getConditions(), true, at);
        checkList(s.getActions(), false, at);
      }
      if (e.canHaveSubEvents()) walk(e.getSubEvents(), `${at}>`);
    }
  }

  const scenes = [];
  for (let i = 0; i < project.getLayoutsCount(); i++) {
    const layout = project.getLayoutAt(i);
    walk(layout.getEvents(), layout.getName());
    const includes = new gd.SetString();
    const code = new gd.LayoutCodeGenerator(project).generateLayoutCompleteCode(layout, includes, true);
    includes.delete();
    try {
      new Function("gdjs", "runtimeScene", code); // syntax check only, never executed
      scenes.push({ name: layout.getName(), events: layout.getEvents().getEventsCount(), codeChars: code.length });
    } catch (err) {
      problems.push(`${layout.getName()}: generated code does not compile (${err.message})`);
    }
  }
  return { ok: problems.length === 0, problems, instructions, scenes };
}
