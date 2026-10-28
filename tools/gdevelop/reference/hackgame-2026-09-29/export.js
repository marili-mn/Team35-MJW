// Exports hackGame.json to a playable HTML5 folder (scratchpad/gd/export) using libGD's Exporter.
const fs = require('fs');
const path = require('path');
const init = require('./libGD.js');
const FILE = 'C:/Users/Nicte/Desktop/Team35-MJW-jorgelinamendieta-gdevelop/GravityRunnerDash/hackGame.json';
const GDJS_ROOT = path.join(process.env.LOCALAPPDATA, 'Programs/GDevelop/resources/GDJS');
const OUT_DIR = path.join(__dirname, 'export');

init({ locateFile: (f) => path.join(__dirname, f) }).then((gd) => {
  const project = gd.ProjectHelper.createNewGDJSProject();
  const el = gd.Serializer.fromJSObject(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  project.unserializeFrom(el);
  el.delete();
  project.setProjectFile(FILE);

  // Events-based extension: metadata + code, like the IDE's loader
  const platform = gd.JsPlatform.get();
  const helper = new gd.MetadataDeclarationHelper();
  const extraScripts = [];
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (let i = 0; i < project.getEventsFunctionsExtensionsCount(); i++) {
    const efx = project.getEventsFunctionsExtensionAt(i);
    const ext = new gd.PlatformExtension();
    gd.MetadataDeclarationHelper.declareExtension(ext, efx);
    const prefix = gd.MetadataDeclarationHelper.getExtensionCodeNamespacePrefix(efx);
    const fns = efx.getEventsFunctions();
    const pending = [];
    for (let j = 0; j < fns.getEventsFunctionsCount(); j++) {
      const f = fns.getEventsFunctionAt(j);
      const meta = helper.generateFreeFunctionMetadata(project, ext, efx, f);
      const ns = gd.MetadataDeclarationHelper.getFreeFunctionCodeNamespace(f, prefix);
      const file = `ext-${efx.getName()}-${f.getName()}.js`;
      if (meta && meta.setFunctionName) meta.setFunctionName(ns + '.func');
      pending.push({ f, ns, file });
    }
    platform.addNewExtension(ext);
    for (const { f, ns, file } of pending) {
      const includes = new gd.SetString();
      const gen = new gd.EventsFunctionsExtensionCodeGenerator(project);
      const code = gen.generateFreeEventsFunctionCompleteCode(efx, f, ns, includes, true);
      fs.writeFileSync(path.join(OUT_DIR, file), code);
      extraScripts.push(file);
      includes.delete();
    }
  }

  // Node-backed file system for the exporter
  const fsys = new gd.AbstractFileSystemJS();
  fsys.mkDir = (p) => { fs.mkdirSync(p, { recursive: true }); return true; };
  fsys.dirExists = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
  fsys.clearDir = (p) => { fs.rmSync(p, { recursive: true, force: true }); fs.mkdirSync(p, { recursive: true }); return true; };
  fsys.getTempDir = () => path.join(__dirname, 'tmp');
  fsys.fileNameFrom = (p) => path.basename(p);
  fsys.dirNameFrom = (p) => path.dirname(p);
  fsys.makeAbsolute = (p, base) => path.resolve(base, p);
  fsys.makeRelative = (p, base) => path.relative(base, p).replace(/\\/g, '/');
  fsys.isAbsolute = (p) => path.isAbsolute(p);
  fsys.copyFile = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); return true; };
  fsys.writeToFile = (p, content) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); return true; };
  fsys.readFile = (p) => fs.readFileSync(p, 'utf8');
  fsys.readDir = (p, ext) => {
    const v = new gd.VectorString();
    if (fs.existsSync(p)) for (const f of fs.readdirSync(p)) if (!ext || f.toUpperCase().endsWith(ext.toUpperCase())) v.push_back(path.join(p, f));
    return v;
  };
  fsys.fileExists = (p) => fs.existsSync(p) && fs.statSync(p).isFile();

  const exporter = new gd.Exporter(fsys, GDJS_ROOT);
  const options = new gd.ExportOptions(project, OUT_DIR);
  const ok = exporter.exportWholePixiProject(options);
  console.log('export ok:', ok, exporter.getLastError());

  // Load extension code before the scene code
  const indexPath = path.join(OUT_DIR, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const tags = extraScripts.map((s) => `<script src="${s}" crossorigin="anonymous"></script>`).join('\n\t');
  html = html.replace(/(<script src="code0\.js")/, `${tags}\n\t$1`);
  fs.writeFileSync(indexPath, html);
  console.log('scripts injected:', extraScripts.join(', '));
}).catch((e) => { console.error('ERR', e); process.exit(1); });
