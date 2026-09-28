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
container.innerHTML = `<div style="position: absolute; top: 16px; left: 16px; display: flex; flex-direction: column; gap: 8px;">
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
  </div>`;
document.body.appendChild(container);
