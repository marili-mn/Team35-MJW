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
