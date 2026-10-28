// Rebuilds the scratchpad scripts by replaying successful Write/Edit tool calls from a session transcript.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

const [transcript, outDir] = process.argv.slice(2);
const lines = readFileSync(transcript, "utf8").split("\n").filter(Boolean);

const calls = [];
const failed = new Set();
for (const line of lines) {
  let rec;
  try { rec = JSON.parse(line); } catch { continue; }
  const content = rec?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block.type === "tool_use" && (block.name === "Write" || block.name === "Edit")) {
      const fp = block.input?.file_path || "";
      if (/scratchpad/i.test(fp)) calls.push({ id: block.id, name: block.name, input: block.input });
    }
    if (block.type === "tool_result" && block.is_error) failed.add(block.tool_use_id);
  }
}

const files = new Map();
const log = [];
for (const c of calls) {
  if (failed.has(c.id)) { log.push(`skip (failed) ${c.name} ${basename(c.input.file_path)}`); continue; }
  const name = basename(c.input.file_path);
  if (c.name === "Write") { files.set(name, c.input.content); log.push(`write ${name}`); continue; }
  const cur = files.get(name);
  if (cur === undefined) { log.push(`EDIT ON UNKNOWN FILE ${name}`); continue; }
  const { old_string, new_string, replace_all } = c.input;
  if (!cur.includes(old_string)) { log.push(`EDIT NOT APPLICABLE ${name}`); continue; }
  files.set(name, replace_all ? cur.split(old_string).join(new_string) : cur.replace(old_string, new_string));
  log.push(`edit ${name}`);
}

mkdirSync(outDir, { recursive: true });
for (const [name, text] of files) writeFileSync(join(outDir, name), text);
console.log(log.join("\n"));
console.log(`\nRecovered ${files.size} files into ${outDir}:`);
for (const [name, text] of files) console.log(`  ${name}  (${text.split("\n").length} lines)`);
