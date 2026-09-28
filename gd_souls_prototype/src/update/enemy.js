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
