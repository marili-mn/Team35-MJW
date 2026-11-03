// Cuts the video pitch (docs/video/guion.md, section 3) with FFmpeg: the trailer first, then the team answering
// the ten points of the professor's e-mail, one member per answer, over gameplay and pages of the GDD, with
// subtitles, and the end card with the UNER logo.
//   node tools/video/make-trailer.mjs && node tools/video/make-pitch.mjs   ->   tools/video/.cache/pitch.mp4
// Inputs in tools/video/.cache: trailer.mp4, voz-<member>.mp3 (one ElevenLabs take per member, see
// pitch-script.mjs), the gameplay takes (take-*.webm, tools/video/capture.md, plus take-Pantallas.webm: menu,
// level select and Victoria), the GDD pages (gdd-*.png), menu.png and fonts/ (Cinzel, Segoe UI and its Semibold).
// The b-roll is rendered shot by shot first (each shot its own FFmpeg run, so nothing is held in memory), then
// the titles, subtitles and the mix go on top in one pass.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../gdevelop/lib/ffmpeg.mjs";
import { CHAPTERS, LINES, MEMBERS, shown } from "./pitch-script.mjs";
import { cuts, loudness, takeFile } from "./voice-cuts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const CACHE = path.join(HERE, ".cache");
const AUDIO = path.join(REPO, "GravityRunnerDash", "assets", "audio");
const LOGO_UNER = path.join(REPO, "GravityRunnerDash", "assets", "creditos", "logo-uner.png");
const W = 1280, H = 720, FPS = 30;
const TRAILER_END = 56.5;          // the trailer up to its last gameplay shot (its own end card is replaced by ours)
const INTRO = 3.2, LEAD = 1.0, GAP = 0.3, END_CARD = 5.5;

const TAKES = {
  n1: "take-Nivel1.webm", n2: "take-Nivel2.webm", n3: "take-Nivel3.webm", arena: "take-Arena.webm",
  refl: "take-Reflejo.webm", sup: "take-Supervivencia.webm", tut: "take-Tutorial.webm", pant: "take-Pantallas.webm",
};
// What is seen under each answer: [take, from, seconds, "shrink"?] or ["page", image, seconds]. Each chapter is
// filled in order and the last shot is cut where the chapter ends. Ranges avoid the shots the trailer already
// used. "shrink" leaves a band at the bottom for the subtitles (the Victoria credits and the level select have
// text down there).
const BROLL = {
  intro: [["n3", 46, 4]],
  1: [["page", "gdd-v1-0.png", 7], ["page", "gdd-v1-3.png", 7], ["n1", 19, 10]],
  2: [["n1", 29, 8], ["n2", 14, 8], ["n3", 21, 8]],
  3: [["n1", 37, 8], ["n2", 22, 8], ["refl", 12, 8]],
  4: [["n3", 29, 9], ["arena", 0, 9], ["n3", 38, 8]],
  5: [["pant", 14.4, 9.6, "shrink"], ["page", "gdd-v1-2.png", 7], ["pant", 0.3, 6]],
  6: [["page", "gdd-v1-8.png", 8], ["page", "gdd-v1-9.png", 8], ["n2", 36, 8], ["sup", 2, 8], ["arena", 30, 4]],
  7: [["tut", 0.2, 4.8], ["n2", 2.5, 6.5], ["n1", 45, 3.9], ["arena", 22, 8]],
  8: [["sup", 17, 14]],
  9: [["pant", 6.6, 7.5, "shrink"], ["n2", 44, 5], ["sup", 31, 3.4]],
  10: [["arena", 10, 12], ["refl", 24, 8]],
  11: [["refl", 32, 11]],          // the closing line, then the end card
};

// ---- timeline: when each line is heard, counted from the start of the team part (the intro card) ----
const voice = Object.fromEntries(Object.keys(MEMBERS).map((m) => [m, cuts(m)]));
const used = Object.fromEntries(Object.keys(MEMBERS).map((m) => [m, 0]));
const timeline = [];               // { member, chapter, text, from, to, at }
const chapters = [];               // { n, start, end }
let t = INTRO;
for (const [member] of LINES) {
  const cut = voice[member][used[member]++];
  if (!chapters.length || chapters[chapters.length - 1].n !== cut.chapter) {
    if (chapters.length) chapters[chapters.length - 1].end = t;
    chapters.push({ n: cut.chapter, start: t });
    t += cut.chapter === 11 ? 0.8 : LEAD;
  }
  timeline.push({ member, ...cut, at: t });
  t += cut.to - cut.from + GAP;
}
chapters[chapters.length - 1].end = t - GAP + 0.4;
const teamLength = t - GAP + 0.4 + END_CARD;
const total = TRAILER_END + teamLength;
if (total > 300) throw new Error(`the pitch would last ${total.toFixed(1)} s, over the 5 minutes`);

process.chdir(CACHE);              // fonts/ and the text files are relative to the cache

// ---- 1. the b-roll, shot by shot ----
const shotsDir = path.join(CACHE, "pitch-shots");
fs.rmSync(shotsDir, { recursive: true, force: true });
fs.mkdirSync(shotsDir, { recursive: true });
const enc = ["-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-an"];
const look = "eq=brightness=-0.05:saturation=0.92";
const shots = [];
function shot(kind, args, seconds) {
  const out = path.join(shotsDir, `${String(shots.length).padStart(2, "0")}.mp4`);
  const d = seconds.toFixed(3);
  if (kind === "page") {
    // A GDD page on the night background, scrolling down slowly.
    const img = path.join(CACHE, args);
    run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=0x0e0818:s=${W}x${H}:r=${FPS}:d=${d}`, "-loop", "1", "-t", d, "-i", img,
      "-filter_complex", `[1:v]scale=980:-2,format=rgba[p];[0:v][p]overlay=x=(W-w)/2:y='-min(max(h-H+40,0),230*${d})*t/${d}+20':shortest=1,format=yuv420p`, ...enc, "-t", d, out]);
  } else if (kind === "end") {
    // End card: the game's logo (from the menu), where to play it, the team, the UNER logo and the credits.
    const text = (s) => { const f = path.join(shotsDir, `end-${fs.readdirSync(shotsDir).length}.txt`); fs.writeFileSync(f, s); return path.relative(CACHE, f).replaceAll("\\", "/"); };
    const line = (s, font, size, color, y) => `drawtext=fontfile=${font}:textfile=${text(s)}:expansion=none:fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}`;
    const team = Object.values(MEMBERS).map((m) => m.name).join("  ·  ");
    run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=0x0e0818:s=${W}x${H}:r=${FPS}:d=${d}`, "-loop", "1", "-t", d, "-i", path.join(CACHE, "menu.png"), "-loop", "1", "-t", d, "-i", LOGO_UNER,
      "-filter_complex", [
        `[1:v]crop=720:320:280:48,scale=540:-2,format=rgba[logo]`,
        `[2:v]scale=250:-2,format=rgba[uner]`,
        `[0:v][logo]overlay=x=(W-w)/2:y=18[a]`,
        `[a][uner]overlay=x=(W-w)/2:y=470[b]`,
        `[b]${[
          line("Jugalo gratis en el navegador", "fonts/Cinzel.ttf", 30, "0xF2EAD3", 268),
          line("marilidev.itch.io/gravity-runner-dash", "fonts/seguisb.ttf", 28, "0xE85A6A", 314),
          line("Grupo 35 · Multimedia y Juegos en Web", "fonts/Cinzel.ttf", 24, "0xE8C46A", 380),
          line(team, "fonts/segoeui.ttf", 21, "0xC9C2D8", 420),
          line("Voces generadas con IA (ElevenLabs) · Música y sonido originales del juego", "fonts/segoeui.ttf", 18, "0x9E96B0", 612),
          line("© 2026 Grupo 35. Todos los derechos reservados.", "fonts/segoeui.ttf", 18, "0x8A829C", 644),
        ].join(",")},fade=t=in:st=0:d=0.8,format=yuv420p`,
      ].join(";"), ...enc, "-t", d, out]);
  } else {
    const [src, from, shrink] = args;
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(CACHE, TAKES[src]), "-vf",
      `trim=start=${from}:duration=${d},setpts=PTS-STARTPTS,fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,${look}${kind === "dim" ? ",eq=brightness=-0.25:saturation=0.7" : ""}${shrink ? `,scale=1110:-2,pad=${W}:${H}:(ow-iw)/2:0:color=0x0e0818,setsar=1` : ""}`, ...enc, "-t", d, out]);
  }
  shots.push(out);
}
function fill(list, seconds, dim = false) {
  let left = seconds;
  for (let i = 0; left > 0.01; i++) {
    const s = list[i % list.length];
    const len = Math.min(s[2], left);
    if (s[0] === "page") shot("page", s[1], len);
    else shot(dim ? "dim" : "clip", [s[0], s[1], s[3] === "shrink"], len);
    left -= len;
  }
}
fill(BROLL.intro, INTRO, true);
for (const c of chapters) fill(BROLL[c.n], c.end - c.start);
shot("end", null, END_CARD);
const list = path.join(shotsDir, "list.txt");
fs.writeFileSync(list, shots.map((s) => `file '${path.basename(s)}'`).join("\n"));
const broll = path.join(CACHE, "pitch-broll.mp4");
run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", broll]);

// ---- 2. titles, subtitles and the mix ----
const textDir = path.join(CACHE, "pitch-text");
fs.rmSync(textDir, { recursive: true, force: true });
fs.mkdirSync(textDir, { recursive: true });
let nText = 0;
const textFile = (s) => { const f = `pitch-text/${nText++}.txt`; fs.writeFileSync(path.join(CACHE, f), s); return f; };
const fade = (a, b, d = 0.3) => `if(lt(t,${a.toFixed(2)}),0,if(lt(t,${(a + d).toFixed(2)}),(t-${a.toFixed(2)})/${d},if(lt(t,${(b - d).toFixed(2)}),1,if(lt(t,${b.toFixed(2)}),(${b.toFixed(2)}-t)/${d},0))))`;
const draws = [];
const draw = (s, a, b, o) => draws.push(`drawtext=fontfile=${o.font}:textfile=${textFile(s)}:expansion=none:fontsize=${o.size}:fontcolor=${o.color}:x=${o.x}:y=${o.y}${o.align ? `:text_align=${o.align}:line_spacing=6` : ""}${o.box ? `:box=1:boxcolor=0x0e0818@${o.box}:boxborderw=${o.border || 14}` : ""}:borderw=${o.borderw ?? 1}:bordercolor=black@0.6:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})':alpha='${fade(a, b, o.fade || 0.3)}'`);

// Intro card over the temple.
draw("EL EQUIPO DETRÁS DEL JUEGO", 0.2, INTRO - 0.1, { font: "fonts/Cinzel.ttf", size: 52, color: "0xE8C46A", x: "(w-text_w)/2", y: "(h-text_h)/2-30", fade: 0.5 });
draw("Diez respuestas en las voces del Grupo 35", 0.6, INTRO - 0.1, { font: "fonts/segoeui.ttf", size: 26, color: "0xF2EAD3", x: "(w-text_w)/2", y: "(h)/2+30", fade: 0.5 });
// Chapters: a big title when each one starts, then a small tag top right, above who is speaking (the game's
// HUD is on the left).
for (const c of chapters) {
  if (c.n === 11) continue;
  draw(`${c.n} · ${CHAPTERS[c.n].toUpperCase()}`, c.start, c.start + 2.3, { font: "fonts/Cinzel.ttf", size: 50, color: "0xE8C46A", x: "(w-text_w)/2", y: "h/2-80", box: 0.55, border: 22, borderw: 2, fade: 0.35 });
  draw(`${c.n}/10 · ${CHAPTERS[c.n]}`, c.start + 2.1, c.end, { font: "fonts/Cinzel.ttf", size: 22, color: "0xE8C46A", x: "w-text_w-36", y: "24", box: 0.6, border: 10 });
}
// Who is speaking: name and role, top right, for each run of lines by the same member.
const runs = [];
for (const l of timeline) {
  const last = runs[runs.length - 1];
  if (last && last.member === l.member) last.to = l.at + (l.to - l.from);
  else runs.push({ member: l.member, from: l.at - 0.2, to: l.at + (l.to - l.from) });
}
for (const r of runs) {
  const m = MEMBERS[r.member];
  draw(m.name, r.from, r.to + 0.3, { font: "fonts/Cinzel.ttf", size: 26, color: "0xFFFFFF", x: "w-text_w-36", y: "68", box: 0.6, border: 10 });
  draw(`${m.role} · voz generada con IA`, r.from, r.to + 0.3, { font: "fonts/segoeui.ttf", size: 18, color: "0xD9C8F0", x: "w-text_w-36", y: "112", box: 0.6, border: 8 });
}
// Subtitles: long lines split at the punctuation nearest the middle, two lines at most on screen.
function wrap(s, max = 54) {
  if (s.length <= max) return s;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - s.length / 2) < Math.abs(best - s.length / 2))) best = i;
  return `${s.slice(0, best)}\n${s.slice(best + 1)}`;
}
function cues(text, a, b) {
  if (text.length <= 100) return [[text, a, b]];
  let best = -1;
  const re = /[.:;,?] /g;
  for (let m; (m = re.exec(text));) if (best < 0 || Math.abs(m.index - text.length / 2) < Math.abs(best - text.length / 2)) best = m.index;
  if (best < 0) return [[text, a, b]];
  const first = text.slice(0, best + 1), second = text.slice(best + 2);
  const split = a + (b - a) * first.length / (first.length + second.length);
  return [[first, a, split], [second, split, b]];
}
for (const l of timeline) {
  for (const [s, a, b] of cues(shown(l.text), l.at, l.at + (l.to - l.from))) {
    draw(wrap(s), a - 0.05, b + 0.15, { font: "fonts/seguisb.ttf", size: 30, color: "0xFFFFFF", x: "(w-text_w)/2", y: "h-text_h-40", align: "C", box: 0.62, border: 12, fade: 0.12 });
  }
}

const inputs = [path.join(CACHE, "trailer.mp4"), broll, ...Object.keys(MEMBERS).map(takeFile), path.join(AUDIO, "musica_menu.mp3")];
const vIdx = Object.fromEntries(Object.keys(MEMBERS).map((m, i) => [m, 2 + i]));
const musicIdx = inputs.length - 1;
const f = [];
f.push(`[0:v]trim=duration=${TRAILER_END},setpts=PTS-STARTPTS,fade=t=out:st=${TRAILER_END - 0.6}:d=0.6[vtr]`);
f.push(`[0:a]atrim=duration=${TRAILER_END},asetpts=PTS-STARTPTS,afade=t=out:st=${TRAILER_END - 1.2}:d=1.2[atr]`);
f.push(`[1:v]fade=t=in:st=0:d=0.6,${draws.join(",")}[vteam]`);
// Voices: each take brought to the same loudness, each line at its moment.
const VOICE_LUFS = -16;
const byMember = {};
timeline.forEach((l, i) => (byMember[l.member] ||= []).push([l, i]));
for (const [member, ls] of Object.entries(byMember)) {
  f.push(`[${vIdx[member]}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${(VOICE_LUFS - loudness(member)).toFixed(1)}dB,asplit=${ls.length}${ls.map(([, i]) => `[s${i}]`).join("")}`);
  for (const [l, i] of ls) {
    const ms = Math.round(l.at * 1000), len = l.to - l.from;
    f.push(`[s${i}]atrim=start=${l.from.toFixed(3)}:end=${l.to.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=${(len - 0.08).toFixed(3)}:d=0.08,adelay=${ms}|${ms}[l${i}]`);
  }
}
f.push(`${timeline.map((_, i) => `[l${i}]`).join("")}amix=inputs=${timeline.length}:normalize=0,volume=1.5,apad,atrim=duration=${teamLength.toFixed(3)},asplit=2[vo][key]`);
// Music: the menu theme, quiet and ducked under the voices, up a little at the end.
f.push(`[${musicIdx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${teamLength.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=1.5,afade=t=out:st=${(teamLength - 2.5).toFixed(3)}:d=2.5,volume=0.45[mus]`);
f.push(`[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400:makeup=1[ducked]`);
f.push(`[vo][ducked]amix=inputs=2:normalize=0[ateam]`);
f.push(`[vtr][atr][vteam][ateam]concat=n=2:v=1:a=1[vcat][acat]`);
f.push(`[acat]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);

const script = path.join(CACHE, "pitch.filter");
fs.writeFileSync(script, f.join(";\n"));
const args = ["-y", "-loglevel", "error"];
inputs.forEach((p, i) => { if (i === musicIdx) args.push("-stream_loop", "-1"); args.push("-i", p); });
const out = path.join(CACHE, "pitch.mp4");
// Video and audio go to separate files in the same run and are joined afterwards: written straight into one MP4,
// the audio came out cut after the first second (FFmpeg 9, this graph).
const videoOnly = path.join(CACHE, "pitch-video.mp4"), audioOnly = path.join(CACHE, "pitch-audio.wav");
args.push("-/filter_complex", script, "-map", "[vcat]", "-an", "-r", String(FPS),
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", videoOnly,
  "-map", "[aout]", "-vn", "-ar", "48000", "-c:a", "pcm_f32le", audioOnly);
run("ffmpeg", args);
run("ffmpeg", ["-y", "-loglevel", "error", "-i", videoOnly, "-i", audioOnly, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out]);
for (const f of [videoOnly, audioOnly]) fs.rmSync(f, { force: true });
const mmss = (s) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };
console.log(`${path.relative(REPO, out)}: ${mmss(total)} (${total.toFixed(1)} s), ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
console.log([...chapters.map((c) => `${c.n === 11 ? "cierre" : c.n} ${mmss(TRAILER_END + c.start)}`), `créditos ${mmss(TRAILER_END + teamLength - END_CARD)}`].join(" · "));
