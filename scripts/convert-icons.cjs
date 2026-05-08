const sharp = require('sharp');
const fs = require('fs');

async function convert() {
  const svgBuffer192 = fs.readFileSync('./public/pwa-192x192.svg');
  await sharp(svgBuffer192)
    .resize(192, 192)
    .png()
    .toFile('./public/pwa-192x192.png');
    
  const svgBuffer512 = fs.readFileSync('./public/pwa-512x512.svg');
  await sharp(svgBuffer512)
    .resize(512, 512)
    .png()
    .toFile('./public/pwa-512x512.png');
    
  console.log('Done!');
}

convert().catch(console.error);
