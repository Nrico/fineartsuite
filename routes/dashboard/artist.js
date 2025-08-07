const express = require('express');
const router = express.Router();
const { authorize } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const csrf = require('csurf');
const csrfProtection = csrf();
const { processImages } = require('../../utils/image');
const { slugify } = require('../../utils/slug');
const { createCollection, getCollectionsByArtist, updateCollection } = require('../../models/collectionModel');
const { getArtistById, updateArtist, setArtistLive } = require('../../models/artistModel');

router.get('/', authorize('artist'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  getArtistById(req.session.user.id, (err, artist) => {
    res.render('dashboard/artist', {
      user: req.session.user,
      artist: artist || {}
    });
  });
});

router.get('/profile', authorize('artist'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  getArtistById(req.session.user.id, (err, artist) => {
    res.render('dashboard/artist-profile', {
      user: req.session.user,
      artist: artist || {}
    });
  });
});

router.get('/collections', authorize('artist'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  getCollectionsByArtist(req.session.user.id, (err, collections) => {
    res.render('dashboard/artist-collections', {
      user: req.session.user,
      collections: collections || []
    });
  });
});

router.post('/collections', authorize('artist'), csrfProtection, (req, res) => {
  const { name } = req.body;
  const slug = slugify(name);
  createCollection(name, req.session.user.id, slug, err => {
    if (err) req.flash('error', 'Could not create collection');
    res.redirect('/dashboard/artist/collections');
  });
});

router.post('/collections/:id', authorize('artist'), csrfProtection, (req, res) => {
  const { name } = req.body;
  updateCollection(req.params.id, name, err => {
    if (err) req.flash('error', 'Could not update collection');
    res.redirect('/dashboard/artist/collections');
  });
});

router.post('/publish', authorize('artist'), csrfProtection, (req, res) => {
  setArtistLive(req.session.user.id, 1, err => {
    if (err) {
      req.flash('error', 'Could not publish site');
    } else {
      req.flash('success', 'Site published');
    }
    res.redirect('/dashboard/artist');
  });
});

router.post('/profile', authorize('artist'), upload.single('bioImageFile'), csrfProtection, async (req, res) => {
  try {
    const { name, bio, fullBio, bioImageUrl, currentBioImageUrl } = req.body;
    if (!name || !bio) {
      req.flash('error', 'Name and short bio are required');
      return res.redirect('/dashboard/artist/profile');
    }
    if (req.file && bioImageUrl) {
      req.flash('error', 'Choose either an upload or a URL');
      return res.redirect('/dashboard/artist/profile');
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
      res.redirect('/dashboard/artist/profile');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Image processing failed');
    res.redirect('/dashboard/artist/profile');
  }
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
