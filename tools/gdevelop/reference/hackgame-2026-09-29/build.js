// Builds GravityRunnerDash/hackGame.json using GDevelop's own libGD (same engine as the IDE).
const fs = require('fs');
const path = require('path');
const init = require('./libGD.js');

const GAME_DIR = 'C:/Users/Nicte/Desktop/Team35-MJW-jorgelinamendieta-gdevelop/GravityRunnerDash';
const OUT = path.join(GAME_DIR, 'hackGame.json');
const W = 1280, H = 720, TILE = 64;
const FLOOR_Y = H - TILE;          // top of the floor row
const KAITO_W = 94, KAITO_H = 123;

// ---------- event helpers ----------
const C = (type, parameters, inverted) => ({ type: inverted ? { inverted: true, value: type } : { value: type }, parameters });
const A = (type, parameters) => ({ type: { value: type }, parameters });
const OR = (...subs) => ({ type: { value: 'BuiltinCommonInstructions::Or' }, parameters: [], subInstructions: subs });
const ONCE = () => C('BuiltinCommonInstructions::Once', []);
const ev = (conditions, actions, events = []) => ({ type: 'BuiltinCommonInstructions::Standard', conditions, actions, events });
const comment = (text) => ({
  type: 'BuiltinCommonInstructions::Comment',
  color: { b: 109, g: 230, r: 255, textB: 0, textG: 0, textR: 0 },
  comment: text,
});
const group = (name, events) => ({
  type: 'BuiltinCommonInstructions::Group', name, source: '', creationTime: 0,
  colorB: 228, colorG: 176, colorR: 74, events,
});
const q = (s) => JSON.stringify(s); // GDevelop string literal
const goScene = (sceneExpr) => A('Scene', ['', sceneExpr, '']);
const keyJustPressed = (key) => [C('KeyPressed', ['', key]), ONCE()];
const anyKeyOrClick = (key) => [OR(C('KeyPressed', ['', key]), C('SourisBouton', ['', 'Left'])), ONCE()];

init({ locateFile: (f) => path.join(__dirname, f) }).then((gd) => {
  const project = gd.ProjectHelper.createNewGDJSProject();
  project.setName('Gravity Runner Dash (hack)');
  project.setAuthor('Team35-MJW');
  project.setPackageName('com.team35mjw.gravityrunnerdash');
  project.setGameResolutionSize(W, H);
  project.setMaximumFPS(60);

  // ---------- resources ----------
  const rm = project.getResourcesManager();
  const addImage = (file) => {
    const r = new gd.ImageResource();
    r.setName(file);
    r.setFile('hack_assets/' + file);
    r.setSmooth(true);
    rm.addResource(r);
    r.delete();
    return file;
  };
  const pad = (n) => String(n).padStart(2, '0');
  const idleFrames = Array.from({ length: 16 }, (_, i) => addImage(`kaito_idle_${pad(i + 1)}.png`));
  const walkFrames = Array.from({ length: 16 }, (_, i) => addImage(`kaito_walk_${pad(i + 1)}.png`));
  ['fondo_tutorial.png', 'fondo_entrenamiento.png', 'fondo_nivel1.png', 'roca.png', 'piso_flotante.png',
    'pinchos.png', 'gema.png', 'corazon.png', 'portal.png', 'cartel1.png', 'cartel2.png', 'cartel3.png',
    'cartel4.png', 'cartel5.png', 'inicio.png', 'titulo.png', 'gameover.png', 'aviso.png', 'espacio.png',
    'barra_marco.png', 'barra_relleno.png'].forEach(addImage);

  // ---------- FlipGravity extension (the team's one) ----------
  const flipJson = JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'FlipGravity.json'), 'utf8'));
  const ext = project.insertNewEventsFunctionsExtension('FlipGravity', 0);
  const extEl = gd.Serializer.fromJSObject(flipJson);
  ext.unserializeFromElement(project, extEl);
  extEl.delete();

  // ---------- global objects (shared by every scene) ----------
  const objects = project.getObjects();
  let objIndex = 0;
  const newObject = (type, name) => objects.insertNewObject(project, type, name, objIndex++);

  const spriteObject = (name, animations) => {
    const obj = newObject('Sprite', name);
    const cfg = gd.asSpriteConfiguration(obj.getConfiguration());
    for (const a of animations) {
      const anim = new gd.Animation();
      anim.setName(a.name);
      anim.setDirectionsCount(1);
      const dir = anim.getDirection(0);
      dir.setLoop(a.loop !== false);
      dir.setTimeBetweenFrames(a.speed || 0.08);
      for (const img of a.frames) {
        const s = new gd.Sprite();
        s.setImageName(img);
        s.setFullImageCollisionMask(true); // otherwise libGD leaves an empty custom mask = no hitbox
        dir.addSprite(s);
        s.delete();
      }
      cfg.getAnimations().addAnimation(anim);
      anim.delete();
    }
    return obj;
  };
  const single = (name, img) => spriteObject(name, [{ name: 'Default', frames: [img] }]);

  const textObject = (name, text, size, color, align = 'left') => {
    const obj = newObject('TextObject::Text', name);
    const cfg = obj.getConfiguration();
    cfg.updateProperty('text', text);
    cfg.updateProperty('characterSize', String(size));
    cfg.updateProperty('color', color);
    cfg.updateProperty('bold', 'true');
    cfg.updateProperty('textAlignment', align);
    cfg.updateProperty('isOutlineEnabled', 'true');
    cfg.updateProperty('outlineColor', '15;22;38');
    cfg.updateProperty('outlineThickness', '4');
    return obj;
  };

  // Kaito: 0 Idle, 1 Walk, 2 Fall (animation indexes are passed to FlipGravity)
  const kaito = spriteObject('Kaito', [
    { name: 'Idle', frames: idleFrames, speed: 0.08 },
    { name: 'Walk', frames: walkFrames, speed: 0.05 },
    { name: 'Fall', frames: [walkFrames[4]], loop: false },
  ]);
  kaito.addNewBehavior(project, 'PlatformBehavior::PlatformerObjectBehavior', 'PlatformerObject');
  const pb = kaito.getBehavior('PlatformerObject');
  pb.updateProperty('MaxSpeed', '320');
  pb.updateProperty('JumpSpeed', '640');
  pb.updateProperty('Gravity', '1400');
  pb.updateProperty('MaxFallingSpeed', '900');
  pb.updateProperty('Acceleration', '2000');
  pb.updateProperty('Deceleration', '2400');

  const suelo = newObject('TiledSpriteObject::TiledSprite', 'Suelo');
  suelo.getConfiguration().updateProperty('texture', 'roca.png');
  suelo.getConfiguration().updateProperty('width', String(TILE));
  suelo.getConfiguration().updateProperty('height', String(TILE));
  suelo.addNewBehavior(project, 'PlatformBehavior::PlatformBehavior', 'Platform');

  const piso = single('PisoFlotante', 'piso_flotante.png');
  piso.addNewBehavior(project, 'PlatformBehavior::PlatformBehavior', 'Platform');

  single('Pinchos', 'pinchos.png');
  spriteObject('Gema', [{ name: 'Default', frames: ['gema.png'] }]);
  single('Portal', 'portal.png');
  ['cartel1', 'cartel2', 'cartel3', 'cartel4', 'cartel5'].forEach((c, i) => single('Cartel' + (i + 1), c + '.png'));
  const corazon = single('Corazon', 'corazon.png');
  corazon.getVariables().insertNew('Indice', 0).setValue(1);
  single('BarraMarco', 'barra_marco.png');
  single('BarraRelleno', 'barra_relleno.png');
  single('Fondo', 'fondo_tutorial.png');
  single('FondoEntrenamiento', 'fondo_entrenamiento.png');
  single('FondoNivel1', 'fondo_nivel1.png');
  single('Titulo', 'titulo.png');
  single('Inicio', 'inicio.png');
  single('GameOver', 'gameover.png');
  single('Aviso', 'aviso.png');
  single('Espacio', 'espacio.png');
  textObject('TextoHUD', 'Cristales: 0', 26, '242;234;211');
  textObject('Texto', '', 30, '242;234;211', 'center');
  textObject('TextoChico', '', 22, '201;160;74', 'center');

  const groups = objects.getObjectGroups();
  const plataformas = groups.insertNew('Plataformas', 0);
  plataformas.addObject('Suelo');
  plataformas.addObject('PisoFlotante');

  // ---------- global variables ----------
  const gv = project.getVariables();
  gv.insertNew('Vidas', 0).setValue(3);
  gv.insertNew('Cristales', 1).setValue(0);
  gv.insertNew('NivelActual', 2).setString('Tutorial');

  // ---------- scene helpers ----------
  const makeScene = (name, index) => {
    const layout = project.insertNewLayout(name, index);
    const layers = layout.getLayers();
    layers.insertNewLayer('Fondo', 0);            // static background (own camera, never moved)
    layers.insertNewLayer('UI', layers.getLayersCount()); // HUD on top
    const instances = layout.getInitialInstances();
    const put = (obj, x, y, opts = {}) => {
      const i = instances.insertNewInitialInstance();
      i.setObjectName(obj);
      i.setX(x);
      i.setY(y);
      i.setLayer(opts.layer || '');
      i.setZOrder(opts.z || 1);
      if (opts.w || opts.h) {
        i.setHasCustomSize(true);
        i.setCustomWidth(opts.w);
        i.setCustomHeight(opts.h);
      }
      if (opts.flipY) i.setFlippedY(true);
      if (opts.vars) for (const [k, v] of Object.entries(opts.vars)) i.getVariables().insertNew(k, 0).setValue(v);
      return i;
    };
    const setEvents = (events) => {
      const el = gd.Serializer.fromJSObject(events);
      layout.getEvents().unserializeFrom(project, el);
      el.delete();
    };
    return { layout, put, setEvents };
  };

  // Floor/ceiling strips made of rock tiles
  const strip = (put, x1, x2, y) => put('Suelo', x1, y, { w: x2 - x1, h: TILE, z: 2 });
  const spikes = (put, x, count = 1, ceiling = false) => {
    for (let k = 0; k < count; k++)
      put('Pinchos', x + k * 160, ceiling ? TILE : FLOOR_Y - 47, { z: 3, flipY: ceiling });
  };
  const gem = (put, x, y) => put('Gema', x, y, { z: 4 });
  const gemsFloor = (put, xs) => xs.forEach((x) => gem(put, x, FLOOR_Y - 70));
  const gemsCeiling = (put, xs) => xs.forEach((x) => gem(put, x, TILE + 14));
  const hud = (put) => {
    [1, 2, 3].forEach((n) => put('Corazon', 20 + (n - 1) * 48, 18, { layer: 'UI', vars: { Indice: n } }));
    put('BarraRelleno', 20 + 99, 64 + 42, { layer: 'UI', z: 1, w: 217, h: 22 });
    put('BarraMarco', 20, 64, { layer: 'UI', z: 2 });
    put('TextoHUD', 1060, 22, { layer: 'UI' });
  };

  // ---------- gameplay events shared by both levels ----------
  const levelEvents = (sceneName, nextScene, levelWidth) => [
    comment(`${sceneName} — eventos regenerados (hackGame). Controles: ←/→ mover · ESPACIO saltar · ALT invertir gravedad.`),
    group('Inicio de escena', [
      ev([C('DepartScene', [''])], [
        A('ModVarGlobalTxt', ['NivelActual', '=', q(sceneName)]),
        A('ModVarScene', ['Energia', '=', '100']),
      ]),
    ]),
    group('Gravedad invertida (extensión FlipGravity)', [
      comment('Invertir cuesta 25 de energía. Sin energía no se puede subir al techo, pero siempre se puede volver al piso.'),
      comment('PuedeInvertir se calcula aparte: una condición sobre Kaito en el mismo evento dejaría a Kaito sin seleccionar y la extensión no haría nada.'),
      ev([], [A('ModVarScene', ['PuedeInvertir', '=', '0'])]),
      ev([C('VarScene', ['Energia', '>=', '25'])], [A('ModVarScene', ['PuedeInvertir', '=', '1'])]),
      ev([C('FlippedY', ['Kaito'])], [A('ModVarScene', ['PuedeInvertir', '=', '1'])]),
      ev([C('VarScene', ['PuedeInvertir', '=', '1'])], [
        A('FlipGravity::FlipGravity1Object', ['', 'Kaito', 'PlatformerObject', 'LAlt', 'Plataformas', '0',
          'Right', 'Left', '0', '1', '2', 'no', 'yes', 'yes', 'Space', '500']),
      ]),
      ev([C('VarScene', ['PuedeInvertir', '=', '0'])], [
        // Same call with a key nobody presses: keeps the extension's internal state updated without flipping.
        A('FlipGravity::FlipGravity1Object', ['', 'Kaito', 'PlatformerObject', 'Pause', 'Plataformas', '0',
          'Right', 'Left', '0', '1', '2', 'no', 'yes', 'yes', 'Space', '500']),
      ]),
      ev([C('FlippedY', ['Kaito']), ONCE()], [A('ModVarScene', ['Energia', '-', '25'])]),
    ]),
    group('Energía', [
      ev([], [A('ModVarScene', ['Energia', '+', '6*TimeDelta()'])]),
      ev([C('VarScene', ['Energia', '>', '100'])], [A('ModVarScene', ['Energia', '=', '100'])]),
      ev([C('VarScene', ['Energia', '<', '0'])], [A('ModVarScene', ['Energia', '=', '0'])]),
      ev([], [A('ChangeScaleWidth', ['BarraRelleno', '=', '(Variable(Energia)/100)*(217/62)'])]),
    ]),
    group('Animaciones y dirección', [
      ev([C('KeyPressed', ['', 'Left'])], [A('FlipX', ['Kaito', 'yes'])]),
      ev([C('KeyPressed', ['', 'Right'])], [A('FlipX', ['Kaito', 'no'])]),
      ev([C('FlippedY', ['Kaito'], true), C('PlatformBehavior::IsOnFloor', ['Kaito', 'PlatformerObject'])], [], [
        ev([C('PlatformBehavior::IsMoving', ['Kaito', 'PlatformerObject'])], [A('ChangeAnimation', ['Kaito', '=', '1'])]),
        ev([C('PlatformBehavior::IsMoving', ['Kaito', 'PlatformerObject'], true)], [A('ChangeAnimation', ['Kaito', '=', '0'])]),
      ]),
      ev([C('FlippedY', ['Kaito'], true), C('PlatformBehavior::IsJumping', ['Kaito', 'PlatformerObject'])],
        [A('ChangeAnimation', ['Kaito', '=', '2'])]),
    ]),
    group('Cristales', [
      ev([C('CollisionNP', ['Kaito', 'Gema', '', '', ''])], [
        A('ModVarScene', ['Energia', '+', '35']),
        A('ModVarGlobal', ['Cristales', '+', '1']),
        A('Delete', ['Gema', '']),
      ]),
      ev([], [A('TextContainerCapability::TextContainerBehavior::SetValue',
        ['TextoHUD', 'Text', '=', '"Cristales: " + ToString(GlobalVariable(Cristales))'])]),
    ]),
    group('Vidas y muerte', [
      ev([C('VarObjet', ['Corazon', 'Indice', '>', 'GlobalVariable(Vidas)'])], [A('Cache', ['Corazon'])]),
      ev([OR(
        C('CollisionNP', ['Kaito', 'Pinchos', '', '', '']),
        C('PosY', ['Kaito', '>', String(H + 60)]),
        C('PosY', ['Kaito', '<', '-200']),
      ), ONCE()], [A('ModVarGlobal', ['Vidas', '-', '1'])], [
        ev([C('VarGlobal', ['Vidas', '<=', '0'])], [goScene(q('GameOver'))]),
        ev([C('VarGlobal', ['Vidas', '>', '0'])], [goScene(q(sceneName))]),
      ]),
    ]),
    group('Meta', [
      ev([C('CollisionNP', ['Kaito', 'Portal', '', '', '']), ONCE()], [goScene(q(nextScene))]),
    ]),
    group('Cámara', [
      ev([], [
        A('CentreCamera', ['', 'Kaito', '', '', '']),
        A('CameraY', ['', '=', String(H / 2), '', '']),
      ]),
      ev([C('BuiltinCommonInstructions::CompareNumbers', ['CameraX()', '<', String(W / 2)])],
        [A('CameraX', ['', '=', String(W / 2), '', ''])]),
      ev([C('BuiltinCommonInstructions::CompareNumbers', ['CameraX()', '>', String(levelWidth - W / 2)])],
        [A('CameraX', ['', '=', String(levelWidth - W / 2), '', ''])]),
    ]),
  ];

  let sceneIndex = 0;

  // ---------- Titulo ----------
  {
    const s = makeScene('Titulo', sceneIndex++);
    s.put('Fondo', 0, 0, { layer: 'Fondo' });
    s.put('Titulo', (W - 720) / 2, 60, { z: 2 });
    s.put('Inicio', (W - 260) / 2, 330, { z: 2 });
    s.put('Texto', 0, 560, { z: 3, w: W, h: 40 });
    s.put('TextoChico', 0, 620, { z: 3, w: W, h: 30 });
    s.setEvents([
      ev([C('DepartScene', [''])], [
        A('TextContainerCapability::TextContainerBehavior::SetValue', ['Texto', 'Text', '=', q('Presioná ESPACIO o hacé clic para empezar')]),
        A('TextContainerCapability::TextContainerBehavior::SetValue', ['TextoChico', 'Text', '=', q('←/→ mover   ·   ESPACIO saltar   ·   ALT invertir la gravedad')]),
      ]),
      ev(anyKeyOrClick('Space'), [
        A('ModVarGlobal', ['Vidas', '=', '3']),
        A('ModVarGlobal', ['Cristales', '=', '0']),
        goScene(q('Tutorial')),
      ]),
    ]);
  }

  // ---------- Tutorial ----------
  {
    const LW = 4480;
    const s = makeScene('Tutorial', sceneIndex++);
    s.layout.getVariables().insertNew('Energia', 0).setValue(100);
    s.put('FondoEntrenamiento', 0, 0, { layer: 'Fondo' });
    strip(s.put, -TILE, LW, FLOOR_Y);
    strip(s.put, -TILE, LW, 0);
    s.put('Suelo', -TILE, 0, { w: TILE, h: H, z: 2 });
    s.put('Suelo', LW, 0, { w: TILE, h: H, z: 2 });
    s.put('Cartel1', 160, 170);
    s.put('Cartel2', 820, 170);
    gemsFloor(s.put, [1000, 1080, 1160]);
    s.put('Cartel3', 1480, 170);
    spikes(s.put, 1800);
    s.put('PisoFlotante', 2080, 460, { z: 2 });
    gem(s.put, 2186, 400);
    s.put('Cartel4', 2300, 170);
    spikes(s.put, 2640, 5);
    gemsCeiling(s.put, [2800, 3000, 3200]);
    s.put('Cartel5', 3560, 170);
    s.put('Portal', 4060, FLOOR_Y - 220, { z: 2 });
    s.put('Kaito', 80, FLOOR_Y - KAITO_H, { z: 10 });
    hud(s.put);
    s.setEvents(levelEvents('Tutorial', 'Nivel1', LW));
  }

  // ---------- Nivel 1 ----------
  {
    const LW = 6400;
    const s = makeScene('Nivel1', sceneIndex++);
    s.layout.getVariables().insertNew('Energia', 0).setValue(100);
    s.put('FondoNivel1', 0, 0, { layer: 'Fondo' });
    [[-TILE, 1600], [1850, 3000], [3300, 4600], [5000, LW]].forEach(([a, b]) => strip(s.put, a, b, FLOOR_Y));
    [[-TILE, 2400], [2600, LW]].forEach(([a, b]) => strip(s.put, a, b, 0));
    s.put('Suelo', -TILE, 0, { w: TILE, h: H, z: 2 });
    s.put('Suelo', LW, 0, { w: TILE, h: H, z: 2 });
    s.put('PisoFlotante', 1520, 470, { z: 2 });
    s.put('PisoFlotante', 4720, 500, { z: 2 });
    spikes(s.put, 900);
    spikes(s.put, 2200);
    spikes(s.put, 3480, 2);
    spikes(s.put, 5400);
    spikes(s.put, 2800, 1, true);
    spikes(s.put, 4150, 2, true);
    spikes(s.put, 5800, 1, true);
    gemsFloor(s.put, [500, 1200, 2000, 2600, 4000, 5200, 6000]);
    gemsCeiling(s.put, [1100, 2000, 3560, 3720, 5000]);
    gem(s.put, 1626, 410);
    gem(s.put, 4826, 440);
    s.put('Portal', 6120, FLOOR_Y - 220, { z: 2 });
    s.put('Kaito', 80, FLOOR_Y - KAITO_H, { z: 10 });
    hud(s.put);
    s.setEvents(levelEvents('Nivel1', 'Final', LW));
  }

  // ---------- GameOver ----------
  {
    const s = makeScene('GameOver', sceneIndex++);
    s.put('FondoNivel1', 0, 0, { layer: 'Fondo' });
    s.put('GameOver', (W - 640) / 2, 40, { z: 2 });
    s.put('Aviso', (W - 640) / 2, 380, { z: 2 });
    s.put('Espacio', (W - 560) / 2, 590, { z: 2 });
    s.setEvents([
      ev(anyKeyOrClick('Space'), [
        A('ModVarGlobal', ['Vidas', '=', '3']),
        goScene('GlobalVariableString(NivelActual)'),
      ]),
    ]);
  }

  // ---------- Final ----------
  {
    const s = makeScene('Final', sceneIndex++);
    s.put('Fondo', 0, 0, { layer: 'Fondo' });
    s.put('Titulo', (W - 720) / 2, 60, { z: 2 });
    s.put('Texto', 0, 360, { z: 3, w: W, h: 40 });
    s.put('TextoChico', 0, 440, { z: 3, w: W, h: 30 });
    s.setEvents([
      ev([C('DepartScene', [''])], [
        A('TextContainerCapability::TextContainerBehavior::SetValue', ['Texto', 'Text', '=',
          '"¡Kaito recuperó la primera hoja del pergamino! Cristales: " + ToString(GlobalVariable(Cristales))']),
        A('TextContainerCapability::TextContainerBehavior::SetValue', ['TextoChico', 'Text', '=', q('ESPACIO para volver al inicio')]),
      ]),
      ev(anyKeyOrClick('Space'), [goScene(q('Titulo'))]),
    ]);
  }

  project.setFirstLayout('Titulo');

  // ---------- save ----------
  const el = new gd.SerializerElement();
  project.serializeTo(el);
  const json = JSON.parse(gd.Serializer.toJSON(el));
  el.delete();
  fs.writeFileSync(OUT, JSON.stringify(json, null, 2), 'utf8');
  console.log('written', OUT, fs.statSync(OUT).size, 'bytes');
  project.delete();
}).catch((e) => { console.error('ERR', e); process.exit(1); });
