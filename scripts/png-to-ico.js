const fs = require('fs');
const path = require('path');
(async ()=>{
  try{
    const in32 = path.join(__dirname,'..','site','favicon-32x32.png');
    const in16 = path.join(__dirname,'..','site','favicon-16x16.png');
    const out = path.join(__dirname,'..','site','favicon.ico');
    if(!fs.existsSync(in32)) throw new Error('Missing '+in32);
    // dynamic import for ESM module
    const mod = await import('png-to-ico');
    const pngToIco = mod.default || mod;
    const buf = await pngToIco([in32, in16]);
    fs.writeFileSync(out, buf);
    console.log('Wrote', out);
  }catch(e){ console.error(e); process.exit(1); }
})();