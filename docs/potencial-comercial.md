# Gravity Runner: Dash — cómo llevarlo a un juego vendible

Investigación del 2 y 3/11/2026 sobre qué hace que un plataformas 2D se sienta bien y qué necesita para
venderse, y qué se aplicó al juego a partir de eso.

## 1. Qué dice la investigación

### Sensación de control ("game feel")

- **Coyote time**: dejar saltar un instante después de pisar el borde. Se usan ventanas de 0,05 a 0,1 s.
- **Jump buffer**: si el salto se aprieta justo antes de tocar el piso, se hace en el cuadro en que aterriza.
- Las dos son parte de las técnicas que el director de *Celeste* (Matt Thorson) contó como claves para que
  el juego se sintiera justo pese a ser difícil.
- En nuestro playtest, **los controles fueron lo peor puntuado (3,43/5)** y el 57 % los sintió resbaladizos:
  es el punto más importante a cuidar.

### "Jugo" (juice)

- La charla *The Art of Screenshake* (Jan Willem Nijman, Vlambeer) recorre efectos como el destello al
  impactar, el retroceso, la pausa de impacto (*hit pause*), la permanencia y la cámara suave.
- Las guías coinciden en usarlos **con medida y proporcionales al golpe**: más sacudida y más pausa para
  los golpes grandes; si no, distraen.

### Lo que vende

- **La portada (cápsula) es el recurso más importante**: es lo que se ve al navegar la tienda y decide el
  clic. Tiene que leerse en tamaño chico (en Steam, 120×45 px).
- **El tráiler tiene que mostrar qué hace el jugador en los primeros segundos**: sin logos largos ni
  cinemáticas vagas.
- **itch.io**: portada de 630×500 (o 315×250), al menos 3–5 capturas *de juego* (no de menús),
  descripción, género y etiquetas; para juegos web la imagen detrás del botón *Run* es de 640×360.
  Para empezar se recomienda gratis o "pagá lo que quieras": construir público vale más que la primera
  recaudación.
- Etiquetas específicas mejor que genéricas ("2D Platformer", "Pixel Graphics").
- **Referente de la mecánica**: *VVVVVV* (inversión de gravedad). Lo elogiado: una mecánica simple y
  adictiva pensada como centro del diseño, el estilo visual y la música. Lo criticado: la dificultad
  empinada y que los controles cuestan al principio.

## 2. Qué se aplicó (iteraciones del 3/11)

| # | Mejora | Por qué |
|---|---|---|
| 1 | Sacudida de cámara, pausa de impacto, destello rojo al recibir daño, partículas (cristales, enemigos, maga, polvo al aterrizar) | *Juice*: cada golpe se siente y se lee en pantalla. |
| 2 | Jump buffer (0,15 s) y coyote time (0,1 s) | El punto más flojo del playtest: los controles. |
| 3 | Pausa con P/Esc (M vuelve al menú) | Básico en cualquier juego a la venta. |
| 4 | Reloj en el HUD y tarjeta de resultados por nivel (tiempo, cristales, golpes, rango S/A/B/C, récord guardado) | Rejugabilidad: invita a mejorar el tiempo y el rango. |

Antes de estas iteraciones: escala coherente de personajes y la maga que persigue a Kaito por todo el
Nivel 3.

## 3. Hoja de ruta para venderlo

**Para la entrega del 10/11 (itch.io)**
- Portada 630×500 con Kaito invirtiendo la gravedad y el título legible en chico.
- 3–5 capturas de juego (la maga, la inversión, la tarjeta de resultados) y un GIF corto.
- Descripción con el gancho en la primera línea: *"Un ninja que corre por los techos: invertí la
  gravedad, juntá cristales y escapá de la maga que te persigue por todo el templo."*
- "Pagá lo que quieras" con mínimo 0, etiquetas específicas.
- Tráiler de 30–60 s que muestre gameplay desde el primer segundo.

**Siguiente versión**
- Mando (gamepad) y controles táctiles (en itch muchos entran desde el celular).
- Volumen por separado en vez de solo ON/OFF, remapeo de teclas.
- Modo asistido (más vidas o menos velocidad): la crítica a *VVVVVV* fue la dificultad.
- "Continuar" y selector de niveles con el récord y el rango de cada uno.
- Más variedad: plataformas móviles, zonas de gravedad, una fase extra de la maga.

**A más largo plazo**
- Página de Steam en "Próximamente" para juntar *wishlists*, demo para un Steam Next Fest.
- Versiones de escritorio y Android (GDevelop exporta a las dos).

## Fuentes

- [Celeste & Forgiveness — Maddy Makes Games](https://maddymakesgames.com/articles/celeste_and_forgiveness/)
- [Celeste dev explains how they made their game feel — GameSpot](https://www.gamespot.com/articles/celeste-dev-explains-how-they-made-their-game-feel/1100-6474775/)
- [Advanced jump (coyote time) — GDevelop wiki](https://wiki.gdevelop.io/gdevelop5/extensions/advanced-jump/)
- [GDevelop Coyote Time Example — Silver-Streak](https://silver-streak.itch.io/gd5-coyote-time-example)
- [Behind the Code — GMTK Platformer Toolkit](https://gmtk.itch.io/platformer-toolkit/devlog/395523/behind-the-code)
- [The Art of Screenshake recreation — DK Liao](https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog/451576/quick-breakdown-of-all-the-effects)
- [Squeezing more juice out of your game design — Game Developer](https://gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design-)
- [Camera shake — GDevelop wiki](https://wiki.gdevelop.io/gdevelop5/extensions/camera-shake/)
- [Steam page optimization guide — presskit.gg](https://presskit.gg/field-guides/steam-page-optimization-guide)
- [Steam Next Fest 2026 retrospective — GamineAI](https://gamineai.com/blog/steam-next-fest-2026-retrospective-most-wishlisted-games-differently)
- [How to Launch Your Game on itch.io (2026 Guide) — Cinevva](https://app.cinevva.com/guides/itch-io-launch-guide.html)
- [itch.io page image templates — hedgiespresso](https://hedgiespresso.itch.io/itch-page-image-templates)
- [VVVVVV — Wikipedia](https://en.wikipedia.org/wiki/VVVVVV)
- [VVVVVV review — Nintendo Life](https://www.nintendolife.com/reviews/eshop/vvvvvv)
