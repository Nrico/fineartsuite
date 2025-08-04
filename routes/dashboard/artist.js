const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireRole } = require('../../middleware/auth');
const csrf = require('csurf');
const csrfProtection = csrf();
const { processImages, uploadsDir } = require('../../utils/image');
const { createCollection, getCollectionsByArtist, updateCollection } = require('../../models/collectionModel');
const { getArtworksByArtist, updateArtworkCollection, createArtwork } = require('../../models/artworkModel');
const { getArtistById, updateArtist } = require('../../models/artistModel');

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

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

router.get('/', requireRole('artist'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  getCollectionsByArtist(req.session.user.id, (err, collections) => {
    getArtworksByArtist(req.session.user.id, (err2, artworks) => {
      getArtistById(req.session.user.id, (err3, artist) => {
        res.render('dashboard/artist', {
          user: req.session.user,
          collections: collections || [],
          artworks: artworks || [],
          artist: artist || {}
        });
      });
    });
  });
});

router.get('/collections', requireRole('artist'), (req, res) => {
  res.redirect('/dashboard/artist');
});

router.post('/collections', requireRole('artist'), csrfProtection, (req, res) => {
  const { name } = req.body;
  const slug = slugify(name);
  createCollection(name, req.session.user.id, slug, err => {
    if (err) req.flash('error', 'Could not create collection');
    res.redirect('/dashboard/artist');
  });
});

router.post('/collections/:id', requireRole('artist'), csrfProtection, (req, res) => {
  const { name } = req.body;
  updateCollection(req.params.id, name, err => {
    if (err) req.flash('error', 'Could not update collection');
    res.redirect('/dashboard/artist');
  });
});

router.post('/profile', requireRole('artist'), upload.single('bioImageFile'), csrfProtection, async (req, res) => {
  try {
    const { name, bio, fullBio, bioImageUrl, currentBioImageUrl } = req.body;
    if (!name || !bio) {
      req.flash('error', 'Name and short bio are required');
      return res.redirect('/dashboard/artist');
    }
    if (req.file && bioImageUrl) {
      req.flash('error', 'Choose either an upload or a URL');
      return res.redirect('/dashboard/artist');
    }
    let avatarUrl;
    if (req.file) {
      const images = await processImages(req.file);
      avatarUrl = images.imageStandard;
    } else if (bioImageUrl) {
      avatarUrl = bioImageUrl;
    } else {
      avatarUrl = currentBioImageUrl;
    }
    updateArtist(req.session.user.id, name, bio, fullBio || '', avatarUrl || '', err2 => {
      if (err2) {
        console.error(err2);
        req.flash('error', 'Could not update profile');
      } else {
        req.flash('success', 'Profile updated');
      }
      res.redirect('/dashboard/artist');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Image processing failed');
    res.redirect('/dashboard/artist');
  }
});

router.post('/artworks', requireRole('artist'), upload.single('imageFile'), csrfProtection, async (req, res) => {
  const { title, medium, dimensions, price, description, framed, readyToHang, isFeatured, imageUrl, action = 'upload' } = req.body;
  if (!title || !medium || !dimensions) {
    req.flash('error', 'All fields are required');
    return res.redirect('/dashboard/artist');
  }
  if (action !== 'save') {
    if (req.file && imageUrl) {
      req.flash('error', 'Choose either an upload or a URL');
      return res.redirect('/dashboard/artist');
    }
    if (!req.file && !imageUrl) {
      req.flash('error', 'Image is required');
      return res.redirect('/dashboard/artist');
    }
  }
  try {
    let images;
    if (req.file) {
      images = await processImages(req.file);
    } else if (imageUrl) {
      images = { imageFull: imageUrl, imageStandard: imageUrl, imageThumb: imageUrl };
    } else {
      images = { imageFull: '', imageStandard: '', imageThumb: '' };
    }
    createArtwork(
      req.session.user.id,
      title,
      medium,
      dimensions,
      price,
      description,
      framed === 'on',
      readyToHang === 'on',
      images,
      isFeatured === 'on',
      createErr => {
      if (createErr) {
        console.error(createErr);
        req.flash('error', 'Could not create artwork');
      } else {
        req.flash('success', action === 'save' ? 'Artwork saved' : 'Artwork added');
      }
      res.redirect('/dashboard/artist');
    }
    );
  } catch (err) {
    console.error(err);
    req.flash('error', 'Image processing failed');
    res.redirect('/dashboard/artist');
  }
});

router.post('/artworks/:id/collection', requireRole('artist'), csrfProtection, (req, res) => {
  const { collection_id } = req.body;
  updateArtworkCollection(req.params.id, collection_id || null, err => {
    if (err) req.flash('error', 'Could not update artwork');
    res.redirect('/dashboard/artist');
  });
});

// Handle CSRF token errors specifically for artist dashboard routes
router.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF token mismatch on artist route', err);
    return res.status(403).render('403');
  }
  if (err.code === 'LIMIT_FILE_SIZE' || err.message === 'Only JPG, PNG, or HEIC images are allowed') {
    console.error(err);
    req.flash('error', err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message);
    return res.redirect('/dashboard/artist');
  }
  next(err);
});

module.exports = router;
