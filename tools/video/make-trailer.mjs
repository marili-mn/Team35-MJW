// Cuts the basic trailer (docs/video/guion.md, section 2) with FFmpeg from the gameplay takes, the ElevenLabs
// voice-over and the game's own music:
//   node tools/video/make-trailer.mjs   ->   tools/video/.cache/trailer.mp4
// Inputs in tools/video/.cache: take-<scene>.webm (tools/video/capture.md), voz-elevenlabs.mp3 (the eight lines
// in one take, cut here at its pauses) and fonts/ (Cinzel from Google Fonts, Yu Gothic for the kanji).
// The edit is data: shots (where each clip comes from), lines (where each sentence of the voice goes) and
// supers (the titles on screen). Music: the menu theme under the title, the Nivel 1 theme, the Dark
// Sorceress's theme from the temple on, and the victory fanfare on the end card, ducked under the voice.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../gdevelop/lib/ffmpeg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const CACHE = path.join(HERE, ".cache");
const AUDIO = path.join(REPO, "GravityRunnerDash", "assets", "audio");
const W = 1280, H = 720, FPS = 30;

const INPUTS = {
  n1: path.join(CACHE, "take-Nivel1.webm"), n2: path.join(CACHE, "take-Nivel2.webm"), n3: path.join(CACHE, "take-Nivel3.webm"),
  sup: path.join(CACHE, "take-Supervivencia.webm"), refl: path.join(CACHE, "take-Reflejo.webm"),
  selector: path.join(REPO, "assets", "landing", "v3", "niveles.jpg"),
  voz: path.join(CACHE, "voz-elevenlabs.mp3"),
  menu: path.join(AUDIO, "musica_menu.mp3"), nivel: path.join(AUDIO, "musica_nivel.mp3"), jefe: path.join(AUDIO, "musica_jefe.mp3"), fanfarria: path.join(AUDIO, "victoria.mp3"),
};
// [source, from, to] in seconds of the take; "title" darkens its clip; "still" and "card" are generated.
const SHOTS = [
  { src: "n3", from: 13, to: 19, title: true },          // 1 · the temple of the Red Moon (title over it)
  { src: "n1", from: 2, to: 7 },                         // 2 · Kaito runs and jumps
  { src: "n1", from: 11, to: 19 },                       // 3 · upside down under the slabs
  { src: "n1", from: 8, to: 12 },                        // 4 · a hit: the crystals fly out
  { src: "n3", from: 51.5, to: 55.5 },                   //     and he gathers them back
  { src: "n2", from: 9, to: 13 },                        // 5 · a ninja's shuriken sent back
  { src: "n3", from: 17.5, to: 20.5 },                   //     ninjas and the sorceress's fire
  { src: "n2", from: 33.5, to: 35.5 },                   //     a ninja on guard up high
  { src: "n3", from: 3.5, to: 8.5 },                     // 6 · "the Dark Sorceress hunts you"
  { src: "refl", from: 3, to: 10 },                      //     her spells come back golden
  { src: "n2", from: 0, to: 2.5 },                       // 7 · the levels...
  { src: "n3", from: 0, to: 2 },
  { still: "selector", seconds: 2 },                     //     ...the level select...
  { src: "sup", from: 14, to: 16.5 },                    //     ...and the survival waves
  { card: true, seconds: 9 },                            // 8 · end card
];
// The voice-over's eight sentences: [from, to] in voz-elevenlabs.mp3 and when each one is heard.
const LINES = [[0.30, 3.65, 0.9], [4.05, 6.45, 6.4], [6.80, 11.55, 11.4], [11.82, 17.42, 19.6], [17.72, 23.20, 27.7], [23.40, 28.42, 36.8], [28.72, 33.66, 48.6], [34.03, 37.64, 57.8]];
// Titles: [text, from, to, style]
const SUPERS = [
  ["影の道", 0.6, 5.6, "kanji"],
  ["EL TEMPLO DE LA LUNA ROJA", 1.3, 5.6, "title"],
  ["INVERTÍ LA GRAVEDAD", 12, 15.6, "super"],
  ["CADA GIRO CUESTA ENERGÍA", 20, 24.6, "super"],
  ["NINJAS · SHURIKENS · ESPECTROS", 28, 33.4, "super"],
  ["LA MAGA OSCURA", 37, 40.6, "super"],
  ["DEVOLVELE SU MAGIA", 42, 46.6, "super"],
  ["3 NIVELES · 97 RECORRIDOS · SUPERVIVENCIA", 49, 55.6, "super"],
  ["GRAVITY RUNNER: DASH", 57.6, 66, "logo"],
  ["Jugalo gratis en el navegador", 58.6, 66, "line1"],
  ["marilidev.itch.io/gravity-runner-dash", 59.2, 66, "link"],
  ["Grupo 35 · Multimedia y Juegos en Web · UNER", 60, 66, "small1"],
  ["Voz: ElevenLabs · Música y sonido originales del juego", 60.4, 66, "small2"],
  ["© 2026 Grupo 35. Todos los derechos reservados.", 60.8, 66, "small3"],
];
const STYLE = {
  kanji: { font: "fonts/YuGothB.ttc", size: 150, color: "0xC8323C", y: "(h-text_h)/2-70" },
  title: { font: "fonts/Cinzel.ttf", size: 44, color: "0xE8C46A", y: "(h)/2+70" },
  super: { font: "fonts/Cinzel.ttf", size: 46, color: "0xE8C46A", y: "h-150", box: true },
  logo: { font: "fonts/Cinzel.ttf", size: 78, color: "0xE8C46A", y: "190" },
  line1: { font: "fonts/Cinzel.ttf", size: 34, color: "0xF2EAD3", y: "300" },
  link: { font: "fonts/segoeui.ttf", size: 30, color: "0xE85A6A", y: "360" },
  small1: { font: "fonts/segoeui.ttf", size: 24, color: "0xC9C2D8", y: "470" },
  small2: { font: "fonts/segoeui.ttf", size: 22, color: "0x9E96B0", y: "510" },
  small3: { font: "fonts/segoeui.ttf", size: 20, color: "0x8A829C", y: "548" },
};

const order = Object.keys(INPUTS);
const idx = (name) => order.indexOf(name);
const fade = (a, b, d = 0.35) => `if(lt(t,${a}),0,if(lt(t,${a + d}),(t-${a})/${d},if(lt(t,${b - d}),1,if(lt(t,${b}),(${b}-t)/${d},0))))`;
const f = [];
const parts = [];
let t = 0;
SHOTS.forEach((s, i) => {
  const v = `v${i}`, a = `a${i}`;
  const norm = `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;
  let len;
  if (s.card) {
    len = s.seconds;
    f.push(`color=c=0x0e0818:s=${W}x${H}:r=${FPS}:d=${len},format=yuv420p,fade=t=in:st=0:d=0.8[${v}]`);
    f.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${len}[${a}]`);
  } else if (s.still) {
    len = s.seconds;
    f.push(`[${idx(s.still)}:v]loop=loop=-1:size=1:start=0,trim=duration=${len},setpts=PTS-STARTPTS,${norm}[${v}]`);
    f.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${len}[${a}]`);
  } else {
    len = s.to - s.from;
    const look = s.title ? ",eq=brightness=-0.22:saturation=0.75,fade=t=in:st=0:d=1.4" : "";
    f.push(`[${idx(s.src)}:v]trim=start=${s.from}:end=${s.to},setpts=PTS-STARTPTS,${norm}${look}[${v}]`);
    f.push(`[${idx(s.src)}:a]atrim=start=${s.from}:end=${s.to},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, len - 0.08)}:d=0.08[${a}]`);
  }
  parts.push(`[${v}][${a}]`);
  t += len;
});
const total = t;
f.push(`${parts.join("")}concat=n=${SHOTS.length}:v=1:a=1[vcat][acat]`);
// titles
const textDir = path.join(CACHE, "text");
fs.mkdirSync(textDir, { recursive: true });
let chain = "[vcat]";
SUPERS.forEach(([text, a, b, style], i) => {
  const st = STYLE[style];
  fs.writeFileSync(path.join(textDir, `${i}.txt`), text);
  const box = st.box ? ":box=1:boxcolor=0x0e0818@0.55:boxborderw=18" : "";
  const out = i === SUPERS.length - 1 ? "[vout]" : `[s${i}]`;
  f.push(`${chain}drawtext=fontfile=${st.font}:textfile=text/${i}.txt:fontsize=${st.size}:fontcolor=${st.color}:x=(w-text_w)/2:y=${st.y}:borderw=2:bordercolor=black@0.55:shadowcolor=black@0.7:shadowx=2:shadowy=3${box}:alpha='${fade(a, Math.min(b, total))}'${out}`);
  chain = out;
});
// voice: the eight sentences, each at its moment
f.push(`[${idx("voz")}:a]aresample=48000,aformat=channel_layouts=stereo,asplit=${LINES.length}${LINES.map((_, i) => `[l${i}]`).join("")}`);
LINES.forEach(([from, to, at], i) => {
  const ms = Math.round(at * 1000);
  f.push(`[l${i}]atrim=start=${from}:end=${to},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${(to - from - 0.12).toFixed(2)}:d=0.12,adelay=${ms}|${ms}[lv${i}]`);
});
f.push(`${LINES.map((_, i) => `[lv${i}]`).join("")}amix=inputs=${LINES.length}:normalize=0,volume=1.6,apad=whole_dur=${total},asplit=2[vo][vokey]`);
// music: [input, from, length, at, fade in, fade out]
const MUSIC = [["menu", 0, 6.4, 0, 1.6, 0.5], ["nivel", 0, 30.4, 6, 0.15, 0.5], ["jefe", 0, 21.4, 36, 0.1, 0.6], ["fanfarria", 0, 6.5, 56.6, 0, 1.2], ["menu", 4, 9, 61.5, 2.5, 2.5]];
MUSIC.forEach(([src, from, len, at, fin, fout], i) => {
  const ms = Math.round(at * 1000);
  f.push(`[${idx(src)}:a]atrim=start=${from}:end=${from + len},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=${fin || 0.01},afade=t=out:st=${(len - fout).toFixed(2)}:d=${fout},adelay=${ms}|${ms}[m${i}]`);
});
f.push(`${MUSIC.map((_, i) => `[m${i}]`).join("")}amix=inputs=${MUSIC.length}:normalize=0,volume=0.7[music]`);
f.push(`[music][vokey]sidechaincompress=threshold=0.04:ratio=7:attack=15:release=350:makeup=1[ducked]`);
f.push(`[acat]volume=0.55[sfx]`);

const script = path.join(CACHE, "trailer.filter");
fs.writeFileSync(script, f.join(";\n"));
const out = path.join(CACHE, "trailer.mp4");
// Two passes. The first writes the picture and the three audio stems (voice, ducked music, game sounds) to
// separate files; the second mixes and masters the stems and joins them with the picture. Mixed inside the
// same graph as the picture, the audio came out cut after its first second (FFmpeg 9).
const tmp = (name) => path.join(CACHE, `trailer-${name}`);
const stems = ["vo", "ducked", "sfx"];
const args = ["-y", "-loglevel", "error"];
for (const name of order) args.push("-i", INPUTS[name]);
args.push("-/filter_complex", script, "-map", "[vout]", "-an", "-r", String(FPS),
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", tmp("video.mp4"));
for (const stem of stems) args.push("-map", `[${stem}]`, "-vn", "-ar", "48000", "-c:a", "pcm_f32le", tmp(`${stem}.wav`));
process.chdir(CACHE);
run("ffmpeg", args);
run("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp("video.mp4"), ...stems.flatMap((stem) => ["-i", tmp(`${stem}.wav`)]),
  "-filter_complex", `[1:a][2:a][3:a]amix=inputs=3:normalize=0,apad,atrim=duration=${total},afade=t=out:st=${total - 1.5}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`,
  "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]);
for (const name of ["video.mp4", ...stems.map((stem) => `${stem}.wav`)]) fs.rmSync(tmp(name), { force: true });
console.log(`${path.relative(REPO, out)}: ${total.toFixed(1)} s, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
