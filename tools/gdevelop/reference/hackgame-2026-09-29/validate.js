// Loads hackGame.json the way the IDE does, registers the FlipGravity extension metadata,
// checks every instruction against GDevelop metadata and generates JS code for each scene.
const fs = require('fs');
const path = require('path');
const init = require('./libGD.js');
const FILE = 'C:/Users/Nicte/Desktop/Team35-MJW-jorgelinamendieta-gdevelop/GravityRunnerDash/hackGame.json';

init({ locateFile: (f) => path.join(__dirname, f) }).then((gd) => {
  const project = new gd.ProjectHelper.createNewGDJSProject();
  const el = gd.Serializer.fromJSObject(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  project.unserializeFrom(el);
  el.delete();
  console.log('loaded:', project.getName(), '| scenes:', project.getLayoutsCount(), '| resources:',
    project.getResourcesManager().getAllResourceNames().size(), '| extensions:', project.getEventsFunctionsExtensionsCount());

  // Register events-based extension metadata like the IDE loader does
  const platform = gd.JsPlatform.get();
  const helper = new gd.MetadataDeclarationHelper();
  for (let i = 0; i < project.getEventsFunctionsExtensionsCount(); i++) {
    const efx = project.getEventsFunctionsExtensionAt(i);
    const ext = new gd.PlatformExtension();
    gd.MetadataDeclarationHelper.declareExtension(ext, efx);
    const fns = efx.getEventsFunctions();
    for (let j = 0; j < fns.getEventsFunctionsCount(); j++)
      helper.generateFreeFunctionMetadata(project, ext, efx, fns.getEventsFunctionAt(j));
    platform.addNewExtension(ext);
  }

  const problems = [];
  let checked = 0;
  const walk = (events, where) => {
    for (const e of events) {
      for (const [list, isAction] of [[e.conditions || [], false], [e.actions || [], true]]) {
        for (const ins of list) {
          const t = ins.type.value;
          checked++;
          const m = isAction ? gd.MetadataProvider.getActionMetadata(platform, t) : gd.MetadataProvider.getConditionMetadata(platform, t);
          const bad = isAction ? gd.MetadataProvider.isBadActionMetadata(m) : gd.MetadataProvider.isBadConditionMetadata(m);
          if (bad) { problems.push(`${where}: unknown ${isAction ? 'action' : 'condition'} ${t}`); continue; }
          const n = m.getParametersCount();
          if (ins.parameters.length > n) problems.push(`${where}: ${t} has ${ins.parameters.length} params, expects ${n}`);
          for (let k = 0; k < n; k++) {
            const p = m.getParameter(k);
            if (!p.isOptional() && !p.isCodeOnly() && (ins.parameters[k] === undefined || ins.parameters[k] === '') &&
              !['layer', 'expression', 'yesorno', 'trueorfalse', 'conditionInverted'].includes(p.getType()) && p.getType() !== '')
              problems.push(`${where}: ${t} param #${k} (${p.getType()}) empty`);
          }
          if (ins.subInstructions) walk([{ conditions: ins.subInstructions }], where + ' > ' + t);
        }
      }
      if (e.events) walk(e.events, where);
    }
  };
  const json = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  for (const l of json.layouts) walk(l.events, l.name);
  console.log('instructions checked:', checked);
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no metadata problems');

  // Generate scene code (what the preview/export compiles)
  for (let i = 0; i < project.getLayoutsCount(); i++) {
    const layout = project.getLayoutAt(i);
    const includes = new gd.SetString();
    const code = gd.LayoutCodeGenerator ? new gd.LayoutCodeGenerator(project).generateLayoutCompleteCode(layout, includes, true) : '';
    let syntax = 'ok';
    try { new Function('gdjs', 'runtimeScene', code); } catch (err) { syntax = 'SYNTAX ERROR: ' + err.message; }
    console.log(`scene ${layout.getName()}: ${code.length} chars of JS, ${syntax}`);
    fs.writeFileSync(path.join(__dirname, `code_${layout.getName()}.js`), code);
    includes.delete();
  }
}).catch((e) => { console.error('ERR', e); process.exit(1); });
