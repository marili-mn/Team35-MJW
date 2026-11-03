# Gravity Runner: Dash — integraciones y enfoque

Cómo está construido el juego, qué se le agregó en la recta final (2 y 3 de noviembre de 2026) y cómo
se prueba. Complementa `hallazgos.md` (punto de partida) y `potencial-comercial.md` (investigación y
hoja de ruta para venderlo).

## 1. El enfoque: el juego se genera, no se edita a mano

El proyecto de GDevelop (`GravityRunnerDash/GravityRunnerDash.json`) **no se toca en el IDE**: el IDE
solo se usa para mirarlo, probarlo y exportarlo. Todo cambio es un script:

- `tools/gdevelop/build.mjs` parte del proyecto original del equipo (commit `a964ae5`), aplica en orden
  los pasos de `tools/gdevelop/build/steps/` y valida antes de escribir (cada instrucción existe y cada
  escena compila).
- El motor es **libGD**, sacado de la instalación local de GDevelop: el resultado coincide siempre con
  la versión del IDE (hoy 5.6.286). No se instala nada en el repo.
- Es **reproducible**: la misma entrada da el mismo archivo, byte a byte (`build.mjs --check` lo compara
  sin escribir). Los niveles salen de semillas fijas, así que también son reproducibles.
- Cada mejora es un **paso nuevo** con un comentario arriba que explica qué cambia y por qué. Si un paso
  necesita un evento que ya existe, lo busca por su contenido y falla con un mensaje claro si no lo
  encuentra (nunca edita "a ciegas" por posición).

```sh
node tools/gdevelop/build.mjs            # construye, valida y escribe el proyecto
node tools/gdevelop/build.mjs --check    # construye y compara, sin escribir
node tools/gdevelop/build.mjs --export   # además exporta un HTML5 a tools/gdevelop/.cache/export
node --test tools/gdevelop/test/         # tests (sección 4)
```

## 2. Arquitectura

| Carpeta / archivo | Qué hace |
|---|---|
| `build.mjs` | Orquesta los pasos, valida, compara y exporta. |
| `build/steps/NN-*.mjs` | Un paso por mejora, en orden (tabla en el README). |
| `lib/engine.mjs` | Carga libGD y las extensiones de la instalación de GDevelop. |
| `lib/events.mjs` | Helpers para escribir eventos (`ev`, `I`, `setNum`…) y buscarlos por contenido. |
| `lib/objects.mjs` | Animaciones, máscaras de colisión, textos, copiar objetos entre escenas. |
| `lib/layout.mjs` | **Los niveles como datos** (sin GDevelop): segmentos, pisos, sorteos, generador por semilla. |
| `lib/level.mjs` | Convierte un layout en una escena: arte, colisionadores, enemigos, portal, sorteo de tramos. |
| `lib/boss.mjs` | La Maga Oscura. |
| `lib/scenes.mjs` | Qué escenas son niveles, cuál es la supervivencia y cuáles se juegan (una sola lista). |
| `lib/png.mjs` | Leer y escribir PNG y medir dónde empieza la superficie de una imagen. |
| `lib/enemies.mjs` | Los ninjas: el rojo y la sombra, saltos, embestidas, shurikens reflejables, guardias arriba. |
| `lib/synth.mjs` | El motor de sonido: osciladores, filtros, cuerdas pulsadas, flauta, tambores, reverb, limitador, LUFS. |
| `lib/ffmpeg.mjs` | Encuentra FFmpeg (PATH, variable `FFMPEG` o la carpeta de winget). |
| `assets/*.mjs` | Recursos generados por código: música y efectos, la maga recortada, el giro de Kaito, los espectros, el ninja sombra. |
| `test/bot.js` | El bot que juega un nivel apretando las mismas teclas que una persona (refleja o salta los shurikens). |
| `test/unit/*.test.mjs` | Tests unitarios y del proyecto construido. |
| `../video/*` | Grabación de tomas del juego (con el bot) y montaje del tráiler con FFmpeg. |

## 3. Integraciones de la recta final

| Paso / módulo | Qué agrega | Por qué |
|---|---|---|
| `09-game-feel` | Sacudida de cámara, pausa de impacto, destello rojo, partículas | *Juice*: que cada golpe se sienta (Vlambeer, Celeste). |
| `10-forgiving-jump` | Jump buffer 0,15 s y coyote time 0,1 s | Los controles fueron lo peor del playtest (3,43/5). |
| `11-pause` | Pausa con P/Esc, M vuelve al menú | Básico de un juego terminado. |
| `12-level-results` | Reloj, tarjeta de resultados, rango S/A/B/C, récord | Rejugabilidad. |
| `13-camera-and-checkpoints` | Cámara que mira adelante y sigue a Kaito en vertical; puntos de control avisados | Ver venir los peligros; niveles más altos que la pantalla. |
| `14-continue` | "Continuar" desde el último nivel | No empezar de cero al cerrar la pestaña. |
| `15-platforms-and-gravity` | Superficie de las losas, techo de seguridad, gravedad más cara por nivel | Kaito se hundía en las losas y podía salirse de la pantalla; pedido de "nerfear" la gravedad. |
| `16-kaito-moves` | Salto y giro de gravedad con sprites distintos, ataque dash al correr | Que cada movimiento se lea distinto. |
| `17-survival` | Nivel oculto de supervivencia, se abre al ganar | Modo sin fin pedido para después del juego. |
| `18-level-select` | Selector de niveles con bloqueados, récords y rangos; botón en el menú; reiniciar progreso | Elegir dónde empezar a medida que se avanza. |
| `19-dropped-crystals` | Al recibir daño se caen hasta 3 cristales recuperables | Riesgo y recompensa; nunca quedan sobre pinchos y si vencen reaparecen. |
| `lib/layout.mjs` + `06-levels` | Niveles de 1,5 pantallas en tres pisos, plataformas sobre fosos, torres, shurikens; generados por semilla con dificultad creciente y **tramos que se sortean en cada reinicio** | Niveles más procedurales, menos repetitivos y que escalan. |
| `lib/boss.mjs` | Maga Oscura: más vidas, furia creciente, ráfagas, invoca espectros, hechizos reflejables | Jefa más difícil y más agresiva a medida que pierde vida. |
| `lib/level.mjs` | Espectros de energía oscura; todos los personajes a 120 px | Enemigo nuevo; escala coherente. |
| `08-audio` + `20-sound-design` + `lib/synth.mjs` | Sonido producido: instrumentos japoneses modelados, un tema por nivel, 21 efectos en capas, masterizado en LUFS (`docs/sonido.md`) | El sonido sonaba a 8 bits; pedido de que el salto suene a ninja. |
| `21-screen-fit` | Vista fija de 1280×720 con bandas negras y fondo oscuro en todas las escenas | En ventanas más anchas que 16:9 se veían bandas blancas al jugar. |
| `22-agile-enemies` + `lib/enemies.mjs` | Ninja rojo (hoja del equipo sin usar) y ninja sombra (original, generado); saltos, embestidas, pausas, shurikens reflejables, guardias sobre losas y torres; los 7 tipos desde el Nivel 2 | Pedidos: más enemigos y más variedad, más agilidad, shurikens reflejables, enemigos arriba. |

### Niveles procedurales, en detalle

- Un nivel es una **secuencia de segmentos** (`start`, `jump`, `flip`, `pit`, `tower`, `zigzag`,
  `enemies`, `saw`, `bonus`, `end`, `arena`). `generateSequence(perfil)` la arma a partir de un perfil de
  dificultad y una semilla: los perfiles crecen de nivel en nivel (filas de pinchos y fosos más largos,
  más alternativas, más enemigos y más rápidos, más cristales para abrir el portal).
- Un **slot** es un tramo con 2 o 3 alternativas: todas se construyen en el mismo lugar con la marca
  `Variante = slot·10 + alternativa`, y al empezar la escena se sortea una y se borran las otras, antes
  de contar cristales o leer las zonas de enemigos. El Nivel 3 tiene 81 recorridos posibles.
- **Tres pisos**: el piso; las losas (se cruzan invertido sobre filas de pinchos y tienen superficie
  para pararse); los techos altos a 600 px con cristales y shurikens dorados, a los que se llega
  invirtiendo la gravedad desde arriba de una losa o caminando invertido hasta el final de una.
- **Cristales**: el portal pide una parte de los del camino; los de arriba (techos altos, escalones
  superiores de las torres) suman para el rango.

## 4. Calidad: tres capas de pruebas

1. **Tests unitarios** (`node:test`, el runner de Node, sin dependencias) de la lógica pura:
   - `layout.test.mjs` revisa **todas las combinaciones de sorteo** de cada nivel contra las reglas
     encontradas con el bot: filas de pinchos bajo una losa con 190 px de margen, ninguna losa sobre un
     pincho para saltar, fosos cubiertos por plataformas sin huecos de más de 80 px, ventana en el piso
     bajo cada pincho colgante, cristales y shurikens suficientes, puntos de control, dificultad
     creciente y build reproducible.
   - `png.test.mjs`: lectura y escritura de PNG, medición de superficies.
2. **Invariantes del proyecto construido** (`project.test.mjs`): cada objeto tiene tipo, los colores
   van entre comillas, los cambios de escena van a escenas que existen, los objetos que se crean existen,
   cada imagen está en disco, cada escena jugable tiene un Kaito con todas sus animaciones, la cámara y
   el límite de caída coinciden con el tamaño del nivel, cada losa tiene su superficie, las plataformas
   son atravesables y cada tramo sorteado se sortea.
3. **Pruebas de juego** con el bot en el navegador (Playwright): juega cada nivel apretando teclas
   reales, pelea con la Maga Oscura, y reporta si llegó, tiempo, golpes y cristales.

Los tests ya encontraron bugs reales: en los fosos de 5 pinchos o más la última plataforma terminaba
antes del final del foso, y un loop de música tenía un clic en la vuelta. Hoy son 32 tests; el más nuevo
revisa que cada ninja muestre todos sus movimientos y que sus shurikens dañen y se puedan reflejar.

### Trampas de libGD / GDevelop aprendidas (y cubiertas por los tests donde se puede)

- Los colores de las acciones van entre comillas (`"255;0;0"`); sin ellas el tinte queda negro.
- `InstructionsList.remove()` recibe la instrucción; por índice es `removeAt()`. `push_back` deja la
  instrucción antes de la última: usar `append()` de `lib/events.mjs`.
- `serializeObject()` ya devuelve `{type, element}`; el validador no detecta objetos sin tipo.
- En expresiones, un salto de línea es `NewLine()` (no `\n`). Color de texto: `TextObject::ChangeColor`;
  de sprite: `ChangeColor`. Orden Z: `SetZOrder`. Tipo de plataforma: propiedad `PlatformType`.
- Comparar un temporizador que nunca se inició da falso: hay que iniciarlo al empezar la escena.
- La cámara adelantada se calcula desde Kaito y recién después se limita al nivel (si se suma a la
  cámara ya trabada en el borde, Kaito queda fuera de pantalla).
- `npx serve` se cae con muchas recargas (EMFILE); para probar conviene `python -m http.server`.
- La precarga de un audio se activa con `updateProperty("Preload as sound", "1")` (el nombre visible de la
  propiedad, y `"1"`, no `"true"`).
- Cada escena corta todos los sonidos al empezar (`stopSoundsOnStartup`); el selector de niveles lo tiene
  apagado para que siga el tema del menú. El navegador no deja sonar nada hasta el primer clic o tecla: el
  menú arranca la música en ese momento si no pudo antes.
- Con `adaptWidth` el juego ensanchaba la vista según la ventana y mostraba el fondo de la escena más allá
  del arte: la vista ahora es fija.
- En FFmpeg 9 el grafo de filtros desde un archivo es `-/filter_complex archivo` (`-filter_complex_script`
  ya no existe).

## 5. Cómo agregar algo nuevo

1. Un paso nuevo `NN-algo.mjs` con su comentario (qué y por qué) que exporte una función
   `({ gd, project, gameDir }) => resumen`.
2. `node tools/gdevelop/build.mjs --export` y `node --test tools/gdevelop/test/`.
3. Si toca el recorrido, jugar el nivel con el bot; si toca lo que se ve, una captura.
4. Commit local con el porqué en el mensaje.
