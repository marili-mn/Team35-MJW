// Build frame strips by slicing the spritesheets visually
function buildStrip(id, url, count, sheetW){
  const strip = document.getElementById(id);
  const frameW = sheetW/count;
  const CELL = 88;
  for(let i=0;i<count;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    const img = document.createElement('div');
    img.style.width = CELL+'px';
    img.style.height = CELL+'px';
    img.style.background = `url("${url}") no-repeat`;
    img.style.backgroundSize = `${(CELL/frameW)*sheetW}px ${CELL}px`;
    img.style.backgroundPosition = `-${i*CELL}px 0`;
    img.style.imageRendering = 'pixelated';
    cell.appendChild(img);
    strip.appendChild(cell);
  }
}
buildStrip('idleStrip','ninja-with-katana-idle-pose-607a-spritesheet.png',8,1024);

// Version tabs: switch between v1 (GDD) and v2 (Pre-Alfa) without reloading
const versionTabs = document.querySelectorAll('.versionTabs [data-target]');
function showVersion(id) {
  document.querySelectorAll('.version').forEach(v => { v.hidden = v.id !== id; });
  versionTabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.target === id)));
}
versionTabs.forEach(t => t.addEventListener('click', () => {
  showVersion(t.dataset.target);
  history.replaceState(null, '', '#' + t.dataset.target);
  window.scrollTo(0, 0);
}));
const versionFromHash = () => showVersion(location.hash === '#v1' ? 'v1' : 'v2');
window.addEventListener('hashchange', versionFromHash);
versionFromHash();

// Kaito frame animations (frames are <base>_<i>.png)
document.querySelectorAll('img.kaitoAnim').forEach(img => {
  const base = img.dataset.src, count = Number(img.dataset.frames), ms = Number(img.dataset.ms) || 90;
  const frames = Array.from({ length: count }, (_, i) => { const im = new Image(); im.src = `${base}_${i}.png`; return im.src; });
  let f = 0;
  setInterval(() => { f = (f + 1) % count; img.src = frames[f]; }, ms);
});
