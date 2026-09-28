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
