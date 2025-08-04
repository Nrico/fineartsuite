const express = require('express');
const router = express.Router();
const multer = require('multer');
const randomAvatar = require('../../../utils/avatar');
const { requireRole } = require('../../../middleware/auth');
const { generateUniqueSlug } = require('../../../utils/slug');
const { processImages, uploadsDir } = require('../../../utils/image');
const csrf = require('csurf');
const csrfProtection = csrf();

const { db } = require('../../../models/db');
const { archiveArtist, unarchiveArtist } = require('../../../models/artistModel');

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
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

router.get('/artists', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
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

router.post('/artists', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
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

router.put('/artists/:id', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  upload.single('bioImageFile')(req, res, async err => {
    if (err) {
      console.error(err);
      return res.status(400).send(err.message);
    }
    try {
      if (req.user.role === 'gallery') {
        const owner = await new Promise((resolve, reject) => {
          db.get('SELECT gallery_slug FROM artists WHERE id = ?', [req.params.id], (error, row) => {
            if (error) reject(error); else resolve(row);
          });
        });
        if (!owner || owner.gallery_slug !== req.user.username) {
          return res.status(403).send('Forbidden');
        }
      }
      let { name, bio, fullBio, bioImageUrl, gallery_slug, live } = req.body;
      let avatarUrl = bioImageUrl;
      if (req.file) {
        try {
          const images = await processImages(req.file);
          avatarUrl = images.imageStandard;
        } catch (imageErr) {
          console.error(imageErr);
          return res.status(500).send('Image processing failed');
        }
      }
      if (!avatarUrl) {
        avatarUrl = randomAvatar();
      }
      let stmt = 'UPDATE artists SET name = ?, bio = ?, fullBio = ?, bioImageUrl = ?';
      const params = [name, bio, fullBio || '', avatarUrl];
      if (typeof live !== 'undefined') {
        const liveVal = live === 'on' || live === '1' || live === 1 || live === true || live === 'true' ? 1 : 0;
        stmt += ', live = ?';
        params.push(liveVal);
      }
      if (req.user.role === 'admin' && gallery_slug) {
        stmt += ', gallery_slug = ?';
        params.push(gallery_slug);
      }
      stmt += ' WHERE id = ?';
      params.push(req.params.id);
      db.run(stmt, params, err2 => {
        if (err2) {
          console.error(err2);
          return res.status(500).send('Database error');
        }
        req.flash('success', 'Artist saved');
        res.sendStatus(204);
      });
    } catch (err2) {
      console.error(err2);
      res.status(500).send('Server error');
    }
  });
});

router.patch('/artists/:id/live', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  const liveVal = req.body.live ? 1 : 0;
  const handle = () => {
    db.run('UPDATE artists SET live = ? WHERE id = ?', [liveVal, req.params.id], err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.sendStatus(204);
    });
  };
  if (req.user.role === 'gallery') {
    db.get('SELECT gallery_slug FROM artists WHERE id = ?', [req.params.id], (err, row) => {
      if (err || !row || row.gallery_slug !== req.user.username) {
        return res.status(403).send('Forbidden');
      }
      handle();
    });
  } else {
    handle();
  }
});

router.patch('/artists/order', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).send('Invalid order');
  const stmt = req.user.role === 'gallery'
    ? db.prepare('UPDATE artists SET display_order = ? WHERE id = ? AND gallery_slug = ?')
    : db.prepare('UPDATE artists SET display_order = ? WHERE id = ?');
  db.serialize(() => {
    order.forEach((id, idx) => {
      const params = req.user.role === 'gallery' ? [idx, id, req.user.username] : [idx, id];
      stmt.run(params);
    });
    stmt.finalize(err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.sendStatus(204);
    });
  });
});

router.delete('/artists/:id', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  try {
    const handleDelete = () => {
      db.run('DELETE FROM artists WHERE id = ?', [req.params.id], err => {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }
        req.flash('success', 'Artist deleted');
        res.sendStatus(204);
      });
    };
    if (req.user.role === 'gallery') {
      db.get('SELECT gallery_slug FROM artists WHERE id = ?', [req.params.id], (err, row) => {
        if (err || !row || row.gallery_slug !== req.user.username) {
          return res.status(403).send('Forbidden');
        }
        handleDelete();
      });
    } else {
      handleDelete();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.patch('/artists/:id/archive', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  const handle = () => {
    archiveArtist(req.params.id, err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Artist archived');
      res.sendStatus(204);
    });
  };
  if (req.user.role === 'gallery') {
    db.get('SELECT gallery_slug FROM artists WHERE id = ?', [req.params.id], (err, row) => {
      if (err || !row || row.gallery_slug !== req.user.username) {
        return res.status(403).send('Forbidden');
      }
      handle();
    });
  } else {
    handle();
  }
});

router.patch('/artists/:id/unarchive', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  const handle = () => {
    unarchiveArtist(req.params.id, err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Artist unarchived');
      res.sendStatus(204);
    });
  };
  if (req.user.role === 'gallery') {
    db.get('SELECT gallery_slug FROM artists WHERE id = ?', [req.params.id], (err, row) => {
      if (err || !row || row.gallery_slug !== req.user.username) {
        return res.status(403).send('Forbidden');
      }
      handle();
    });
  } else {
    handle();
  }
});

module.exports = router;
