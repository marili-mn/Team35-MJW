import fs from 'fs';
import path from 'path';

function buildScript(mainPath) {
  let content = fs.readFileSync(mainPath, 'utf-8');
  const importRegex = /\/\/\s*@import\s+['"]([^'"]+)['"]/g;
  
  content = content.replace(importRegex, (match, p1) => {
    const importPath = path.join(path.dirname(mainPath), p1);
    try {
      return fs.readFileSync(importPath, 'utf-8');
    } catch (e) {
      console.error(`Failed to inline ${p1}:`, e);
      return match;
    }
  });

  return content;
}

const jsCodeContent = buildScript(path.join(process.cwd(), 'src/main.js'));
fs.writeFileSync(path.join(process.cwd(), 'script.js'), jsCodeContent, 'utf-8');

function processFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  if (data.layouts && data.layouts.length > 0) {
    const layout = data.layouts[0];
    
    // Set customSize true on all instances so GDevelop IDE renders them clearly
    layout.instances.forEach(inst => {
      inst.customSize = true;
      if (!inst.width) inst.width = inst.name === 'BG' ? 1280 : inst.name.includes('Bar') ? 300 : 128;
      if (!inst.height) inst.height = inst.name === 'BG' ? 720 : inst.name.includes('Bar') ? 32 : 128;
      if (inst.layer === 'Base layer') {
        inst.layer = '';
      }
    });

    if (layout.layers) {
      layout.layers.forEach(lyr => {
        if (lyr.name === 'Base layer') {
          lyr.name = '';
        }
      });
    }

    // Embed JS Code event inside layout.events
    layout.events = [
      {
        "type": "BuiltinCommonInstructions::JsCode",
        "inlineCode": jsCodeContent,
        "parameterObjects": ""
      }
    ];
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Successfully updated:', filePath);
}

processFile('game.json');
processFile('gd_souls_prototype.json');
