# Scripts de hackGame (madrugada del 29/09/2026) — solo referencia

Generaron `hackGame.json` (rama `gravity-runner-backup`). Se recuperaron de la transcripción de
esa sesión con `../recover-from-transcript.mjs`.

**Incompletos:** esa sesión también editó estos archivos con `sed` desde la terminal y esos 6-7
cambios no quedaron registrados como ediciones, así que no reproducen exactamente `hackGame.json`.
Tienen rutas fijas de aquella sesión: no se ejecutan tal cual.

Sirven como referencia para:
- `playtest.js`: pruebas automáticas jugando el build en Chrome (base para `tools/gdevelop/test/`);
- `export.js`: exportación con el runtime de la instalación de GDevelop;
- `build.js`: lógica del Nivel1 largo (enemigos, cristales, energía).
