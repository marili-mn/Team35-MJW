import fs from 'fs';
import path from 'path';

const jsCodeContent = `const dt = runtimeScene.getTimeManager().getTimeScale() * (1 / 60);

if (!window.soulsGame) {
  window.soulsGame = {
    isInitialized: false,
    playerStats: {
      health: 100, maxHealth: 100, stamina: 100, maxStamina: 100, staminaRegen: 25,
      invincibleTimer: 0, facing: 1, velocityY: 0, isGrounded: true,
      isAttacking: false, attackTimer: 0, isDodging: false, dodgeTimer: 0, dodgeDir: 1
    },
    enemyStats: {
      health: 60, maxHealth: 60, facing: -1, patrolDir: -1, patrolMinX: 450, patrolMaxX: 950,
      attackCooldown: 0, isHitTimer: 0, isDead: false
    },
    keysDown: {},
    keysJustPressed: {}
  };

  window.addEventListener('keydown', (e) => {
    const code = e.code || e.key;
    if (!window.soulsGame.keysDown[code]) {
      window.soulsGame.keysJustPressed[code] = true;
    }
    window.soulsGame.keysDown[code] = true;
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code || e.key;
    window.soulsGame.keysDown[code] = false;
    window.soulsGame.keysJustPressed[code] = false;
  });

  const container = document.createElement('div');
  container.id = 'souls-ui-container';
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  container.style.zIndex = '9999';
  container.innerHTML = \`<div style="position: absolute; top: 16px; left: 16px; display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: #ff4455; font-weight: bold; width: 70px; font-size: 14px;">SALUD</span>
        <div style="width: 300px; height: 18px; background: rgba(0,0,0,0.6); border: 2px solid #ff4455; border-radius: 4px; overflow: hidden;">
          <div id="hp-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #ff2244, #ff6688); transition: width 0.1s ease-out;"></div>
        </div>
        <span id="hp-text" style="color: #ffffff; font-weight: bold; font-size: 14px;">100 / 100</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: #00ff88; font-weight: bold; width: 70px; font-size: 14px;">STAMINA</span>
        <div style="width: 300px; height: 18px; background: rgba(0,0,0,0.6); border: 2px solid #00ff88; border-radius: 4px; overflow: hidden;">
          <div id="stamina-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #00aa55, #00ff88); transition: width 0.1s ease-out;"></div>
        </div>
        <span id="stamina-text" style="color: #ffffff; font-weight: bold; font-size: 14px;">100 / 100</span>
      </div>
    </div>
    <div id="enemy-hud" style="position: absolute; top: 16px; right: 24px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
      <span style="color: #ff3344; font-weight: bold; font-size: 16px; text-shadow: 0 0 8px #000;">BOSS: DEMON KNIGHT</span>
      <div style="width: 320px; height: 16px; background: rgba(0,0,0,0.7); border: 2px solid #ff2244; border-radius: 4px; overflow: hidden;">
        <div id="enemy-hp-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #990022, #ff0044); transition: width 0.1s ease-out;"></div>
      </div>
    </div>
    <div style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); background: rgba(10, 10, 20, 0.85); border: 1px solid #444466; padding: 10px 24px; border-radius: 8px; color: #ddddff; font-size: 14px; text-align: center;">
      <strong style="color: #ffcc00;">CONTROLES:</strong> &nbsp;
      <span style="background: #2a2a40; padding: 2px 8px; border-radius: 4px;">A / D</span> o <span style="background: #2a2a40; padding: 2px 8px; border-radius: 4px;">← / →</span> Mover &nbsp;|&nbsp;
      <span style="background: #2a2a40; padding: 2px 8px; border-radius: 4px;">ESPACIO</span> Saltar &nbsp;|&nbsp;
      <span style="background: #ffaa00; color: #000; padding: 2px 8px; border-radius: 4px; font-weight: bold;">J</span> Atacar (20 Stamina) &nbsp;|&nbsp;
      <span style="background: #00d2ff; color: #000; padding: 2px 8px; border-radius: 4px; font-weight: bold;">K</span> Rodar (30 Stamina)
    </div>
    <div id="status-modal" style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 10000; text-align: center;">
      <h1 id="status-title" style="font-size: 56px; font-weight: 900; letter-spacing: 4px; margin: 0;"></h1>
      <p id="status-sub" style="font-size: 20px; color: #cccccc; margin-top: 12px;"></p>
      <button onclick="window.location.reload()" style="margin-top: 20px; padding: 12px 28px; background: #ffaa00; border: none; border-radius: 6px; color: #000; font-weight: bold; font-size: 16px; cursor: pointer; pointer-events: auto;">REINTENTAR</button>
    </div>\`;
  document.body.appendChild(container);
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

if (player && pStats.health > 0) {
  let px = player.getX();
  let py = player.getY();

  if (!pStats.isDodging) {
    if (keys['KeyA'] || keys['ArrowLeft']) {
      px -= 320 * dt; pStats.facing = -1; player.flipX(true);
    } else if (keys['KeyD'] || keys['ArrowRight']) {
      px += 320 * dt; pStats.facing = 1; player.flipX(false);
    }
    if ((just['Space'] || keys['Space']) && pStats.isGrounded) {
      pStats.velocityY = -550; pStats.isGrounded = false;
    }
  }

  px = Math.max(20, Math.min(1140, px));

  if (!pStats.isGrounded) {
    pStats.velocityY += 1400 * dt; py += pStats.velocityY * dt;
    if (py >= 410) { py = 410; pStats.velocityY = 0; pStats.isGrounded = true; }
  } else { py = 410; }

  if ((just['KeyJ'] || just['Keyj']) && !pStats.isAttacking && !pStats.isDodging) {
    if (pStats.stamina >= 20) {
      pStats.stamina -= 20; pStats.isAttacking = true; pStats.attackTimer = 0.25;
      if (enemy && !eStats.isDead) {
        const distToEnemy = Math.abs((px + 64) - (enemy.getX() + 64));
        if (distToEnemy <= 150 && Math.sign((enemy.getX() + 64) - (px + 64)) === pStats.facing) {
          eStats.health -= 25; eStats.isHitTimer = 0.3;
          enemy.setX(enemy.getX() + pStats.facing * 35);
        }
      }
    }
  }

  if (pStats.isAttacking) {
    pStats.attackTimer -= dt;
    if (pStats.attackTimer <= 0) pStats.isAttacking = false;
  }

  if ((just['KeyK'] || just['Keyk']) && !pStats.isDodging && !pStats.isAttacking) {
    if (pStats.stamina >= 30) {
      pStats.stamina -= 30; pStats.isDodging = true; pStats.dodgeTimer = 0.35;
      pStats.dodgeDir = pStats.facing; pStats.invincibleTimer = 0.45;
    }
  }

  if (pStats.isDodging) {
    pStats.dodgeTimer -= dt;
    px += pStats.dodgeDir * 600 * dt;
    px = Math.max(20, Math.min(1140, px));
    if (pStats.dodgeTimer <= 0) pStats.isDodging = false;
  }

  if (pStats.invincibleTimer > 0) {
    pStats.invincibleTimer -= dt; player.setOpacity(140);
  } else { player.setOpacity(255); }

  if (!pStats.isAttacking && !pStats.isDodging && pStats.stamina < pStats.maxStamina) {
    pStats.stamina = Math.min(pStats.maxStamina, pStats.stamina + pStats.staminaRegen * dt);
  }

  player.setX(px); player.setY(py);
}

if (enemy) {
  if (eStats.health <= 0) {
    if (!eStats.isDead) {
      eStats.isDead = true; enemy.hide(true);
      const m = document.getElementById('status-modal');
      const t = document.getElementById('status-title');
      const s = document.getElementById('status-sub');
      if (m) { m.style.display = 'flex'; t.style.color = '#ffcc00'; t.innerText = 'VICTORIA LOGRADA'; s.innerText = 'Has derrotado al Caballero Demoníaco.'; }
    }
  } else if (player && pStats.health > 0) {
    let ex = enemy.getX(), ey = 410;
    const playerCenterX = player.getX() + 64, enemyCenterX = ex + 64;
    const distToPlayer = Math.abs(enemyCenterX - playerCenterX);

    if (eStats.isHitTimer > 0) { eStats.isHitTimer -= dt; enemy.setOpacity(150); }
    else { enemy.setOpacity(255); }

    if (distToPlayer < 380) {
      eStats.facing = playerCenterX > enemyCenterX ? 1 : -1;
      enemy.flipX(eStats.facing === -1);
      if (distToPlayer > 80) { ex += eStats.facing * 140 * dt; }
      else {
        if (eStats.attackCooldown <= 0) {
          eStats.attackCooldown = 1.4;
          if (pStats.invincibleTimer <= 0) {
            pStats.health -= 18;
            if (pStats.health <= 0) {
              pStats.health = 0; player.hide(true);
              const m = document.getElementById('status-modal');
              const t = document.getElementById('status-title');
              const s = document.getElementById('status-sub');
              if (m) { m.style.display = 'flex'; t.style.color = '#ff2244'; t.innerText = 'HAS MUERTO'; s.innerText = 'Tu alma ha sido consumida.'; }
            }
          }
        }
      }
    } else {
      ex += eStats.patrolDir * 90 * dt;
      if (ex <= eStats.patrolMinX) { eStats.patrolDir = 1; enemy.flipX(false); }
      else if (ex >= eStats.patrolMaxX) { eStats.patrolDir = -1; enemy.flipX(true); }
    }

    if (eStats.attackCooldown > 0) eStats.attackCooldown -= dt;
    enemy.setX(ex); enemy.setY(ey);
  }
}

const hpFill = document.getElementById('hp-bar-fill');
const hpText = document.getElementById('hp-text');
const staminaFill = document.getElementById('stamina-bar-fill');
const staminaText = document.getElementById('stamina-text');
const enemyHpFill = document.getElementById('enemy-hp-fill');

if (hpFill) hpFill.style.width = \`\${Math.max(0, (pStats.health / pStats.maxHealth) * 100)}%\`;
if (hpText) hpText.innerText = \`\${Math.max(0, Math.ceil(pStats.health))} / \${pStats.maxHealth}\`;
if (staminaFill) staminaFill.style.width = \`\${Math.max(0, (pStats.stamina / pStats.maxStamina) * 100)}%\`;
if (staminaText) staminaText.innerText = \`\${Math.max(0, Math.ceil(pStats.stamina))} / \${pStats.maxStamina}\`;
if (enemyHpFill) enemyHpFill.style.width = \`\${Math.max(0, (eStats.health / eStats.maxHealth) * 100)}%\`;

for (let k in just) { just[k] = false; }
`;

function processFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  if (data.layouts && data.layouts.length > 0) {
    const layout = data.layouts[0];
    
    // Set customSize true on all instances so GDevelop IDE renders them clearly
    layout.instances.forEach(inst => {
      inst.customSize = true;
      if (!inst.width) inst.width = inst.name === 'BG' ? 1280 : inst.name.includes('Bar') ? 300 : 128;
      if (!inst.height) inst.height = inst.name === 'BG' ? 720 : inst.name.includes('Bar') ? 32 : 128;
      if (inst.layer === 'Base layer') {
        inst.layer = '';
      }
    });

    if (layout.layers) {
      layout.layers.forEach(lyr => {
        if (lyr.name === 'Base layer') {
          lyr.name = '';
        }
      });
    }

    // Embed JS Code event inside layout.events
    layout.events = [
      {
        "type": "BuiltinCommonInstructions::JsCode",
        "inlineCode": jsCodeContent,
        "parameterObjects": ""
      }
    ];
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Successfully updated:', filePath);
}

processFile('game.json');
processFile('gd_souls_prototype.json');
