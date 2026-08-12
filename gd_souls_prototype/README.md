# GDevelop Souls-like Prototype

Este es un prototipo básico de un juego tipo *Souls-like* creado para GDevelop 5. 

## Características del Prototipo
- **Movimiento fluido:** Controles para moverse (A/D o Flechas) y saltar (Espacio) con gravedad realista.
- **Sistema de Combate:** Ataque básico (J) y esquivar/rodar (K) con consumo de Stamina.
- **Inteligencia Artificial (Jefe):** Un enemigo "Demon Knight" que patrulla, sigue al jugador cuando se acerca, y ataca si está en rango.
- **HUD Integrado (HTML/JS):** Barras de Salud y Stamina dibujadas directamente sobre el canvas del juego usando elementos web nativos para máxima resolución.
- **Lógica Centralizada:** El motor funciona mediante eventos de JavaScript inyectados (`JsCode`).

## ¿Cómo abrir y editar el proyecto?
1. Descarga e instala [GDevelop 5](https://gdevelop.io/download).
2. Abre la aplicación y selecciona **Abrir un proyecto**.
3. Busca el archivo `game.json` o `gd_souls_prototype.json` en esta carpeta y ábrelo.
4. En GDevelop, verás la escena `Arena` y podrás manipular los objetos visuales (Player, Enemy, BG).
5. **Nota sobre la lógica:** La lógica del juego está inyectada en el código fuente. Si haces cambios a los archivos JSON, asegúrate de correr el script de actualización si necesitas recargar la lógica (ver sección abajo).

## ¿Cómo compilar y probar en el navegador (Localhost)?
Para ver el juego en acción con el HUD y la lógica Javascript operando:
1. Asegúrate de tener [Node.js](https://nodejs.org/) instalado.
2. Exporta el juego desde GDevelop usando el gdexporter o simplemente compílalo vía terminal:
   \`\`\`bash
   npx --yes gdexporter game.json dist
   \`\`\`
3. Levanta un servidor web local en la carpeta compilada (\`dist\'):
   \`\`\`bash
   npx --yes serve -p 3000 dist
   \`\`\`
4. Abre `http://localhost:3000` en tu navegador.

## Archivos Importantes
- `assets/`: Contiene los recursos gráficos SVG (protagonista, enemigo, escenario).
- `update-gdevelop.mjs`: Script de Node.js que actualiza e inyecta la lógica de combate y UI al JSON de GDevelop.

---
*Prototipo para el repositorio Team35-MJW.*
