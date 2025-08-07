const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireRole } = require('../../middleware/auth');
const csrf = require('csurf');
const csrfProtection = csrf();
const { processImages, uploadsDir } = require('../../utils/image');
const { slugify } = require('../../utils/slug');
const { createCollection, getCollectionsByArtist, updateCollection } = require('../../models/collectionModel');
const { getArtistById, updateArtist, setArtistLive } = require('../../models/artistModel');
const { body, param, validationResult } = require('express-validator');

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

const collectionValidation = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 })
];

const profileValidation = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }),
  body('bio').trim().notEmpty().withMessage('Short bio is required')
    .isLength({ max: 1000 }),
  body('fullBio').optional().isLength({ max: 5000 }),
  body('bioImageUrl').optional({ checkFalsy: true }).isURL().isLength({ max: 2048 }),
  body('currentBioImageUrl').optional().isString().isLength({ max: 2048 })
];

router.get('/', requireRole('artist'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  getArtistById(req.session.user.id, (err, artist) => {
    res.render('dashboard/artist', {
      user: req.session.user,
      artist: artist || {}
    });
  });
});

router.get('/profile', requireRole('artist'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  getArtistById(req.session.user.id, (err, artist) => {
    res.render('dashboard/artist-profile', {
      user: req.session.user,
      artist: artist || {}
    });
  });
});

router.get('/collections', requireRole('artist'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  getCollectionsByArtist(req.session.user.id, (err, collections) => {
    res.render('dashboard/artist-collections', {
      user: req.session.user,
      collections: collections || []
    });
  });
});

router.post('/collections', requireRole('artist'), csrfProtection, collectionValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array()[0].msg);
    return res.redirect('/dashboard/artist/collections');
  }
  const { name } = req.body;
  const slug = slugify(name);
  createCollection(name, req.session.user.id, slug, err => {
    if (err) req.flash('error', 'Could not create collection');
    res.redirect('/dashboard/artist/collections');
  });
});

router.post('/collections/:id', requireRole('artist'), csrfProtection,
  [param('id').trim().notEmpty().withMessage('ID is required'), ...collectionValidation],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/dashboard/artist/collections');
    }
    const { name } = req.body;
    updateCollection(req.params.id, name, err => {
      if (err) req.flash('error', 'Could not update collection');
      res.redirect('/dashboard/artist/collections');
    });
  }
);

router.post('/publish', requireRole('artist'), csrfProtection, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array()[0].msg);
    return res.redirect('/dashboard/artist');
  }
  setArtistLive(req.session.user.id, 1, err => {
    if (err) {
      req.flash('error', 'Could not publish site');
    } else {
      req.flash('success', 'Site published');
    }
    res.redirect('/dashboard/artist');
  });
});

router.post('/profile', requireRole('artist'), upload.single('bioImageFile'), csrfProtection, profileValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array()[0].msg);
    return res.redirect('/dashboard/artist/profile');
  }
  try {
    const { name, bio, fullBio, bioImageUrl, currentBioImageUrl } = req.body;
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
