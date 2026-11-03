// In-page recorder for the trailer's gameplay takes (loaded with page.addScriptTag next to the bot): records
// the game canvas, with the game's sound effects (Howler's master gain; the music streams outside it), using
// MediaRecorder, and counts the frames worth a still: Kaito upside down, a spell in flight, a reflected
// spell, crystals dropping, a wraith. tools/video/capture.md explains how the takes are shot.
(function () {
  let rec = null, chunks = [], watching = false;
  const marks = {};
  function watch() {
    if (watching) return;
    watching = true;
    gdjs.registerRuntimeScenePreEventsCallback((rs) => {
      const count = (n) => { marks[n] = (marks[n] || 0) + 1; };
      const has = (...names) => names.some((n) => rs.getObjects(n).length > 0);
      marks.scene = rs.getName();
      const k = rs.getObjects("kaito")[0];
      if (k && k.isFlippedY()) count("flip");
      if (has("maga") && has("hechizo", "dragonSombra")) count("spell");
      if (has("hechizoReflejado", "dragonReflejado")) count("reflect");
      if (has("cristalCaido")) count("drop");
      if (has("fantasma")) count("wraith");
      if (has("ninjapatrullero", "ninjapatrullero2", "enemigo")) count("enemy");
      const v = rs.getVariables(), scale = rs.getTimeManager().getTimeScale();
      if (scale > 0 && scale < 0.5) { count("slow"); marks.hitStop = v.has("HitStop") ? v.get("HitStop").getAsNumber() : null; }
    });
  }
  function start({ fps = 30, bitrate = 8e6 } = {}) {   // VP8 at 8 Mbps: light enough to encode while the game runs
    watch();
    for (const k of Object.keys(marks)) delete marks[k];
    const stream = document.querySelector("canvas").captureStream(fps);
    try {
      const dest = Howler.ctx.createMediaStreamDestination();
      Howler.masterGain.connect(dest);
      stream.addTrack(dest.stream.getAudioTracks()[0]);
    } catch (e) { /* no sound effects in the take */ }
    const type = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    chunks = [];
    rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bitrate });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.start(1000);
    return type;
  }
  // Stops and hands the take to the browser as a download (Playwright saves it).
  function stop(name) {
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" }), a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        resolve(blob.size);
      };
      rec.stop();
    });
  }
  window.trailerRec = { start, stop, marks };
})();
