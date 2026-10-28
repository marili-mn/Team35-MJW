// Builds GravityRunnerDash/GravityRunnerDash.json from the team's original project by applying
// every step in build/steps in order, then validates it before writing.
//
//   node tools/gdevelop/build.mjs            build, validate and write the project
//   node tools/gdevelop/build.mjs --check    build and validate, then diff against the committed file (writes nothing)
//   node tools/gdevelop/build.mjs --until 01 stop after the given step
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEngine, projectFromJSON, projectToJSON } from "./lib/engine.mjs";
import { validateProject } from "./lib/validate.mjs";
import { deepDiff, formatDiff } from "./lib/diff.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const GAME_DIR = path.join(REPO, "GravityRunnerDash");
const PROJECT_FILE = path.join(GAME_DIR, "GravityRunnerDash.json");
// The team's original project ("copiaparachicos"), as first committed to the repo.
const BASE_REF = "a964ae5";

const args = process.argv.slice(2);
const check = args.includes("--check");
const until = args.includes("--until") ? args[args.indexOf("--until") + 1] : null;

const { gd } = await loadEngine();
const baseJSON = JSON.parse(
  execFileSync("git", ["show", `${BASE_REF}:GravityRunnerDash/GravityRunnerDash.json`], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
);
const project = projectFromJSON(gd, baseJSON, PROJECT_FILE);

const stepsDir = path.join(HERE, "build", "steps");
const steps = fs.readdirSync(stepsDir).filter((f) => /^\d+-.*\.mjs$/.test(f)).sort();
for (const file of steps) {
  const step = (await import(pathToFileURL(path.join(stepsDir, file)))).default;
  const summary = step({ gd, project, gameDir: GAME_DIR });
  console.log(`step ${file}: ${summary || "ok"}`);
  if (until && file.startsWith(until)) break;
}

const report = validateProject(gd, project);
console.log(`validation: ${report.instructions} instructions, ${report.scenes.length} scenes compiled, ${report.problems.length} problems`);
if (!report.ok) {
  for (const p of report.problems) console.log(`  ✗ ${p}`);
  console.log("Not written: fix the problems above first.");
  process.exit(1);
}

const output = projectToJSON(gd, project);

// libGD gives new instances random UUIDs; derive them from scene/object/index instead so two
// builds of the same steps produce byte-identical files (clean diffs, reproducible builds).
const baseUuids = new Set(baseJSON.layouts.flatMap((l) => l.instances.map((i) => i.persistentUuid)));
for (const layout of output.layouts) {
  layout.instances.forEach((inst, index) => {
    if (baseUuids.has(inst.persistentUuid)) return;
    const h = createHash("sha1").update(`${layout.name}|${index}|${inst.name}`).digest("hex");
    inst.persistentUuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  });
}

if (check) {
  const committed = JSON.parse(fs.readFileSync(PROJECT_FILE, "utf8"));
  const groups = deepDiff(committed, output);
  const lines = formatDiff(groups);
  console.log(lines.length ? `differences vs current project file:\n${lines.join("\n")}` : "identical to the current project file");
} else {
  fs.writeFileSync(PROJECT_FILE, JSON.stringify(output, null, 2));
  console.log(`written ${path.relative(REPO, PROJECT_FILE)}`);
}
process.exit(0);
