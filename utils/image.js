const path = require('path');
const fs = require('fs');
let Jimp;
try {
  Jimp = require('jimp');
} catch (err) {
  console.warn('jimp not installed, images will be copied without resizing');
}

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function processImages(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const base = path.parse(file.filename).name;
  const fullPath = path.join(uploadsDir, `${base}_full${ext}`);
  const standardPath = path.join(uploadsDir, `${base}_standard${ext}`);
  const thumbPath = path.join(uploadsDir, `${base}_thumb${ext}`);
  try {
    if (Jimp) {
      try {
        const image = await Jimp.read(file.path);
        await image.clone().scaleToFit(2000, 2000).writeAsync(fullPath);
        await image.clone().scaleToFit(800, 800).writeAsync(standardPath);
        await image.clone().cover(300, 300).writeAsync(thumbPath);
      } catch {
        await fs.promises.copyFile(file.path, fullPath);
        await fs.promises.copyFile(file.path, standardPath);
        await fs.promises.copyFile(file.path, thumbPath);
      }
      await fs.promises.unlink(file.path);
    } else {
      await fs.promises.copyFile(file.path, fullPath);
      await fs.promises.copyFile(file.path, standardPath);
      await fs.promises.copyFile(file.path, thumbPath);
      await fs.promises.unlink(file.path);
    }
    return {
      imageFull: `/uploads/${path.basename(fullPath)}`,
      imageStandard: `/uploads/${path.basename(standardPath)}`,
      imageThumb: `/uploads/${path.basename(thumbPath)}`
    };
  } catch (err) {
    console.error('Error processing images:', err);
    try {
      await fs.promises.unlink(file.path);
    } catch {}
    throw err;
  }
}

module.exports = { processImages, uploadsDir };
