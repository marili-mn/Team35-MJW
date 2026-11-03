// Finds FFmpeg (used to encode the music to MP3 and to cut the trailer): the FFMPEG variable, the PATH, or the
// folder where winget installs it on Windows (it does not always add itself to the PATH).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function findFfmpeg(tool = "ffmpeg") {
  const fromEnv = tool === "ffmpeg" ? process.env.FFMPEG : process.env.FFPROBE;
  if (fromEnv) return fromEnv;
  if (spawnSync(tool, ["-version"], { stdio: "ignore" }).status === 0) return tool;
  const winget = path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Packages");
  if (fs.existsSync(winget)) {
    for (const pkg of fs.readdirSync(winget).filter((d) => /^Gyan\.FFmpeg/i.test(d))) {
      for (const build of fs.readdirSync(path.join(winget, pkg))) {
        const exe = path.join(winget, pkg, build, "bin", `${tool}.exe`);
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  throw new Error(`${tool} not found: install FFmpeg or set ${tool === "ffmpeg" ? "FFMPEG" : "FFPROBE"} to its path`);
}

export function run(tool, args) {
  const r = spawnSync(findFfmpeg(tool), args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${tool} ${args.slice(0, 6).join(" ")}...: ${(r.stderr || "").slice(-800)}`);
  return r;
}
