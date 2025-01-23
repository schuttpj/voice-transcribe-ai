const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

async function createIcon() {
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const svgBuffer = fs.readFileSync(path.join(__dirname, '../assets/icon.svg'));
    
    // Create PNG files for each size
    const pngBuffers = await Promise.all(sizes.map(async size => {
        const buffer = await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toBuffer();
        return buffer;
    }));

    // Write individual PNGs
    const assetsDir = path.join(__dirname, '../assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Write the largest size as app icon
    const pngPath = path.join(assetsDir, 'icon.png');
    fs.writeFileSync(pngPath, pngBuffers[pngBuffers.length - 1]);

    // Create ICO file
    const icoBuffer = await pngToIco([pngPath]);
    fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);

    console.log('Icon files created successfully!');
}

createIcon().catch(console.error); 