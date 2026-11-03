// One gameplay take for the trailer, run from Playwright (browser_run_code with this file): the bot plays a
// scene while the recorder films it; stills are taken the first time a moment shows up (see recorder.js).
// The scene, length and stills come from window.__take, set before running this file.
async (page) => {
  const { scene, seconds, shots, still = "assets/landing/v3", out = "tools/video/.cache" } = await page.evaluate(() => window.__take);
  await page.evaluate(() => window.trailerRec.start());
  const run = page.evaluate(([s, t]) => window.gravityBot.play(s, { timeout: t }), [scene, seconds]);
  const t0 = Date.now(), taken = [];
  let finished = false;
  run.then(() => { finished = true; });
  while (!finished && Date.now() - t0 < (seconds + 10) * 1000) {
    const m = await page.evaluate(() => ({ ...window.trailerRec.marks }));
    const elapsed = (Date.now() - t0) / 1000;
    for (const [mark, min] of shots) {
      const ready = mark.startsWith("@") ? elapsed >= Number(mark.slice(1)) : (m[mark] || 0) >= min;
      if (ready && !taken.includes(mark)) {
        taken.push(mark);
        await page.locator("canvas").screenshot({ path: `${still}/${scene.toLowerCase()}-${mark.replace("@", "t")}.jpg`, type: "jpeg", quality: 85 });
      }
    }
    await page.waitForTimeout(120);
  }
  const report = await run;
  const [download] = await Promise.all([page.waitForEvent("download"), page.evaluate((n) => window.trailerRec.stop(n), `take-${scene}.webm`)]);
  await download.saveAs(`${out}/take-${scene}.webm`);
  return { scene, result: report.result, seconds: report.seconds, crystals: report.crystals, livesLost: report.livesLost, stills: taken, marks: await page.evaluate(() => ({ ...window.trailerRec.marks })) };
}
