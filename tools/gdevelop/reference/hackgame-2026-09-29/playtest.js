// Serves the exported game and plays it in headless Chrome, checking the main mechanics.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, 'export');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(p);
  if (p.endsWith('index.html')) body = body.toString().replace('var game = new', 'var game = window.__game = new');
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  res.end(body);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

server.listen(8765, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const state = () => page.evaluate(() => {
    const g = window.__game; if (!g) return null;
    const s = g.getSceneStack().getCurrentScene(); if (!s) return null;
    const k = s.getObjects('Kaito') || [];
    const v = s.getVariables();
    return {
      scene: s.getName(),
      kaito: k[0] ? { x: Math.round(k[0].getX()), y: Math.round(k[0].getY()), flipY: k[0].isFlippedY(), anim: k[0].getAnimation() } : null,
      energia: v.has('Energia') ? Math.round(v.get('Energia').getAsNumber()) : null,
      vidas: g.getVariables().get('Vidas').getAsNumber(),
      cristales: g.getVariables().get('Cristales').getAsNumber(),
    };
  });
  const teleport = (x, y) => page.evaluate(([x, y]) => {
    const k = window.__game.getSceneStack().getCurrentScene().getObjects('Kaito')[0]; k.setX(x); k.setY(y);
  }, [x, y]);
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
  const tap = async (key, ms = 120) => { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); };

  await page.goto('http://localhost:8765/');
  await sleep(4000);
  let s = await state();
  check('arranca en Titulo', s && s.scene === 'Titulo', JSON.stringify(s));
  await shot('01_titulo');

  await tap('Space');
  await sleep(1500);
  s = await state();
  check('ESPACIO pasa al Tutorial', s && s.scene === 'Tutorial', JSON.stringify(s));
  const startY = s.kaito.y;
  check('Kaito apoyado en el piso', Math.abs(startY - (656 - 123)) <= 3, 'y=' + startY);
  await shot('02_tutorial');

  await page.keyboard.down('ArrowRight'); await sleep(1200);
  s = await state();
  check('camina con →', s.kaito.x > 300 && s.kaito.anim === 1, JSON.stringify(s.kaito));
  await shot('03_caminando');
  await page.keyboard.up('ArrowRight'); await sleep(300);

  const e0 = (await state()).energia;
  await tap('Alt');
  await sleep(1500);
  s = await state();
  check('ALT invierte la gravedad (Kaito en el techo)', s.kaito.flipY && s.kaito.y < 120, JSON.stringify(s.kaito));
  check('invertir gasta energía', s.energia < e0, `${e0} -> ${s.energia}`);
  await shot('04_techo');

  await page.keyboard.down('ArrowRight'); await sleep(700);
  s = await state();
  check('camina por el techo', s.kaito.flipY && s.kaito.y < 120, JSON.stringify(s.kaito));
  await page.keyboard.up('ArrowRight'); await sleep(200);

  await tap('Alt');
  await sleep(1500);
  s = await state();
  check('ALT de nuevo vuelve al piso', !s.kaito.flipY && Math.abs(s.kaito.y - startY) <= 3, JSON.stringify(s.kaito));
  await shot('05_piso_de_nuevo');

  // Jump
  await tap('Space', 150);
  await sleep(250);
  s = await state();
  check('ESPACIO salta', s.kaito.y < startY - 40, 'y=' + s.kaito.y);
  await sleep(1200);

  // Gem pickup (gems at x=1000.., y=586)
  await teleport(985, startY);
  await sleep(500);
  s = await state();
  check('junta cristal', s.cristales >= 1, 'cristales=' + s.cristales);

  // Spikes: lose a life and restart
  await teleport(1780, startY);
  await sleep(1500);
  s = await state();
  check('pinchos quitan una vida y reinician', s.vidas === 2 && s.scene === 'Tutorial' && s.kaito.x < 200, JSON.stringify(s));
  await shot('06_perdio_vida');

  // Portal -> Nivel1
  await teleport(4100, startY);
  await sleep(1500);
  s = await state();
  check('portal lleva a Nivel1', s.scene === 'Nivel1', JSON.stringify(s));
  await sleep(500);
  await shot('07_nivel1');

  // Fall into a pit -> lose life
  await teleport(1650, 300);
  await sleep(2500);
  s = await state();
  check('caer al abismo quita vida', s.vidas === 1 && s.scene === 'Nivel1', JSON.stringify(s));

  // Last life -> GameOver
  await teleport(880, startY);
  await sleep(1500);
  s = await state();
  check('sin vidas -> GameOver', s.scene === 'GameOver', JSON.stringify(s));
  await shot('08_gameover');

  await tap('Space');
  await sleep(1500);
  s = await state();
  check('ESPACIO en GameOver reintenta el nivel', s.scene === 'Nivel1' && s.vidas === 3, JSON.stringify(s));

  await teleport(6150, startY);
  await sleep(1500);
  s = await state();
  check('portal de Nivel1 lleva al Final', s.scene === 'Final', JSON.stringify(s));
  await shot('09_final');

  console.log(results.join('\n'));
  console.log(errors.length ? 'ERRORES DE JS:\n' + [...new Set(errors)].slice(0, 15).join('\n') : 'sin errores de JS');
  await browser.close();
  server.close();
});
