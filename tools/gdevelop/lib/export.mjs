// HTML5 export with libGD, like the IDE's "Export to a local folder" (used for automated playtests;
// the build uploaded to itch.io is still exported from the IDE).
import fs from "node:fs";
import path from "node:path";
import { GDJS_ROOT } from "./engine.mjs";

function nodeFileSystem(gd, tmpDir, missing) {
  const fsys = new gd.AbstractFileSystemJS();
  fsys.mkDir = (p) => { fs.mkdirSync(p, { recursive: true }); return true; };
  fsys.dirExists = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
  fsys.clearDir = (p) => { fs.rmSync(p, { recursive: true, force: true }); fs.mkdirSync(p, { recursive: true }); return true; };
  fsys.getTempDir = () => tmpDir;
  fsys.fileNameFrom = (p) => path.basename(p);
  fsys.dirNameFrom = (p) => path.dirname(p);
  fsys.makeAbsolute = (p, base) => path.resolve(base, p);
  fsys.makeRelative = (p, base) => path.relative(base, p).replace(/\\/g, "/");
  fsys.isAbsolute = (p) => path.isAbsolute(p);
  // Like the IDE: a declared resource whose file is missing is skipped, not fatal.
  fsys.copyFile = (src, dst) => {
    if (!fs.existsSync(src)) { missing.push(src); return false; }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    return true;
  };
  fsys.writeToFile = (p, content) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); return true; };
  fsys.readFile = (p) => fs.readFileSync(p, "utf8");
  fsys.readDir = (p, ext) => {
    const v = new gd.VectorString();
    if (fs.existsSync(p)) for (const f of fs.readdirSync(p)) if (!ext || f.toUpperCase().endsWith(ext.toUpperCase())) v.push_back(path.join(p, f));
    return v;
  };
  fsys.fileExists = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
  return fsys;
}

export function exportProject(gd, project, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // The libGD exporter does not generate code for events-based extensions (the IDE does it in JS):
  // generate each free function of each extension and load it before the scene code.
  const extraScripts = [];
  for (let i = 0; i < project.getEventsFunctionsExtensionsCount(); i++) {
    const efx = project.getEventsFunctionsExtensionAt(i);
    const prefix = gd.MetadataDeclarationHelper.getExtensionCodeNamespacePrefix(efx);
    const fns = efx.getEventsFunctions();
    for (let j = 0; j < fns.getEventsFunctionsCount(); j++) {
      const f = fns.getEventsFunctionAt(j);
      const ns = gd.MetadataDeclarationHelper.getFreeFunctionCodeNamespace(f, prefix);
      const includes = new gd.SetString();
      const code = new gd.EventsFunctionsExtensionCodeGenerator(project).generateFreeEventsFunctionCompleteCode(efx, f, ns, includes, true);
      includes.delete();
      const file = `ext-${efx.getName()}-${f.getName()}.js`;
      fs.writeFileSync(path.join(outDir, file), code);
      extraScripts.push(file);
    }
  }

  const tmp = path.join(outDir, "..", ".export-tmp");
  const missing = [];
  const exporter = new gd.Exporter(nodeFileSystem(gd, tmp, missing), GDJS_ROOT);
  const options = new gd.ExportOptions(project, outDir);
  const ok = exporter.exportWholePixiProject(options);
  const error = exporter.getLastError();
  options.delete();
  exporter.delete();
  if (!ok) throw new Error(`export failed: ${error}`);

  const indexPath = path.join(outDir, "index.html");
  const tags = extraScripts.map((s) => `<script src="${s}" crossorigin="anonymous"></script>`).join("\n\t");
  fs.writeFileSync(indexPath, fs.readFileSync(indexPath, "utf8").replace(/(<script src="code0\.js")/, `${tags}\n\t$1`));
  return { outDir, extensionScripts: extraScripts.length, missingResources: missing };
}
