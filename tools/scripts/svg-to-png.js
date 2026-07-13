const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const logoSvg = path.join(__dirname, '..', '..', 'site', 'logo.svg');
const ballSvg = path.join(__dirname, '..', '..', 'site', 'logo-ball.svg');
const outDir = path.join(__dirname, '..', '..', 'site');

function readSvg(p){
  if (!fs.existsSync(p)){
    console.error('SVG not found:', p);
    return null;
  }
  return fs.readFileSync(p);
}

(async ()=>{
  try{
    const fullSvg = readSvg(logoSvg);
    const ballOnlySvg = readSvg(ballSvg) || fullSvg;
    if(!fullSvg){ process.exit(2); }

    const tasks = [
      // use ball-only SVG for all generated icons so touch icon matches favicons
      {src: ballOnlySvg, name:'apple-touch-icon.png', size:180},
      {src: ballOnlySvg, name:'favicon-32x32.png', size:32},
      {src: ballOnlySvg, name:'favicon-16x16.png', size:16}
    ];

    for(const t of tasks){
      const out = path.join(outDir, t.name);
      await sharp(t.src)
        .resize(t.size, t.size, {fit:'contain', background:{r:0,g:0,b:0,alpha:0}})
        .png()
        .toFile(out);
      console.log('Wrote',out);
    }
  }catch(err){
    console.error(err); process.exit(1);
  }
})();
