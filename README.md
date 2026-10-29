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
| `docs/` | Documentación del desarrollo (`hallazgos.md`). |

## Cómo se construye el juego

El proyecto no se edita a mano: `tools/gdevelop/build.mjs` parte del proyecto original del equipo (commit
`a964ae5`), aplica en orden los pasos de `tools/gdevelop/build/steps/` y valida todo antes de escribir.
El motor sale de la instalación local de GDevelop, así que siempre coincide con el IDE. No instala nada en el repo.

```sh
node tools/gdevelop/build.mjs            # construye, valida y escribe GravityRunnerDash/GravityRunnerDash.json
node tools/gdevelop/build.mjs --check    # construye y compara con el archivo actual, sin escribir
node tools/gdevelop/build.mjs --export   # además exporta un HTML5 a tools/gdevelop/.cache/export
```

| Paso | Qué hace |
|---|---|
| `01-menu-options` | Menú y opciones de sonido y música. |
| `02-tutorial` | Tutorial de 6400 px con pistas, cristales, checkpoints, vidas y animaciones de Kaito. |
| `03-physics-and-gravity-rules` | Física, hitboxes y reglas para invertir la gravedad (techo y energía). |
| `04-damage-and-lives` | Daño sin volver al checkpoint, invulnerabilidad, autocuración y corazones. |
| `05-tutorial-layout-fixes` | Ajustes del tutorial encontrados con el bot de salto. |
| `06-levels` | Niveles 1, 2 y 3 (16 640, 23 040 y 26 880 px) armados por segmentos, con enemigos que se sortean en cada reinicio y portal que se abre con cristales. |
| `07-victory-credits` | Pantalla de Victoria con los créditos del equipo. |
| `08-audio` | Música y efectos de sonido (respetan las opciones del menú). |

La lógica compartida está en `tools/gdevelop/lib/` (`level.mjs` genera los niveles y `boss.mjs` hace a la maga, jefa final del Nivel 3). Los recursos que se generan por script están en `tools/gdevelop/assets/`: `slice-maga.mjs` recorta los sprites de la maga y `make-audio.mjs` sintetiza la música y los efectos.

## Probarlo en local

```sh
node tools/gdevelop/build.mjs --export
npx serve -l 47281 tools/gdevelop/.cache/export   # juego en http://localhost:47281
npx serve -l 58913 .                              # landing en http://localhost:58913
```

La versión que se sube a itch.io se exporta desde el IDE de GDevelop (File → Export → Web).

`tools/gdevelop/test/bot.js` juega un nivel solo, apretando las mismas teclas que un jugador. Se inyecta en la página del juego con Playwright y se llama con `window.gravityBot.play("Nivel1")`; devuelve si llegó al portal, los golpes recibidos, los cristales y el tiempo.

## Controles

← → caminar (doble toque para correr) · Espacio saltar · Alt invertir la gravedad (bajo un techo, gasta energía) · F atacar
