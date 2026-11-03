# Auditoría del proyecto — 3/11/2026

Revisión completa del repo después de la recta final: qué hay, qué está bien y qué conviene mejorar,
ordenado por prioridad. Las cifras se midieron sobre el commit de esta auditoría.

## 1. Visión general

| Parte | Qué es | Tamaño |
|---|---|---|
| Landing (`index.html`, `css/`, `js/`) | GDD publicado en Vercel, pestañas v1 GDD y v2 Pre-Alfa | 993 líneas |
| Juego (`GravityRunnerDash/`) | Proyecto de GDevelop **generado** por los pasos + recursos | 11 escenas, 5537 instrucciones, 308 archivos (79 MB) |
| Pipeline (`tools/gdevelop/`) | `build.mjs`, 19 pasos, 10 módulos de `lib/`, 4 generadores de recursos, bot, tests | ~4350 líneas |
| Documentación (`docs/`) | `hallazgos`, `potencial-comercial`, `integraciones-y-enfoque`, esta auditoría | — |

## 2. Lo que está bien

- **Reproducible y revisable**: el juego se regenera desde el proyecto original del equipo; cada paso
  explica qué cambia y por qué; `--check` detecta cualquier diferencia; los niveles salen de semillas.
- **Falla fuerte en vez de romper en silencio**: los pasos buscan los eventos por su contenido y abortan
  con un mensaje claro si no los encuentran; el build valida instrucciones y compila cada escena antes de
  escribir.
- **Tres capas de pruebas** (unitarias, invariantes del proyecto, bot): 21 tests en ~0,2 s que ya
  encontraron un bug real (fosos con la última plataforma corta).
- **Diseño de niveles como datos** (`lib/layout.mjs`): se puede generar, testear y dibujar sin GDevelop.
- **Sin dependencias instaladas**: Node y la instalación de GDevelop alcanzan.
- **Sin secretos en el repo**; lo guardado por el juego vive en el navegador del jugador.

## 3. Qué mejorar

### Alta prioridad (antes de publicar o de la entrega final)

1. **Peso de la descarga.** Las escenas usan una parte de los recursos declarados; quedan unos 100
   archivos sin uso (cuadros viejos y duplicados) y los fondos son PNG grandes sin comprimir. El ZIP de itch
   pesa 84,6 MB: en el navegador es una carga larga y hay gente que se va antes de jugar. El ninja rojo y el
   ninja sombra ya usan parte de lo que no se usaba. *Propuesta*: un paso que quite los recursos no
   referenciados y comprimir los PNG sin pérdida visible. Estimado: menos de la mitad.
2. ~~El GDD de la landing está desactualizado.~~ **Resuelto**: pestaña v3 · Prototipo con el estado actual
   y el manifiesto de desarrollo.
3. **El balance está verificado solo con el bot, y el Nivel 3 quedó exigente.** Con los ninjas nuevos el bot
   completa el Nivel 1 (1:01, sin golpes) y el 2 (1:21, 2 golpes). En el 3 llega al templo (1:42) pero la
   Maga Oscura le gana: la mayoría de sus golpes vienen de ella. Antes de los ninjas nuevos le ganó en una de
   dos partidas. Si las personas lo sienten injusto, las perillas son los pesos de `06-levels.mjs` y
   `PACE`/`UPPER` de `22-agile-enemies.mjs`. Falta que lo juegue una persona y, si se puede, un segundo
   playtest con el mismo formulario (en el primero, controles 3,43/5).
4. **El bot es un oráculo limitado.** No trepa torres ni junta los cristales de arriba, a veces pisa
   sierras y no sabía atacar espectros (corregido). Si el bot falla no siempre es el juego: hay que
   mirar el detalle de cada golpe (el harness ya lo registra).

### Prioridad media (calidad del código)

1. **Helpers repetidos**: `has` en 10 archivos, `warn` en 5, `clock` y `text` en 3. Llevarlos a
   `lib/events.mjs` (y el formateo de tiempo `m:ss` a una sola función).
2. **Constantes repetidas**: la clave de guardado `"GravityRunnerDash"` en 4 pasos, los colores del HUD
   (dorado, gris) en varios, y los textos visibles dispersos por todo el código. Un `lib/ui.mjs` con
   colores y claves, y un `lib/textos.mjs` con los textos, prepararía además la versión en inglés.
3. **Acoplamiento entre pasos**: cada paso encuentra eventos de pasos anteriores por su contenido. Es
   robusto (avisa si no los encuentra) pero hace que reordenar o cambiar un paso viejo pueda romper a
   otro. *Propuesta*: documentar en cada paso de qué eventos depende, o marcarlos (un comentario de
   evento con un id) para buscarlos por marca.
4. **`lib/level.mjs` sigue siendo grande**: los ninjas nuevos y su comportamiento ya viven en
   `lib/enemies.mjs`; falta mover ahí también a los enemigos originales (azul, verde, guardia, sierra,
   espectro).
5. **Validación del build**: los chequeos que hoy están en los tests (objetos sin tipo, colores sin
   comillas) podrían correr también en `build.mjs` para no escribir nunca un proyecto así.
6. **Las pruebas de juego no son automáticas**: hoy se corren desde Playwright a mano. Un
   `tools/gdevelop/test/play.mjs` que levante el export, juegue cada nivel N veces y deje un reporte
   JSON las volvería repetibles por cualquiera del equipo.
7. **Integración continua**: los tests de `layout` y `png` no necesitan GDevelop; un GitHub Action que
   los corra en cada push evitaría subir un nivel imposible.

### Prioridad baja (limpieza)

1. Ocho ramas `deploy-*` viejas (y `prototypes`, `prototypes-modularized`): borrar o dejar un tag.
2. `tools/gdevelop/reference/` (scripts recuperados de una sesión vieja): la historia ya está en git.
3. Carpeta vacía `gd_souls_prototype/` en la copia local.
4. Avisos de fin de línea LF/CRLF en cada commit: un `.gitattributes` (`* text=auto eol=lf`) los
   elimina.
5. El servidor de pruebas: `npx serve` se cae tras muchas recargas; el README ya recomienda
   `python -m http.server`.

### Producto

Lo que falta para venderlo (mando, controles táctiles, inglés, volumen, modo asistido, tráiler, página
de Steam) está en `potencial-comercial.md`.
