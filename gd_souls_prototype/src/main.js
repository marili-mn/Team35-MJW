const dt = runtimeScene.getTimeManager().getTimeScale() * (1 / 60);

if (!window.soulsGame) {
// @import 'init/state.js'
// @import 'init/input.js'
// @import 'init/ui.js'
}

const state = window.soulsGame;
const keys = state.keysDown;
const just = state.keysJustPressed;
const pStats = state.playerStats;
const eStats = state.enemyStats;

const playerObjects = runtimeScene.getObjects("Player");
const enemyObjects = runtimeScene.getObjects("Enemy");
const bgObjects = runtimeScene.getObjects("BG");

const player = playerObjects && playerObjects.length > 0 ? playerObjects[0] : null;
const enemy = enemyObjects && enemyObjects.length > 0 ? enemyObjects[0] : null;
const bg = bgObjects && bgObjects.length > 0 ? bgObjects[0] : null;

if (bg) {
  bg.setX(0); bg.setY(0); bg.setWidth(1280); bg.setHeight(720);
}

// @import 'update/player.js'
// @import 'update/enemy.js'
// @import 'update/ui.js'

for (let k in just) { just[k] = false; }
