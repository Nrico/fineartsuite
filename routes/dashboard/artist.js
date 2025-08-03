const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireRole } = require('../../middleware/auth');
let Jimp;
try {
  Jimp = require('jimp');
} catch (err) {
  console.warn('jimp not installed, images will be copied without resizing');
}
const { createCollection, getCollectionsByArtist, updateCollection } = require('../../models/collectionModel');
const { getArtworksByArtist, updateArtworkCollection, createArtwork } = require('../../models/artworkModel');

const uploadsDir = path.join(__dirname, '../../public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({
  dest: uploadsDir,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or HEIC images are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

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

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

router.get('/', requireRole('artist'), (req, res) => {
  getCollectionsByArtist(req.session.user.id, (err, collections) => {
    getArtworksByArtist(req.session.user.id, (err2, artworks) => {
      res.render('dashboard/artist', {
        user: req.session.user,
        collections: collections || [],
        artworks: artworks || []
      });
    });
  });
});

router.get('/collections', requireRole('artist'), (req, res) => {
  res.redirect('/dashboard/artist');
});

router.post('/collections', requireRole('artist'), (req, res) => {
  const { name } = req.body;
  const slug = slugify(name);
  createCollection(name, req.session.user.id, slug, err => {
    if (err) req.flash('error', 'Could not create collection');
    res.redirect('/dashboard/artist');
  });
});

router.post('/collections/:id', requireRole('artist'), (req, res) => {
  const { name } = req.body;
  updateCollection(req.params.id, name, err => {
    if (err) req.flash('error', 'Could not update collection');
    res.redirect('/dashboard/artist');
  });
});

router.post('/artworks', requireRole('artist'), (req, res) => {
  upload.single('imageFile')(req, res, async err => {
    if (err) {
      console.error(err);
      req.flash('error', err.message);
      return res.redirect('/dashboard/artist');
    }
    const { title, medium, dimensions, price, imageUrl } = req.body;
    if (!title || !medium || !dimensions) {
      req.flash('error', 'All fields are required');
      return res.redirect('/dashboard/artist');
    }
    if (req.file && imageUrl) {
      req.flash('error', 'Choose either an upload or a URL');
      return res.redirect('/dashboard/artist');
    }
    if (!req.file && !imageUrl) {
      req.flash('error', 'Image is required');
      return res.redirect('/dashboard/artist');
    }
    try {
      const images = req.file
        ? await processImages(req.file)
        : { imageFull: imageUrl, imageStandard: imageUrl, imageThumb: imageUrl };
      createArtwork(req.session.user.id, title, medium, dimensions, price, images, createErr => {
        if (createErr) {
          console.error(createErr);
          req.flash('error', 'Could not create artwork');
        } else {
          req.flash('success', 'Artwork added');
        }
        res.redirect('/dashboard/artist');
      });
    } catch (procErr) {
      console.error(procErr);
      req.flash('error', 'Image processing failed');
      res.redirect('/dashboard/artist');
    }
  });
});

router.post('/artworks/:id/collection', requireRole('artist'), (req, res) => {
  const { collection_id } = req.body;
  updateArtworkCollection(req.params.id, collection_id || null, err => {
    if (err) req.flash('error', 'Could not update artwork');
    res.redirect('/dashboard/artist');
  });
});

module.exports = router;
