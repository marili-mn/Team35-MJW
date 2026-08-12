# GDevelop Souls-like Prototype ⚔️

Este proyecto es un prototipo técnico desarrollado en **GDevelop 5** que implementa las bases de un juego de acción y combate con mecánicas inspiradas en el género *Souls-like*.

---

## 📜 Game Design Document (GDD) / Concept

### 1. Resumen del Concepto
Un juego de acción 2D en vista lateral centrado en combates estratégicos y medidos, donde el jugador debe gestionar cuidadosamente sus recursos (vida y *stamina*) para enfrentar a enemigos formidables. No se trata de machacar botones, sino de observar patrones, atacar en el momento preciso y evadir castigos mortales.

### 2. Core Loop (Ciclo Principal)
1. **Observar:** Estudiar el comportamiento y tiempo de ataque del enemigo.
2. **Posicionamiento:** Mantener una distancia segura gestionando la *stamina*.
3. **Acción:** Rodar (esquivar) a través de los ataques enemigos y contraatacar cuando su guardia esté baja.
4. **Castigo:** Si el jugador se queda sin *stamina* o se equivoca en los tiempos, recibe daño crítico. Si triunfa, avanza.

### 3. Mecánicas Principales (Sistema de Combate)
- **Stamina (Energía):** Toda acción ofensiva o evasiva consume *stamina*. Se regenera pasivamente cuando el jugador no está atacando ni rodando. Si la *stamina* llega a cero, el jugador queda expuesto.
- **Ataque (Costo: 20 Stamina):** Un golpe cuerpo a cuerpo básico. Interrumpe brevemente al enemigo (micro-stagger). 
- **Rodar / Esquivar (Costo: 30 Stamina):** Desplazamiento horizontal rápido que otorga `frames de invulnerabilidad` (i-frames). Crucial para sobrevivir a los ataques del jefe.
- **Gravedad y Movimiento:** Salto con peso y caídas predecibles para un control exacto.

### 4. Personajes y Entidades
#### Jugador (Blue Knight)
- **Vida Base:** 100 HP
- **Stamina Base:** 100 SP
- **Estilo:** Rápido, dependiente de evadir y encontrar ventanas de oportunidad.

#### Jefe (Demon Knight)
- **Vida Base:** 60 HP (Balance de prototipo)
- **Daño por Golpe:** 18 HP
- **Comportamiento (IA):**
  - Fase de Patrulla: Camina de un lado a otro en su territorio.
  - Fase de Agresión: Si el jugador entra en su rango (380px), empieza a perseguirlo de manera implacable.
  - Cooldown de Ataque: Posee un *delay* entre sus ataques para que el jugador tenga ventanas para esquivar o castigar (1.4s).

### 5. Estética y Arte (Assets)
- **Estilo Visual:** Vectorial minimalista de alto contraste (neones/brillos sobre fondos oscuros).
- **HUD Integrado:** Interfaz dibujada de manera súper nítida utilizando HTML/JS nativo sobre el canvas (Vida en gradiente rojo carmesí, Stamina en gradiente esmeralda). 
- **Assets (SVG):**
  - `bg.svg`: Arena sombría, paredes de piedra y antorchas encendidas.
  - `player.svg`: Caballero estilizado de armadura oscura con detalles celestes y espada de luz.
  - `enemy.svg`: Caballero gigante con ojos rojos y un espadón corrupto.

---

## 🎮 Controles
- **Mover:** `A` / `D` o `Flecha Izquierda` / `Flecha Derecha`
- **Saltar:** `ESPACIO`
- **Atacar:** `J` (Consume 20 SP)
- **Rodar / Esquivar:** `K` (Consume 30 SP)

---

## ⚙️ Notas de Desarrollo Técnico

### Arquitectura Híbrida
A diferencia de los proyectos de GDevelop puramente basados en el editor visual, este prototipo inyecta **JavaScript puro (`BuiltinCommonInstructions::JsCode`)** directamente en el archivo JSON. Esto permite:
1. Una gestión de estados y diccionarios mucho más robusta (`window.soulsGame`).
2. Implementación de una interfaz UI superpuesta del lado del DOM de la web (HTML5) para una máxima calidad y resolución, liberando al motor gráfico (PixiJS) de manejar fuentes y rectángulos nativos.

### Despliegue Local
1. Compilar los assets a HTML5:
   \`\`\`bash
   npx --yes gdexporter game.json dist
   \`\`\`
2. Levantar el servidor:
   \`\`\`bash
   npx --yes serve -p 3000 dist
   \`\`\`
3. Abrir `http://localhost:3000` en un navegador web moderno.
