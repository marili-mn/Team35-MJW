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
