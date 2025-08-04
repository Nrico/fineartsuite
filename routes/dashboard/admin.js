const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const randomAvatar = require('../../utils/avatar');
const { requireRole } = require('../../middleware/auth');
const { generateUniqueSlug } = require('../../utils/slug');
const { processImages, uploadsDir } = require('../../utils/image');
const csrf = require('csurf');
const csrfProtection = csrf();

const { db } = require('../../models/db');
const { archiveArtist, unarchiveArtist } = require('../../models/artistModel');
const { archiveArtwork, unarchiveArtwork } = require('../../models/artworkModel');

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

// Gallery dashboard for gallery role
router.get('/gallery', requireRole('gallery'), (req, res) => {
  res.render('dashboard/gallery', { user: req.session.user });
});

// Admin dashboard
router.get('/', requireRole('admin'), (req, res) => {
  res.render('admin/dashboard', { user: req.session.user });
});

router.get('/galleries', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  try {
    const baseQuery = 'SELECT slug, name, bio AS description, contact_email AS email, phone, address, gallarist_name AS owner, logo_url FROM galleries';
    const query = req.user.role === 'gallery'
      ? baseQuery + ' WHERE slug = ?'
      : baseQuery;
    const params = req.user.role === 'gallery' ? [req.user.username] : [];
    db.all(query, params, (err, galleries) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/galleries', { galleries: [] });
      }
      res.render('admin/galleries', { galleries });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('admin/galleries', { galleries: [] });
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

router.post('/galleries', requireRole('admin', 'gallery'), upload.single('logoFile'), csrfProtection, async (req, res) => {
  try {
    let { name, description, email, phone, address, owner, logoUrl } = req.body;
    if (!name || !description) {
      return handleGalleryResponse(req, res, 400, 'All fields are required');
    }
    const slug = req.user.role === 'gallery'
      ? req.user.username
      : await generateUniqueSlug(db, 'galleries', 'slug', name);
    let logo_url = logoUrl || null;
    if (req.file) {
      try {
        const images = await processImages(req.file);
        logo_url = images.imageStandard;
      } catch (imageErr) {
        console.error(imageErr);
        return handleGalleryResponse(req, res, 500, 'Image processing failed');
      }
    }
    const stmt = 'INSERT INTO galleries (slug, name, bio, contact_email, phone, address, gallarist_name, logo_url) VALUES (?,?,?,?,?,?,?,?)';
    db.run(stmt, [slug, name, description, email || null, phone || null, address || null, owner || null, logo_url], err2 => {
      if (err2) {
        console.error(err2);
        return handleGalleryResponse(req, res, 500, 'Database error');
      }
      handleGalleryResponse(req, res, 201, { slug });
    });
  } catch (err) {
    console.error(err);
    handleGalleryResponse(req, res, 500, 'Server error');
  }
});

function handleGalleryResponse(req, res, status, data) {
  if (req.is('application/x-www-form-urlencoded')) {
    if (status >= 400) {
      req.flash('error', data);
      return res.redirect('/dashboard/galleries');
    }
    req.flash('success', 'Gallery added');
    return res.redirect('/dashboard/galleries');
  }
  if (status >= 400) return res.status(status).send(data);
  res.status(status).json(data);
}

router.put('/galleries/:slug', requireRole('admin', 'gallery'), upload.single('logoFile'), csrfProtection, async (req, res) => {
  try {
    if (req.user.role === 'gallery' && req.params.slug !== req.user.username) {
      return res.status(403).send('Forbidden');
    }
    const { name, description, email, phone, address, owner, logoUrl } = req.body;
    let logo_url = logoUrl || null;
    if (req.file) {
      try {
        const images = await processImages(req.file);
        logo_url = images.imageStandard;
      } catch (imageErr) {
        console.error(imageErr);
        return res.status(500).send('Image processing failed');
      }
    }
    const stmt = 'UPDATE galleries SET name = ?, bio = ?, contact_email = ?, phone = ?, address = ?, gallarist_name = ?, logo_url = ? WHERE slug = ?';
    db.run(stmt, [name, description, email || null, phone || null, address || null, owner || null, logo_url, req.params.slug], err2 => {
      if (err2) {
        console.error(err2);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Gallery saved');
      res.sendStatus(204);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.delete('/galleries/:slug', requireRole('admin', 'gallery'), (req, res) => {
  try {
    if (req.user.role === 'gallery' && req.params.slug !== req.user.username) {
      return res.status(403).send('Forbidden');
    }
    db.run('DELETE FROM galleries WHERE slug = ?', [req.params.slug], err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Gallery deleted');
      res.sendStatus(204);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
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

router.post('/artworks', requireRole('admin', 'gallery'), upload.single('imageFile'), csrfProtection, async (req, res) => {
  try {
    let { id, artist_id, title, medium, custom_medium, dimensions, price, description, framed, readyToHang, imageUrl, status, isVisible, isFeatured } = req.body;
    if (!artist_id || !title || !medium || !dimensions) {
      req.flash('error', 'All fields are required');
      return res.status(400).send('All fields are required');
    }
    const artist = await new Promise((resolve, reject) => {
      db.get('SELECT id, gallery_slug FROM artists WHERE id = ?', [artist_id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.status(400).send('Artist not found');
    }
    if (req.user.role === 'gallery' && artist.gallery_slug !== req.user.username) {
      req.flash('error', 'Artist not found');
      return res.status(403).send('Forbidden');
    }
    const gallery_slug = artist.gallery_slug;
    const gallery = await new Promise((resolve, reject) => {
      db.get('SELECT slug FROM galleries WHERE slug = ?', [gallery_slug], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    if (!gallery) {
      req.flash('error', 'Gallery not found');
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
        req.flash('error', 'Price must be a valid number');
        return res.status(400).send('Price must be a valid number');
      }
      priceValue = parsed.toFixed(2);
    }
    if (req.file && imageUrl) {
      req.flash('error', 'Choose either an upload or a URL');
      return res.status(400).send('Choose either an upload or a URL');
    }
    if (!req.file && !imageUrl) {
      req.flash('error', 'Image is required');
      return res.status(400).send('Image is required');
    }
    let images = {};
    if (req.file) {
      try {
        images = await processImages(req.file);
      } catch (imageErr) {
        console.error(imageErr);
        req.flash('error', 'Image processing failed');
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
        req.flash('error', 'Database error');
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Artwork added');
      res.status(201).json({ id });
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Server error');
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
      req.flash('success', 'Artwork saved');
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
      req.flash('success', 'Artwork archived');
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
      req.flash('success', 'Artwork unarchived');
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
        req.flash('success', 'Artwork deleted');
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

router.get('/settings', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  const slug = req.user.role === 'gallery' ? req.user.username : req.query.slug;
  db.get(
    'SELECT name, contact_email AS email, phone, address, bio AS description, gallarist_name AS owner, logo_url FROM galleries WHERE slug = ?',
    [slug],
    (err, settings) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/settings', { settings: {} });
      }
      res.render('admin/settings', { settings: settings || {} });
    }
  );
});

router.post(
  '/settings',
  requireRole('admin', 'gallery'),
  upload.single('logoFile'),
  csrfProtection,
  async (req, res) => {
    try {
      const slug = req.user.role === 'gallery' ? req.user.username : req.body.slug;
      let { name, phone, email, address, description, owner, logoUrl, existingLogo } = req.body;
      let logo_url = logoUrl || existingLogo || null;
      if (req.file) {
        try {
          const images = await processImages(req.file);
          logo_url = images.imageStandard;
        } catch (imageErr) {
          console.error(imageErr);
          req.flash('error', 'Image processing failed');
          return res.redirect('/dashboard/settings');
        }
      }
      const stmt =
        'UPDATE galleries SET name = ?, phone = ?, contact_email = ?, address = ?, bio = ?, gallarist_name = ?, logo_url = ? WHERE slug = ?';
      db.run(
        stmt,
        [name, phone || null, email || null, address || null, description || null, owner || null, logo_url, slug],
        err => {
          if (err) {
            console.error(err);
            req.flash('error', 'Database error');
          } else {
            req.flash('success', 'Settings saved');
          }
          res.redirect('/dashboard/settings');
        }
      );
    } catch (err) {
      console.error(err);
      req.flash('error', 'Server error');
      res.redirect('/dashboard/settings');
    }
  }
);

router.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF token mismatch on admin route', err);
    return res.status(403).send('Invalid CSRF token');
  }
  if (err.code === 'LIMIT_FILE_SIZE' || err.message === 'Only JPG, PNG, or HEIC images are allowed') {
    console.error(err);
    req.flash('error', err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message);
    const redirectPath = req.originalUrl.includes('/upload') ? '/dashboard/upload' : '/dashboard/artworks';
    return res.status(400).redirect(redirectPath);
  }
  next(err);
});

module.exports = router;
