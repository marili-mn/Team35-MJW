// A small pilot for the survival scene's takes (the level bot walks to the wall and stops): Kaito turns to
// the nearest enemy, walks at it, slashes when it is close, jumps saws and shurikens, and keeps going
// until the time is up or he falls. window.survivalPilot(seconds) resolves with what happened.
(function () {
  const KEY = { left: 37, right: 39, space: 32, f: 70 };
  window.survivalPilot = (seconds) => new Promise((resolve) => {
    let started = false, done = false, t0 = null, cool = 0, jump = 0;
    const held = new Set();
    const hold = (im, k, down) => { if (down && !held.has(k)) { im.onKeyPressed(k); held.add(k); } else if (!down && held.has(k)) { im.onKeyReleased(k); held.delete(k); } };
    gdjs.registerRuntimeScenePreEventsCallback((rs) => {
      if (done) return;
      if (!started) { started = true; rs.getGame().getSceneStack().replace("Supervivencia", true); return; }
      if (rs.getName() !== "Supervivencia") return;
      const now = rs.getTimeManager().getTimeFromStart() / 1000;
      if (t0 === null) t0 = now;
      const im = rs.getGame().getInputManager(), k = rs.getObjects("kaito")[0], v = rs.getVariables();
      if (!k) return;
      const x = k.getX();
      const foes = ["ninjapatrullero", "ninjapatrullero2", "ninjarojo", "sombra", "enemigo", "fantasma"].flatMap((n) => rs.getObjects(n)).map((e) => e.getX() + e.getWidth() / 2 - x);
      const near = foes.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      const right = near === undefined ? x < 3000 : near > 0;
      const far = near === undefined || Math.abs(near) > 95;
      hold(im, KEY.right, right && far);
      hold(im, KEY.left, !right && far);
      if (!far && ((right && k.isFlippedX()) || (!right && !k.isFlippedX()))) hold(im, right ? KEY.right : KEY.left, true);   // turn to face it
      if (--cool <= 0 && near !== undefined && Math.abs(near) < 150) { hold(im, KEY.f, true); cool = 22; } else hold(im, KEY.f, false);
      const danger = [...rs.getObjects("cierra"), ...rs.getObjects("shurikenEnemigo")].some((o) => Math.abs(o.getX() + o.getWidth() / 2 - x) < 120);
      if (danger && jump <= 0) jump = 12;
      hold(im, KEY.space, jump-- > 0);
      const over = v.has("Terminado") && v.get("Terminado").getAsNumber() === 1;
      if (now - t0 > seconds || over) {
        done = true;
        for (const key of Object.values(KEY)) im.onKeyReleased(key);
        resolve({ seconds: Math.round(now - t0), over, kills: v.get("Bajas").getAsNumber(), wave: v.get("Oleada").getAsNumber() });
      }
    });
  });
})();
