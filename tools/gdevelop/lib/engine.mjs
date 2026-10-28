// GDevelop engine for Node, taken from the GDevelop installed on this machine.
// libGD is extracted from the IDE's app.asar (same version as the editor) into a git-ignored
// cache, and the JS runtime/extensions come from resources/GDJS. Nothing is installed in the repo.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.resolve(HERE, "..", ".cache");

export const GDEVELOP_DIR = process.env.GDEVELOP_DIR || path.join(process.env.LOCALAPPDATA || "", "Programs", "GDevelop");
const RESOURCES = path.join(GDEVELOP_DIR, "resources");
export const GDJS_ROOT = path.join(RESOURCES, "GDJS");

function ensureLibGD() {
  const asar = path.join(RESOURCES, "app.asar");
  if (!fs.existsSync(asar)) throw new Error(`GDevelop not found at ${GDEVELOP_DIR} (set GDEVELOP_DIR)`);
  const st = fs.statSync(asar);
  const dir = path.join(CACHE, `libgd-${st.size}-${Math.round(st.mtimeMs)}`);
  if (!fs.existsSync(path.join(dir, "libGD.wasm"))) {
    fs.mkdirSync(dir, { recursive: true });
    // @electron/asar runs through npx: fetched on demand, never added to the repo.
    for (const file of ["package.json", "www/libGD.js", "www/libGD.wasm"]) {
      execSync(`npx --yes @electron/asar extract-file "${asar}" "${file}"`, { cwd: dir, stdio: "pipe" });
    }
  }
  const version = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
  return { dir, version };
}

function loadJsExtensions(gd) {
  const platform = gd.JsPlatform.get();
  const root = path.join(GDJS_ROOT, "Runtime", "Extensions");
  const failed = [];
  let loaded = 0;
  for (const name of fs.readdirSync(root)) {
    const file = path.join(root, name, "JsExtension.js");
    if (!fs.existsSync(file)) continue;
    try {
      const mod = require(file);
      const extension = mod.createExtension((s) => s, gd);
      platform.addNewExtension(extension);
      extension.delete();
      loaded++;
    } catch (e) {
      failed.push(`${name}: ${e.message.split("\n")[0]}`);
    }
  }
  return { loaded, failed };
}

let cached;
export async function loadEngine({ quiet = false } = {}) {
  if (cached) return cached;
  const { dir, version } = ensureLibGD();
  const init = require(path.join(dir, "libGD.js"));
  const gd = await init({ locateFile: (f) => path.join(dir, f), print: () => {}, printErr: () => {} });
  delete gd.then;
  globalThis.gd = gd; // some JsExtension files read the global
  const ext = loadJsExtensions(gd);
  if (!quiet) {
    console.log(`GDevelop engine ${version} (JS extensions: ${ext.loaded} loaded${ext.failed.length ? `, ${ext.failed.length} skipped` : ""})`);
  }
  cached = { gd, version, extensions: ext };
  return cached;
}

// Same metadata registration the IDE does for events-based extensions (e.g. FlipGravity).
function registerEventsFunctionsExtensions(gd, project) {
  const platform = gd.JsPlatform.get();
  const helper = new gd.MetadataDeclarationHelper();
  for (let i = 0; i < project.getEventsFunctionsExtensionsCount(); i++) {
    const efx = project.getEventsFunctionsExtensionAt(i);
    const ext = new gd.PlatformExtension();
    gd.MetadataDeclarationHelper.declareExtension(ext, efx);
    const prefix = gd.MetadataDeclarationHelper.getExtensionCodeNamespacePrefix(efx);
    const fns = efx.getEventsFunctions();
    for (let j = 0; j < fns.getEventsFunctionsCount(); j++) {
      const f = fns.getEventsFunctionAt(j);
      const meta = helper.generateFreeFunctionMetadata(project, ext, efx, f);
      const ns = gd.MetadataDeclarationHelper.getFreeFunctionCodeNamespace(f, prefix);
      if (meta && meta.setFunctionName) meta.setFunctionName(`${ns}.func`);
    }
    platform.addNewExtension(ext);
  }
  helper.delete();
}

export function projectFromJSON(gd, json, projectFile) {
  const project = gd.ProjectHelper.createNewGDJSProject();
  const el = gd.Serializer.fromJSObject(json);
  project.unserializeFrom(el);
  el.delete();
  if (projectFile) project.setProjectFile(projectFile);
  registerEventsFunctionsExtensions(gd, project);
  return project;
}

export function loadProject(gd, file) {
  return projectFromJSON(gd, JSON.parse(fs.readFileSync(file, "utf8")), path.resolve(file));
}

// Serializes like the IDE (2-space JSON) so diffs stay clean when the editor re-saves the project.
export function projectToJSON(gd, project) {
  const el = new gd.SerializerElement();
  project.serializeTo(el);
  const json = JSON.parse(gd.Serializer.toJSON(el));
  el.delete();
  return json;
}

export function saveProject(gd, project, file) {
  fs.writeFileSync(file, JSON.stringify(projectToJSON(gd, project), null, 2));
}
