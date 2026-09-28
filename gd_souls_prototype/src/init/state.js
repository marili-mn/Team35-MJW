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
