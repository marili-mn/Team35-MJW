// Plays a level of the exported game by itself, frame by frame, pressing the same keys as a player
// through GDevelop's input manager (so every event of the game runs as in a real match).
// Used by the automated playtests (Playwright):
//   await page.addScriptTag({ path: "tools/gdevelop/test/bot.js" });
//   const report = await page.evaluate(() => window.gravityBot.play("Nivel1", { timeout: 300 }));
// It walks right, jumps open-air spikes and saws, flips under ceilings before spike runs, drops before
// hanging spikes or the ceiling's end, attacks enemies ahead, and reports lives lost, crystals and time.
(function () {
  const KEY = { right: 39, space: 32, alt: 18, f: 70 };
  const ALT_LOCATION = 1; // left Alt ("LAlt" in the events)

  function play(sceneName, { timeout = 300 } = {}) {
    return new Promise((resolve) => {
      let started = false, done = false, frames = 0, loaded = 0;
      let map = null, jumpHold = 0, altCooldown = 0, attackCooldown = 0, altUp = false, t0 = null, seconds = 0;
      const held = new Set();
      // GDevelop counts every onKeyPressed as a new press: only send changes, like a real keyboard.
      const hold = (im, key, down) => { if (down && !held.has(key)) { im.onKeyPressed(key); held.add(key); } else if (!down && held.has(key)) { im.onKeyReleased(key); held.delete(key); } };
      let lastLives = null, livesLost = 0, maxX = 0, lastProgressFrame = 0, crystals = "";
      const log = [];
      const finish = (rs, result) => {
        if (done) return;
        done = true;
        const im = rs.getGame().getInputManager();
        for (const k of [KEY.right, KEY.space, KEY.f]) im.onKeyReleased(k);
        im.onKeyReleased(KEY.alt, ALT_LOCATION);
        resolve({ scene: sceneName, crystals, ...result, seconds: Math.round(seconds), livesLost, maxX: Math.round(maxX), log: log.slice(-12) });
      };

      gdjs.registerRuntimeScenePreEventsCallback((rs) => {
        if (done) return;
        if (!started) { started = true; rs.getGame().getSceneStack().replace(sceneName, true); return; }
        const name = rs.getName();
        if (name !== sceneName) {
          if (loaded) finish(rs, { result: name === "GameOver" ? "game over" : `reached ${name}` });
          return;
        }
        if (++loaded < 30) return; // let the scene settle (spawns, title)
        frames++;
        const now = rs.getTimeManager().getTimeFromStart() / 1000;
        if (t0 === null) t0 = now;
        seconds = now - t0;
        const im = rs.getGame().getInputManager();
        const v = rs.getVariables();
        const k = rs.getObjects("kaito")[0];
        const b = k.getBehavior("PlatformerObject");
        const x = k.getX(), flipped = k.isFlippedY(), onFloor = b.isOnFloor();
        const energy = v.get("EnergiaGravedad").getAsNumber();
        const lives = v.get("Vidas").getAsNumber();
        if (lastLives !== null && lives < lastLives) { livesLost += lastLives - lives; log.push(`hit at x=${Math.round(x)} (${flipped ? "up" : "floor"})`); }
        lastLives = lives;
        crystals = `${v.get("Gemas").getAsNumber()}/${v.get("Requeridas").getAsNumber()}`;
        if (x > maxX + 2) { maxX = x; lastProgressFrame = frames; }

        if (!map) {
          const spikes = rs.getObjects("pinchos").map((p) => ({ x0: p.getX() + 8, x1: p.getX() + p.getWidth() - 8, up: p.isFlippedY() }));
          map = {
            ceilings: rs.getObjects("techo").filter((t) => t.getY() > 0).map((t) => ({ x0: t.getX(), x1: t.getX() + t.getWidth() })),
            floor: spikes.filter((s) => !s.up).sort((a, b) => a.x0 - b.x0),
            hanging: spikes.filter((s) => s.up).sort((a, b) => a.x0 - b.x0),
          };
        }
        const ceilingAt = (px) => map.ceilings.find((c) => px - 24 >= c.x0 + 6 && px + 24 <= c.x1 - 6);
        const front = x + 24;
        const nextFloor = map.floor.find((s) => s.x1 > x - 24);
        const nextHanging = map.hanging.find((s) => s.x1 > x - 24);
        const tapAlt = () => { if (altCooldown <= 0) { im.onKeyPressed(KEY.alt, ALT_LOCATION); altUp = true; altCooldown = 40; } };

        if (altUp) { im.onKeyReleased(KEY.alt, ALT_LOCATION); altUp = false; }
        altCooldown--; attackCooldown--;
        hold(im, KEY.right, true);

        if (!flipped) {
          const ceil = ceilingAt(x);
          if (onFloor && nextFloor) {
            const dist = nextFloor.x0 - front;
            const spikeUnderCeiling = map.ceilings.some((c) => nextFloor.x0 >= c.x0 && nextFloor.x1 <= c.x1);
            if (spikeUnderCeiling && ceil && dist > 0 && dist < 160 && energy >= 20) tapAlt();
            else if (!spikeUnderCeiling && dist > 0 && dist <= 30) jumpHold = 9;
          }
          const saw = rs.getObjects("cierra").map((s) => s.getX() + 10 - front).filter((d) => d > -20).sort((a, b) => a - b)[0];
          if (onFloor && saw !== undefined && saw > 0 && saw < 45 && !ceil) jumpHold = 12;
          const enemy = ["ninjapatrullero", "ninjapatrullero2", "enemigo"].flatMap((n) => rs.getObjects(n))
            .map((e) => e.getX() + e.getWidth() / 2 - x).filter((d) => d > -40 && d < 150).sort((a, b) => a - b)[0];
          if (enemy !== undefined && attackCooldown <= 0) { hold(im, KEY.f, true); attackCooldown = 35; } else hold(im, KEY.f, false);
        } else {
          const ceil = ceilingAt(x + 30);
          const landingSafe = !map.floor.some((s) => s.x1 > x - 40 && s.x0 < x + 110);
          const hangingClose = nextHanging && nextHanging.x0 - front < 90 && nextHanging.x0 - front > -10;
          if (landingSafe && (hangingClose || !ceil || energy < 6)) tapAlt();
        }
        hold(im, KEY.space, jumpHold > 0);
        if (jumpHold > 0) jumpHold--;

        if (frames - lastProgressFrame > 300) { // 5 s without moving forward
          const portal = rs.getObjects("puerta")[0];
          const atPortal = portal && Math.abs(portal.getX() + 75 - x) < 140;
          finish(rs, { result: atPortal ? "portal closed (missing crystals)" : "stuck",
            crystals: `${v.get("Gemas").getAsNumber()}/${v.get("Requeridas").getAsNumber()}` });
        }
        if (seconds > timeout) finish(rs, { result: "timeout" });
      });
    });
  }
  window.gravityBot = { play };
})();
