# Team35-MJW — Gravity Runner: Dash

Plataformas 2D hecho en GDevelop para la Tecnicatura (UNER). Kaito, un ninja, corre por templos y cuevas
invirtiendo la gravedad para caminar por los techos.

- Juego publicado: https://marilidev.itch.io/gravity-runner-dash
- Landing / GDD: https://team35-mjw.vercel.app/

## Estructura

| Carpeta | Qué hay |
|---|---|
| `index.html`, `css/`, `js/` | Landing con el GDD (pestañas v1 GDD y v2 Pre-Alfa). Se publica desde la raíz. |
| `assets/` | Imágenes de la landing: galería, animaciones de Kaito, katana, shuriken y la maga (`assets/wizard/`). |
| `GravityRunnerDash/` | El juego: proyecto de GDevelop (`GravityRunnerDash.json`) y sus recursos en `assets/`. |
| `tools/gdevelop/` | Scripts que construyen el juego a partir del proyecto original del equipo. |
| `docs/` | Documentación: `integraciones-y-enfoque.md` (cómo está hecho y cómo se prueba), `potencial-comercial.md`, `hallazgos.md`. |

## Cómo se construye el juego

El proyecto no se edita a mano: `tools/gdevelop/build.mjs` parte del proyecto original del equipo (commit
`a964ae5`), aplica en orden los pasos de `tools/gdevelop/build/steps/` y valida todo antes de escribir.
El motor sale de la instalación local de GDevelop, así que siempre coincide con el IDE. No instala nada en el repo.

```sh
node tools/gdevelop/build.mjs            # construye, valida y escribe GravityRunnerDash/GravityRunnerDash.json
node tools/gdevelop/build.mjs --check    # construye y compara con el archivo actual, sin escribir
node tools/gdevelop/build.mjs --export   # además exporta un HTML5 a tools/gdevelop/.cache/export
node --test tools/gdevelop/test/         # tests: reglas de los niveles, PNG y chequeos del proyecto construido
```

| Paso | Qué hace |
|---|---|
| `01-menu-options` | Menú y opciones de sonido y música. |
| `02-tutorial` | Tutorial de 6400 px con pistas, cristales, checkpoints, vidas y animaciones de Kaito. |
| `03-physics-and-gravity-rules` | Física, hitboxes y reglas para invertir la gravedad (techo y energía). |
| `04-damage-and-lives` | Daño sin volver al checkpoint, invulnerabilidad, autocuración y corazones. |
| `05-tutorial-layout-fixes` | Ajustes del tutorial encontrados con el bot de salto. |
| `06-levels` | Niveles 1, 2 y 3 (y el oculto) de 1,5 pantallas de alto, generados por `lib/layout.mjs` desde un perfil de dificultad con semilla; tramos y enemigos que se sortean en cada reinicio, portal que se abre con cristales. |
| `07-victory-credits` | Pantalla de Victoria con los créditos del equipo. |
| `08-audio` | Música y efectos de sonido (respetan las opciones del menú): un tema por nivel, otro para la jefa y la supervivencia, y otro para el menú y los créditos. |
| `09-game-feel` | Sacudida de cámara, pausa de impacto, destello rojo al recibir daño y partículas. |
| `10-forgiving-jump` | Jump buffer (0,15 s) y coyote time (0,1 s). |
| `11-pause` | Pausa con P o Esc; M vuelve al menú. |
| `12-level-results` | Reloj en el HUD y tarjeta de resultados por nivel (tiempo, cristales, golpes, rango y récord). |
| `13-camera-and-checkpoints` | La cámara se adelanta 150 px hacia donde mira Kaito; los puntos de control se anuncian. |
| `14-continue` | Cada nivel se guarda al empezar y el menú ofrece "Continuar" (clic o C). |
| `15-platforms-and-gravity` | Superficie de las losas, techo de seguridad y gravedad más cara de nivel en nivel. |
| `16-kaito-moves` | Salto y giro de gravedad con sprites propios; ataque dash al atacar corriendo. |
| `17-survival` | Nivel oculto de supervivencia en oleadas; se abre al ganar el juego. |
| `18-level-select` | Selector de niveles (bloqueados, récords, rangos), botón "ELEGIR NIVEL" y reiniciar progreso. |
| `19-dropped-crystals` | Al recibir daño se caen hasta 3 cristales que se pueden recuperar. |
| `20-sound-design` | Sonidos de lo que vino después del paso 08: dash, reflejo, espectros, cristales perdidos, puntos de control, nivel superado, oleadas y selector. |
| `21-screen-fit` | La vista queda en 1280×720 con bandas negras en ventanas de otra forma (antes se veían bandas blancas más allá del arte). |
| `22-agile-enemies` | Ninja rojo y ninja sombra; todos los ninjas saltan, embisten, tiran shurikens reflejables y montan guardia arriba; desde el Nivel 2 aparecen los 7 tipos. |
| `23-intro-crawl` | La primera vez que se toca JUGAR, la historia y los créditos suben como introducción antes del Tutorial (flechas ↑ ↓ para desplazar, SALTAR o Espacio para empezar, Esc para volver al menú); después JUGAR entra directo. |

Cómo está hecho cada paso, el diseño procedural de los niveles y las pruebas: `docs/integraciones-y-enfoque.md`. Por qué cada mejora de jugabilidad y la hoja de ruta para venderlo: `docs/potencial-comercial.md`.

La lógica compartida está en `tools/gdevelop/lib/`: `layout.mjs` describe los niveles como datos (segmentos, pisos, tramos sorteados), `level.mjs` los convierte en escenas, `boss.mjs` hace a la Maga Oscura y `scenes.mjs` dice qué escenas se juegan. La Maga Oscura persigue a Kaito por todo el Nivel 3, se vuelve más agresiva a medida que pierde vidas, invoca espectros y sus hechizos se pueden reflejar con la katana. Todos los personajes miden lo mismo que Kaito (120 px). Los recursos que se generan por script están en `tools/gdevelop/assets/`: `slice-maga.mjs` recorta los sprites de la maga, `make-audio.mjs` compone y sintetiza la música y los efectos con el motor de `lib/synth.mjs` (instrumentos japoneses modelados, efectos en capas, reverb y masterizado; ver `docs/sonido.md`), `make-flip.mjs` dibuja el giro de gravedad de Kaito, `make-fantasma.mjs` los espectros y `make-sombra.mjs` el ninja sombra. `lib/enemies.mjs` tiene el plantel de ninjas y su comportamiento. El GDD completo en un PDF (v3, v2 y v1, de la más nueva a la más vieja) se genera con `tools/gdd/pdf.js` desde Playwright, con la landing servida en el puerto 58913. El tráiler y el video pitch se arman con `tools/video/` (grabación del juego con el bot, voces de ElevenLabs y montaje con FFmpeg: `make-trailer.mjs` y `make-pitch.mjs`; ver `docs/video/guion.md`). El logo de la UNER de los créditos (`GravityRunnerDash/assets/creditos/logo-uner.png`) es la versión blanca del sitio de la universidad.

## Probarlo en local

```sh
node tools/gdevelop/build.mjs --export
python -m http.server 47281 --directory tools/gdevelop/.cache/export   # juego en http://localhost:47281
npx serve -l 58913 .                              # landing en http://localhost:58913
```

La versión que se sube a itch.io se exporta desde el IDE de GDevelop (File → Export → Web).

`tools/gdevelop/test/bot.js` juega un nivel solo, apretando las mismas teclas que un jugador (en el Nivel 3 también pelea con la maga: la ataca, salta sus hechizos y embestidas y la persigue en el templo). Se inyecta en la página del juego con Playwright y se llama con `window.gravityBot.play("Nivel1")`; devuelve si llegó al portal, los golpes recibidos, los cristales y el tiempo.

## Controles

← → caminar (doble toque para correr) · Espacio saltar · Alt invertir la gravedad (bajo un techo, gasta energía) · F atacar (corriendo: dash) · P o Esc pausa

Menú: Jugar (desde el tutorial) · ELEGIR NIVEL o N · CONTINUAR o C. En el selector: flechas y Enter, R dos veces para reiniciar el progreso.
