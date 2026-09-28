const hpFill = document.getElementById('hp-bar-fill');
const hpText = document.getElementById('hp-text');
const staminaFill = document.getElementById('stamina-bar-fill');
const staminaText = document.getElementById('stamina-text');
const enemyHpFill = document.getElementById('enemy-hp-fill');

if (hpFill) hpFill.style.width = `${Math.max(0, (pStats.health / pStats.maxHealth) * 100)}%`;
if (hpText) hpText.innerText = `${Math.max(0, Math.ceil(pStats.health))} / ${pStats.maxHealth}`;
if (staminaFill) staminaFill.style.width = `${Math.max(0, (pStats.stamina / pStats.maxStamina) * 100)}%`;
if (staminaText) staminaText.innerText = `${Math.max(0, Math.ceil(pStats.stamina))} / ${pStats.maxStamina}`;
if (enemyHpFill) enemyHpFill.style.width = `${Math.max(0, (eStats.health / eStats.maxHealth) * 100)}%`;
