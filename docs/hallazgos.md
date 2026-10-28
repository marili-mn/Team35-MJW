# Hallazgos — estado del proyecto antes del prototipo de 3 niveles

Relevamiento del 27/10/2026, antes de empezar la rama `feat/three-level-prototype`.
Objetivo: saber de dónde sale cada versión del juego, qué se puede reutilizar y qué falta
para la entrega del **3 de noviembre**.

## 1. Qué pide la entrega

Mensaje del profesor (27/09): para el 3/11 hay que presentar

1. el **prototipo con 3 niveles**,
2. el **GDD**,
3. el **video speech de presentación**.

La idea de la cátedra es devolvernos comentarios para ajustar antes de las fechas siguientes.

## 2. Iteraciones del juego

Hay tres proyectos de GDevelop. Todas las medidas se sacaron leyendo los `.json` directamente.

| Iteración | Ubicación | Escenas | Qué tiene |
|---|---|---|---|
| **A. Original del equipo** | `sprint2Juegos/copiagdevelop/copiaparachicos/Gravity Runner_ Dash - Copy - Copy.json` | 9 | Menú, opciones, tutorial, 3 niveles, victoria, game over. Arte completo, casi sin lógica. |
| **B. hackGame** (madrugada del 29/09) | `sprint2Juegos/Team35-MJW-jorgelinamendieta-gdevelop/GravityRunnerDash/hackGame.json` y rama `gravity-runner-backup` | 5 | Reconstrucción hecha por script cuando no aparecía el proyecto original. Tutorial y Nivel1 largos y probados, con sprites propios (`hack_assets/`). |
| **C. Repo** | `GravityRunnerDash/GravityRunnerDash.json` (`main` = `develop`) | 9 | Es A con menú y opciones funcionando y un tutorial nuevo. Es lo que está publicado. |

### Eventos e instancias por escena

| Escena | A (original) | B (hackGame) | C (repo) |
|---|---|---|---|
| Menú / Título | 0 eventos | 2 eventos | 3 eventos |
| Opciones | 0 eventos | — | 5 eventos |
| Tutorial | 19 eventos · 1303 px | 38 eventos · 4544 px | 59 eventos · **6400 px** |
| Nivel1 | 3 eventos · 1283 px | **38 eventos · 6464 px** | 3 eventos · 1283 px |
| Nivel2 | 0 eventos · 1287 px | — | 0 eventos · 1287 px |
| Nivel3 | 0 eventos · 1282 px | — | 0 eventos · 1282 px |
| Victoria / Final | vacía | 2 eventos | vacía |
| GameOver | 1 evento | 1 evento | 1 evento |

**Conclusión:** la "build con 3 niveles" es la del repo, pero sus niveles son los de A sin
tocar: una pantalla de largo cada uno y sin lógica de juego. El único nivel jugable de verdad
es el Nivel1 de B, que sirve de referencia para la lógica (no para el arte).

## 3. La versión de itch.io sale del repo

Se comparó el `data.js` de la build publicada (`GravityRunner_AlphaGame_v1.0_itch.zip`)
contra `GravityRunnerDash.json` de `main`:

- instancias, objetos, animaciones y los 298 recursos: **idénticos**;
- el código compilado incluye los arreglos hechos por script (bloqueo del ALT, bajar del
  techo, doble toque para correr);
- única diferencia: el formato. El IDE (GDevelop **5.6.283**) re-guardó el proyecto al
  exportar; el repo estaba en 5.6.269.

## 4. Recuperación del baseline (scripts que generaron el juego)

Los scripts que construyeron menú, opciones y tutorial vivían en una carpeta temporal de la
sesión y se borraron. Se recuperaron reproduciendo, en orden, cada escritura y edición
registrada en la transcripción de la sesión:

| Sesión | Recuperado | Estado |
|---|---|---|
| 29/09 tarde (repo actual) | `build_menu_opciones.mjs`, `build_tutorial.mjs`, `export.mjs`, `slice_ninja.ps1` y scripts de exploración de la API | **Completo**: es la versión final que generó lo que está en `main`. |
| 29/09 madrugada (hackGame) | `build.js`, `validate.js`, `export.js`, `playtest.js`, `prep.ps1` | **Incompleto**: esa sesión también editó con `sed` desde la terminal, y esos 6-7 cambios no quedaron como ediciones. |

Lecciones:

- los scripts dependían de `gdcore-tools` en el caché de `npx`, que se limpió;
- la sesión de la madrugada cargaba libGD desde la instalación de GDevelop (misma versión que
  el IDE), que es más preciso que `gdcore-tools` (5.6.269);
- todo script que genere el juego tiene que vivir en el repo (`tools/`).

## 5. Estado técnico del juego en el repo

### Funciona (verificado con pruebas automáticas en el navegador)

- menú (jugar, opciones, salir) y opciones (sonido y música ON/OFF como variables globales);
- tutorial de 5 secciones con cámara, 10 pistas de texto, 24 cristales con contador,
  4 checkpoints, 3 vidas con reaparición, animación de muerte y portal a Nivel1;
- caminar, correr con doble toque, saltar, atacar (F) y la gravedad invertida con ALT;
- 8 animaciones de Kaito (idle, walk, run, jump, fall, wounded, death, attack) cortadas de
  `Ninjas.zip` a 128×128 y alineadas por los pies.

### Problemas conocidos

| Problema | Causa |
|---|---|
| La antigravedad saca a Kaito del mapa | Invertir sin techo encima lo manda hacia arriba sin límite; hoy solo se corrige perdiendo una vida. El detector `detectodetecho` existe pero nunca se conectó a la inversión. |
| La energía no limita nada | Invertir cuesta 5 y cada cristal da 10; nunca se llega a 0. |
| Salto demasiado alto | `jumpSpeed` 1000 con gravedad 1000: sube unos 500 px. |
| Hitbox de los pinchos generoso | La máscara cubre casi toda la imagen; Kaito tiene una máscara de 85×120 dentro de un cuadro de 128. |
| La extensión FlipGravity no baja con la misma tecla | Bug de la extensión; está resuelto con eventos propios (detección antes de la extensión y `Reset` después). |
| La extensión pisa las animaciones | Cambia la animación cada cuadro y la reinicia; está neutralizado pasándole índices inexistentes (99). |
| Chrome se roba el ALT | Resuelto con un evento JavaScript que hace `preventDefault`. |

## 6. Assets disponibles

### Enemigos y obstáculos

| Asset | Dónde | Detalle |
|---|---|---|
| `ninjapatrullero` | objeto de Nivel1 | Animación de 32 cuadros. Definido pero sin instancias. |
| `ninjapatrullero2` | objeto en Nivel1, 2 y 3 | Animación de 22 cuadros. Una instancia por nivel, sin lógica. |
| `enemigo.png` | `assets/nivel1/assets de escena/` | Imagen fija de 1254×1254. |
| `ninja_azul_1024x512.png` | `assets/nivel1/` | Hoja de sprites sin usar. |
| `cierra.png` | `assets/nivel1/assets de escena/` | Sierra (1401×1123), usable como trampa. |
| `pinchos`, `pinchocorto` | tutorial y Nivel3 | Trampas fijas. |

### La maga (futuro boss final)

| Asset | Tamaño | Contenido según el GDD |
|---|---|---|
| `wizardConcept2.png` | 1264×848 | 4 filas: idle, caminar, ataque con báculo, ataque cargado. |
| `wizardConcept.png` | 1264×847 | Secuencia de casteo de 16 cuadros con proyectil elemental. |

Son hojas de concepto, no spritesheets listos: hay que cortarlas igual que se hizo con Kaito.

### Recursos sin usar

El proyecto declara **135 imágenes que ningún objeto usa**: fondos alternativos
(`fondoTutorialdia.png`, `fondonivel3.png`), pisos, el título del menú, cuadros sueltos de
Kaito y la hoja del ninja azul. Son candidatos a reutilizar o a limpiar.

## 7. Decisiones para esta iteración

- La maga es el **boss final** (Nivel3).
- Los enemigos se **sortean en cada reinicio** entre los disponibles.
- Los niveles son **iguales o más largos que el tutorial** (≥ 6400 px), con dificultad creciente.
- Hitboxes lo más precisos posible, mecánicas balanceadas y jugables, y márgenes seguros de
  estabilidad (validación automática antes de cada entrega).
- El IDE de GDevelop se usa **solo para visualizar, comprobar y exportar**. Todo cambio al
  juego se hace por script, así que regenerar escenas no pisa trabajo manual.
- Flujo: `feat/three-level-prototype` → `develop` → `main` → ZIP nuevo para itch.io con
  imagen de portada de 630×500.
- Organización del grupo en Notion.
