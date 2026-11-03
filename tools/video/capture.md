# Tomas de gameplay para el tráiler

Se graban del juego exportado (`node tools/gdevelop/build.mjs --export`, servido en `127.0.0.1:47281`) desde
Playwright, con la ventana en 1280 × 720:

1. `page.addScriptTag({ path: "tools/gdevelop/test/bot.js" })` y `page.addScriptTag({ path: "tools/video/recorder.js" })`
   (y `tools/video/survive.js` para la supervivencia). Un clic en la página antes, para que el navegador deje
   sonar el audio.
2. `window.__take = { scene: "Nivel1", seconds: 50, shots: [["flip", 30], ["@6", 0]] }` y `browser_run_code` con
   `tools/video/take.js`: el bot juega mientras se graba el lienzo con los efectos de sonido del juego; las
   fotos salen la primera vez que aparece cada momento (`flip`, `spell`, `reflect`, `drop`, `wraith`, `enemy`,
   o `@segundos`).
3. Las tomas quedan en `tools/video/.cache/take-<escena>.webm` (VP8, 30 cuadros por segundo) y las fotos en
   `assets/landing/v3/`.
