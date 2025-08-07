const express = require('express');
const router = express.Router();
const upload = require('../../../middleware/upload');
const randomAvatar = require('../../../utils/avatar');
const { authorize } = require('../../../middleware/auth');
const { generateUniqueSlug } = require('../../../utils/slug');
const { processImages } = require('../../../utils/image');
const csrf = require('csurf');
const csrfProtection = csrf();

const { db } = require('../../../models/db');
const { archiveArtist, unarchiveArtist } = require('../../../models/artistModel');

router.get('/artists', authorize('admin', 'gallery'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  try {
    const artistQuery = req.user.role === 'gallery'
      ? ['SELECT * FROM artists WHERE gallery_slug = ? ORDER BY display_order', [req.user.username]]
      : ['SELECT * FROM artists ORDER BY display_order', []];
    db.all(...artistQuery, (err, artists) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/artists', { artists: [], galleries: [] });
      }
      const fetchGalleries = cb => {
        if (req.user.role === 'gallery') return cb(null, [{ slug: req.user.username }]);
        db.all('SELECT slug FROM galleries', cb);
      };
      fetchGalleries((gErr, galleries) => {
        if (gErr) {
          console.error(gErr);
          req.flash('error', 'Database error');
          return res.render('admin/artists', { artists: [], galleries: [] });
        }
        res.render('admin/artists', { artists, galleries });
      });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('admin/artists', { artists: [], galleries: [] });
  }
});

router.post('/artists', authorize('admin', 'gallery'), csrfProtection, (req, res) => {
  upload.single('bioImageFile')(req, res, async err => {
    if (err) {
      console.error(err);
      return handleArtistResponse(req, res, 400, err.message);
    }
    try {
      let { id, gallery_slug, name, bio, fullBio, bioImageUrl, live } = req.body;
      if (req.user.role === 'gallery') {
        gallery_slug = req.user.username;
      }
      if (!gallery_slug || !name || !bio) {
        return handleArtistResponse(req, res, 400, 'All fields are required');
      }
      if (req.file && bioImageUrl) {
        return handleArtistResponse(req, res, 400, 'Choose either an upload or a URL');
      }
      let avatarUrl = bioImageUrl;
      if (req.file) {
        try {
          const images = await processImages(req.file);
          avatarUrl = images.imageStandard;
        } catch (imageErr) {
          console.error(imageErr);
          return handleArtistResponse(req, res, 500, 'Image processing failed');
        }
      }
      if (!avatarUrl) {
        avatarUrl = randomAvatar();
      }
      if (!id) {
        id = await generateUniqueSlug(db, 'artists', 'id', name);
      }
      const liveVal = live === 'on' || live === '1' || live === 1 || live === true || live === 'true' ? 1 : 0;
      db.get('SELECT COALESCE(MAX(display_order), -1) + 1 AS ord FROM artists WHERE gallery_slug = ?', [gallery_slug], (oErr, row) => {
        if (oErr) {
          console.error(oErr);
          return handleArtistResponse(req, res, 500, 'Database error');
        }
        const stmt = 'INSERT INTO artists (id, gallery_slug, name, bio, fullBio, bioImageUrl, live, display_order) VALUES (?,?,?,?,?,?,?,?)';
        db.run(stmt, [id, gallery_slug, name, bio, fullBio || '', avatarUrl, liveVal, row.ord], err2 => {
          if (err2) {
            console.error(err2);
            return handleArtistResponse(req, res, 500, 'Database error');
          }
          handleArtistResponse(req, res, 201, { id });
        });
      });
    } catch (err2) {
      console.error(err2);
      handleArtistResponse(req, res, 500, 'Server error');
    }
  });
});

function handleArtistResponse(req, res, status, data) {
  if (req.is('application/x-www-form-urlencoded')) {
    if (status >= 400) {
      req.flash('error', data);
      return res.redirect('/dashboard/artists');
    }
    req.flash('success', 'Artist added');
    return res.redirect('/dashboard/artists');
  }
  if (status >= 400) return res.status(status).send(data);
  res.status(status).json(data);
}

router.put('/artists/:id/archive', authorize('admin', 'gallery'), (req, res) => {
  const { id } = req.params;
  const { gallery_slug } = req.user.role === 'gallery' ? { gallery_slug: req.user.username } : req.body;
  archiveArtist(id, gallery_slug, err => {
    if (err) return res.status(500).send('Server error');
    res.sendStatus(204);
  });
});

router.put('/artists/:id/unarchive', authorize('admin', 'gallery'), (req, res) => {
  const { id } = req.params;
  unarchiveArtist(id, req.user.role === 'gallery' ? req.user.username : req.body.gallery_slug, err => {
    if (err) return res.status(500).send('Server error');
    res.sendStatus(204);
  });
});

module.exports = router;
