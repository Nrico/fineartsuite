const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const { requireRole } = require('../../../middleware/auth');
const { generateUniqueSlug } = require('../../../utils/slug');
const { processImages, uploadsDir } = require('../../../utils/image');
const csrf = require('csurf');
const csrfProtection = csrf();

const { db } = require('../../../models/db');
const { archiveArtwork, unarchiveArtwork } = require('../../../models/artworkModel');

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

router.get('/artworks', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  try {
    const artQuery = req.user.role === 'gallery'
      ? ['SELECT a.*, ar.name AS artist_name FROM artworks a LEFT JOIN artists ar ON a.artist_id = ar.id WHERE a.gallery_slug = ?', [req.user.username]]
      : ['SELECT a.*, ar.name AS artist_name FROM artworks a LEFT JOIN artists ar ON a.artist_id = ar.id', []];
    db.all(...artQuery, (err, artworks) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('dashboard/artworks', { artworks: [], collections: [], artists: [] });
      }
      const collQuery = req.user.role === 'gallery'
        ? ['SELECT c.id, c.name FROM collections c JOIN artists a ON c.artist_id = a.id WHERE a.gallery_slug = ?', [req.user.username]]
        : ['SELECT id, name FROM collections', []];
      const artistQuery = req.user.role === 'gallery'
        ? ['SELECT id, name FROM artists WHERE gallery_slug = ? ORDER BY display_order', [req.user.username]]
        : ['SELECT id, name FROM artists ORDER BY display_order', []];
      db.all(...collQuery, (cErr, collections) => {
        if (cErr) {
          console.error(cErr);
          req.flash('error', 'Database error');
          return res.render('dashboard/artworks', { artworks: [], collections: [], artists: [] });
        }
        db.all(...artistQuery, (aErr, artists) => {
          if (aErr) {
            console.error(aErr);
            req.flash('error', 'Database error');
            return res.render('dashboard/artworks', { artworks: [], collections: [], artists: [] });
          }
          res.render('dashboard/artworks', { artworks, collections, artists });
        });
      });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('dashboard/artworks', { artworks: [], collections: [], artists: [] });
  }
});

router.post('/artworks', requireRole('admin', 'gallery'), upload.single('imageFile'), csrfProtection, async (req, res) => {
  try {
    let { id, artist_id, title, medium, custom_medium, dimensions, price, description, framed, readyToHang, imageUrl, status, isVisible, isFeatured } = req.body;
    if (!artist_id || !title || !medium || !dimensions) {
      return res.status(400).send('All fields are required');
    }
    const artist = await new Promise((resolve, reject) => {
      db.get('SELECT id, gallery_slug FROM artists WHERE id = ?', [artist_id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    if (!artist) {
      return res.status(400).send('Artist not found');
    }
    if (req.user.role === 'gallery' && artist.gallery_slug !== req.user.username) {
      return res.status(403).send('Forbidden');
    }
    const gallery_slug = artist.gallery_slug;
    const gallery = await new Promise((resolve, reject) => {
      db.get('SELECT slug FROM galleries WHERE slug = ?', [gallery_slug], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    if (!gallery) {
      return res.status(400).send('Gallery not found');
    }
    if (!id) {
      id = await generateUniqueSlug(db, 'artworks', 'id', title);
    }
    let priceValue = '';
    if (price && price.trim() !== '') {
      const sanitized = price.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(sanitized);
      if (isNaN(parsed)) {
        return res.status(400).send('Price must be a valid number');
      }
      priceValue = parsed.toFixed(2);
    }
    if (req.file && imageUrl) {
      return res.status(400).send('Choose either an upload or a URL');
    }
    if (!req.file && !imageUrl) {
      return res.status(400).send('Image is required');
    }
    let images = {};
    if (req.file) {
      try {
        images = await processImages(req.file);
      } catch (imageErr) {
        console.error(imageErr);
        return res.status(500).send('Image processing failed');
      }
    } else if (imageUrl) {
      images.imageFull = imageUrl;
      images.imageStandard = imageUrl;
      images.imageThumb = imageUrl;
    }
    const stmt = `INSERT INTO artworks (id, gallery_slug, artist_id, title, medium, custom_medium, dimensions, price, imageFull, imageStandard, imageThumb, status, isVisible, isFeatured, description, framed, ready_to_hang) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [id, gallery_slug, artist_id, title, medium, custom_medium || '', dimensions, priceValue, images.imageFull, images.imageStandard, images.imageThumb, status || '', isVisible ? 1 : 0, isFeatured ? 1 : 0, description || '', framed ? 1 : 0, readyToHang ? 1 : 0];
    db.run(stmt, params, runErr => {
      if (runErr) {
        console.error(runErr);
        return res.status(500).send('Database error');
      }
      res.status(201).json({ id });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

router.put('/artworks/:id', requireRole('admin', 'gallery'), upload.single('imageFile'), csrfProtection, async (req, res) => {
  try {
    if (req.user.role === 'gallery') {
      const owner = await new Promise((resolve, reject) => {
        db.get('SELECT gallery_slug FROM artworks WHERE id=?', [req.params.id], (e, row) => e ? reject(e) : resolve(row));
      });
      if (!owner || owner.gallery_slug !== req.user.username) {
        return res.status(403).send('Forbidden');
      }
    }
    const { title, medium, custom_medium, dimensions, price, description, framed, readyToHang, imageUrl, status, isVisible, isFeatured } = req.body;
    const finalMedium = medium === 'other' ? custom_medium : medium;
    let finalPrice = null;
    if (status !== 'collected') {
      if (price && price.trim() !== '') {
        const sanitized = price.replace(/[^0-9.]/g, '');
        const parsed = parseFloat(sanitized);
        if (isNaN(parsed)) {
          return res.status(400).send('Price must be a valid number');
        }
        finalPrice = parsed.toFixed(2);
      } else {
        finalPrice = '';
      }
    }
    let stmt = `UPDATE artworks SET title=?, medium=?, dimensions=?, price=?, status=?, isVisible=?, isFeatured=?, description=?, framed=?, ready_to_hang=?`;
    const params = [title, finalMedium, dimensions, finalPrice, status || '', isVisible ? 1 : 0, isFeatured ? 1 : 0, description || '', framed ? 1 : 0, readyToHang ? 1 : 0];
    if (req.file || imageUrl) {
      if (req.file && imageUrl) {
        return res.status(400).send('Choose either an upload or a URL');
      }
      const images = req.file
        ? await processImages(req.file)
        : { imageFull: imageUrl, imageStandard: imageUrl, imageThumb: imageUrl };
      stmt += ', imageFull=?, imageStandard=?, imageThumb=?';
      params.push(images.imageFull, images.imageStandard, images.imageThumb);
    }
    stmt += ' WHERE id=?';
    params.push(req.params.id);
    db.run(stmt, params, dbErr => {
      if (dbErr) {
        console.error(dbErr);
        return res.status(500).send('Database error');
      }
      res.sendStatus(204);
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

router.patch('/artworks/:id/archive', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  const handle = () => {
    archiveArtwork(req.params.id, err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.sendStatus(204);
    });
  };
  if (req.user.role === 'gallery') {
    db.get('SELECT gallery_slug FROM artworks WHERE id=?', [req.params.id], (err, row) => {
      if (err || !row || row.gallery_slug !== req.user.username) {
        return res.status(403).send('Forbidden');
      }
      handle();
    });
  } else {
    handle();
  }
});

router.patch('/artworks/:id/unarchive', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  const handle = () => {
    unarchiveArtwork(req.params.id, err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.sendStatus(204);
    });
  };
  if (req.user.role === 'gallery') {
    db.get('SELECT gallery_slug FROM artworks WHERE id=?', [req.params.id], (err, row) => {
      if (err || !row || row.gallery_slug !== req.user.username) {
        return res.status(403).send('Forbidden');
      }
      handle();
    });
  } else {
    handle();
  }
});

router.delete('/artworks/:id', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  try {
    const handleDelete = () => {
      db.run('DELETE FROM artworks WHERE id=?', [req.params.id], err => {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }
        res.sendStatus(204);
      });
    };
    if (req.user.role === 'gallery') {
      db.get('SELECT gallery_slug FROM artworks WHERE id=?', [req.params.id], (err, row) => {
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

router.get('/upload', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  fs.readdir(uploadsDir, (err, files) => {
    if (err) files = [];
    db.all('SELECT slug FROM galleries', (gErr, galleries) => {
      const data = files.map(f => ({ name: f, url: '/uploads/' + f }));
      res.render('admin/upload', { files: data, galleries: gErr ? [] : galleries, success: req.query.success });
    });
  });
});

router.post('/upload', requireRole('admin', 'gallery'), upload.single('image'), csrfProtection, async (req, res) => {
  if (!req.file) {
    req.flash('error', 'No file uploaded');
    return res.status(400).redirect('/dashboard/upload');
  }

  let { id, gallery_slug, title, medium, custom_medium, dimensions, price, description, framed, readyToHang, status, isVisible, isFeatured } = req.body;
  if (!gallery_slug || !title || !medium || !dimensions || !status) {
    req.flash('error', 'All fields are required');
    return res.status(400).redirect('/dashboard/upload');
  }

  const gallery = await new Promise((resolve, reject) => {
    db.get('SELECT slug FROM galleries WHERE slug = ?', [gallery_slug], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
  if (!gallery) {
    req.flash('error', 'Gallery not found');
    return res.status(400).redirect('/dashboard/upload');
  }

  db.get('SELECT id FROM artists WHERE gallery_slug = ? LIMIT 1', [gallery_slug], async (artistErr, artist) => {
    if (artistErr || !artist) {
      console.error(artistErr);
      req.flash('error', 'No artist found for gallery');
      return res.status(400).redirect('/dashboard/upload');
    }

    try {
      const artworkId = id && id.trim() !== '' ? id : await generateUniqueSlug(db, 'artworks', 'id', title);
      const finalMedium = medium === 'other' ? custom_medium : medium;
      const finalPrice = status === 'collected' ? null : price;
      const images = await processImages(req.file);
      const stmt = `INSERT INTO artworks (id, artist_id, title, medium, dimensions, price, imageFull, imageStandard, imageThumb, status, isVisible, isFeatured, description, framed, ready_to_hang) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      db.run(stmt, [artworkId, artist.id, title, finalMedium, dimensions, finalPrice, images.imageFull, images.imageStandard, images.imageThumb, status, isVisible ? 1 : 0, isFeatured ? 1 : 0, description || '', framed ? 1 : 0, readyToHang ? 1 : 0], runErr => {
        if (runErr) {
          console.error(runErr);
          req.flash('error', 'Database error');
          return res.status(500).redirect('/dashboard/upload');
        }
        res.redirect('/dashboard/upload?success=1');
      });
    } catch (procErr) {
      console.error(procErr);
      req.flash('error', 'Image processing failed');
      return res.status(500).redirect('/dashboard/upload');
    }
  });
});

module.exports = router;
