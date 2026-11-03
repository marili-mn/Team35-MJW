# Gravity Runner: Dash — producción de sonido

El primer sonido del juego era *chiptune*: ondas cuadradas y triangulares sin filtrar, mono a 22 kHz,
sin espacio. Funcionaba, pero sonaba a 8 bits y no al templo japonés que muestra el arte. Este documento
cuenta qué investigamos, qué decidimos y cómo está hecho el sonido nuevo.

## 1. Lo que investigamos

| Tema | Lo que tomamos | Fuente |
|---|---|---|
| Diseño en capas | Un efecto se arma con capas que cumplen una función cada una: **ataque** (el filo), **cuerpo** (qué es) y **cola** (dónde suena). El ataque tiene que empezar en la primera muestra: cualquier silencio se siente como *lag*. | [Violet Recording](https://violetrecording.com/how-to-design-sound-effects-for-games/), [Wayline](https://www.wayline.io/learn/game-audio/1), [Morphic](https://morphic.com/resources/how-to/how-to-layer-sound-effects) |
| Armas | Un *swoosh* es ruido por una banda resonante que se mueve; el filo agrega un anillo metálico (FM o parciales inarmónicos). | [Violet Recording: armas](https://violetrecording.com/how-to-design-weapon-sounds/) |
| Síntesis vs. *samples* | La síntesis procedural ahorra memoria pero cuesta CPU, y suma más de lo que reemplaza. Acá se sintetiza **antes** (offline), así que en el juego no cuesta nada. | [Stolz, HdM Stuttgart](https://curdt.home.hdm-stuttgart.de/PDF/Stolz.pdf) |
| El "zumbido de 8 bits" | Las ondas ingenuas tienen saltos que generan *aliasing* (armónicos que se doblan y suenan ásperos). PolyBLEP los redondea alrededor de cada salto. | [sndkit: BLEP](https://paulbatchelor.github.io/sndkit/blep), [KVR](https://www.kvraudio.com/forum/viewtopic.php?p=5269992) |
| Cuerdas pulsadas (koto, shamisen) | Karplus-Strong: ruido que circula por una línea de retardo de un período; el promedio en el lazo apaga los agudos como una cuerda real. | [Stanford (Lynn)](https://crypto.stanford.edu/~blynn/sound/karplusstrong.html), [CCRMA](https://ccrma.stanford.edu/realsimple/faust_strings/Karplus_Strong_Digitar_Algorithm.html) |
| Tambores (taiko) | Una capa tonal con caída de altura (el golpe) más ruido filtrado (la piel) y un clic (la baqueta). | [Violet Recording: tambores](https://violetrecording.com/how-to-design-drum-sounds-from-scratch/), [Attack Magazine](https://www.attackmagazine.com/technique/tutorials/drum-synthesis-in-logic-es2/2/) |
| Viento (shakuhachi) | Ruido de soplo afinado a la nota, un *chiff* de aire en el ataque, vibrato que entra tarde y notas que "suben" a su altura. | [Scavone, ICMC 96](https://caml.music.mcgill.ca/~gary/papers/icmc96.pdf) |
| Reverb | Freeverb: 8 filtros peine con pasabajos y 4 pasatodos por canal, el derecho 23 muestras más largo. Una sola sala para todo hace que los sonidos convivan en el mismo lugar. | [DSPRelated (J. O. Smith)](https://dsprelated.com/freebooks/pasp/Freeverb.html) |
| Volumen | La sonoridad se mide en LUFS (ITU-R BS.1770); las guías de PlayStation piden −24 LUFS en consola y −18 en portátiles. | [Audiokinetic](https://audiokinetic.com/ko/blog/mastering-a-game-with-wwise-part1), [Designing Sound](https://designingsound.org/2013/02/20/different-loudness-ranges-for-console-and-mobile-games) |
| Formatos en el navegador | Safari no reproduce OGG de forma confiable; MP3 anda en todos. | [Wikipedia](https://en.wikipedia.org/wiki/Ogg_formats_in_HTML5), [frequal](https://frequal.com/java/OggOpusStillNotWorkingInSafari18_4.html) |
| ElevenLabs | Los efectos por IA entran en el plan gratuito (consumen créditos); la música por API es solo de planes pagos. | [ElevenLabs: costo de efectos](https://elevenlabs.io/docs/help-center/product/content-production/sound-effects/how-much-does-it-cost-to-generate-sound-effects), [Music API](https://elevenlabs.io/music-api) |

## 2. Decisiones

- **Síntesis propia en vez de bancos de sonido o IA.** Es original, no tiene licencias que revisar, es
  reproducible (misma semilla, mismas muestras) y se ajusta por código como el resto del juego. ElevenLabs
  queda para la voz del tráiler.
- **Instrumentos japoneses modelados** para que el sonido cuente lo mismo que el arte: koto, shamisen,
  shakuhachi, taiko (odaiko, nagado, shime), campanas de templo y un coro. La música usa la escala *in*
  (miyako-bushi) y la cadencia frigia (bII → i) al final de cada ciclo.
- **Un tema por nivel**: Nivel 1 en Re, 124 BPM; Nivel 2 en La, 132 BPM, con campanas de cristal (las
  losas); Nivel 3 en Mi, 116 BPM, con odaiko y coro (el templo). La Maga Oscura y la supervivencia tienen un
  tema propio a 148 BPM, y el menú y los créditos uno tranquilo. Antes había una sola pista para todo.
- **Efectos en capas** dentro de una sala común. Los efectos frecuentes y ruidosos (salto, katana, golpe,
  dash, enemigo) cambian un poco la altura cada vez (±6 %) para no cansar el oído.
- **Masterizado a un objetivo de sonoridad**: música a −14 LUFS integrados, efectos a −12 LUFS
  momentáneos, todo con limitador a −1 dBFS. En el juego la música suena al 35–45 % del volumen, así que
  queda unos 8 dB debajo de los efectos.
- **Formatos**: los efectos que responden a una tecla son WAV (suenan al instante y se precargan); la
  música y los efectos sin apuro son MP3 (Safari). Todo pesa 6,8 MB.
- **Loops sin costura**: cada tema se renderiza como si ya estuviera sonando en loop. Las colas del final
  (reverb, ecos, notas largas) vuelven al principio y el limitador ve la vuelta completa.

## 3. Cómo está hecho

| Archivo | Qué hace |
|---|---|
| `tools/gdevelop/lib/synth.mjs` | El motor: osciladores PolyBLEP, FM, parciales, ruido blanco, rosa y marrón, filtro de estado variable, Karplus-Strong, flauta, tambores, campanas, gong, *pad*, metales, voces con formantes, Freeverb, eco ping-pong, chorus, limitador con *look-ahead*, sonoridad BS.1770, WAV con *dither*. Sin dependencias. |
| `tools/gdevelop/assets/make-audio.mjs` | La "sesión": instrumentos, 19 efectos y *jingles*, 5 temas, mezcla y masterizado. `node tools/gdevelop/assets/make-audio.mjs` regenera todo en ~1 minuto (o solo los nombres que se le pasen). |
| `tools/gdevelop/lib/ffmpeg.mjs` | Encuentra FFmpeg (variable `FFMPEG`, el PATH o la carpeta de winget) para codificar los MP3. |
| `build/steps/08-audio.mjs` | Declara los 24 archivos, precarga los efectos y engancha música y efectos a los eventos. Si el navegador bloqueó la música al abrir, el menú la arranca con el primer clic o tecla. |
| `build/steps/20-sound-design.mjs` | Los sonidos de lo que vino después: dash, reflejo, espectros, cristales perdidos, puntos de control, nivel superado, oleadas y selector. |
| `test/unit/synth.test.mjs` | Afinación de la cuerda y la flauta, el bending, el filtro, la calibración de sonoridad (1 kHz a −20 dBFS = −20 LUFS), el limitador, la reverb, el loop sin costura y la reproducibilidad. |

### Qué suena y cuándo

| Sonido | Cuándo |
|---|---|
| `salto`, `espada`, `dash`, `gravedad` | Saltar, atacar, atacar corriendo, invertir y volver la gravedad (al volver, más grave). |
| `cristal`, `dispersion` | Juntar un cristal; perder cristales al recibir daño. |
| `golpe`, `enemigo` | Recibir daño; derrotar un enemigo o golpear a la Maga Oscura. |
| `hechizo`, `reflejo`, `espectro` | La maga lanza un hechizo; Kaito lo refleja; aparecen espectros. |
| `checkpoint`, `portal`, `completado` | Punto de control; se abre el portal; nivel superado. |
| `oleada` | Empieza una oleada en la supervivencia. |
| `menu_mover`, `menu_ok` | Moverse en el selector de niveles; reiniciar el progreso. |
| `victoria`, `derrota` | La Victoria (después suena el tema del menú bajo los créditos); el Game Over. |
| `musica_menu`, `musica_nivel` (1 y Tutorial), `musica_nivel2`, `musica_nivel3`, `musica_jefe` | Menú y créditos; cada nivel; la Maga Oscura y la supervivencia. |

## 4. Límites conocidos

- Ni el bot ni las pruebas escuchan: los tests miden afinación, picos, sonoridad y costuras, y se revisaron
  los espectrogramas, pero la mezcla final la tiene que aprobar alguien escuchando.
- El audio HTML5 deja una pausa mínima al repetir un loop (el navegador, no el archivo). Los temas
  arrancan con un golpe de tambor, así que la vuelta queda en el tiempo fuerte.
- Si más adelante se quieren efectos con grabaciones reales (Foley) o por IA, `make-audio.mjs` es el único
  lugar a tocar: el juego solo ve los nombres de archivo.
