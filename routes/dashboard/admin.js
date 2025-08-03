const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const randomAvatar = require('../../utils/avatar');
let Jimp;
try {
  Jimp = require('jimp');
} catch (err) {
  console.warn('jimp not installed, images will be copied without resizing');
}

const { db } = require('../../models/db');

function requireRole(...roles) {
  return function(req, res, next) {
    if (!req.user) {
      return res.redirect('/login');
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).send('Forbidden');
    }
    next();
  };
}

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
    fileSize: 10 * 1024 * 1024 // 10MB
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

// Gallery dashboard for gallery role
router.get('/gallery', requireRole('gallery'), (req, res) => {
  res.render('dashboard/gallery', { user: req.session.user });
});

// Admin dashboard
router.get('/', requireRole('admin'), (req, res) => {
  res.render('admin/dashboard', { user: req.session.user });
});

router.get('/galleries', requireRole('admin', 'gallery'), (req, res) => {
  try {
    const query = req.user.role === 'gallery'
      ? 'SELECT slug, name, bio FROM galleries WHERE slug = ?'
      : 'SELECT slug, name, bio FROM galleries';
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

router.get('/artists', requireRole('admin', 'gallery'), (req, res) => {
  try {
    const artistQuery = req.user.role === 'gallery'
      ? ['SELECT * FROM artists WHERE gallery_slug = ?', [req.user.username]]
      : ['SELECT * FROM artists', []];
    db.all(...artistQuery, (err, artists) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/artists', { artists: [], galleries: [], generatedId: '' });
      }
      const fetchGalleries = cb => {
        if (req.user.role === 'gallery') return cb(null, [{ slug: req.user.username }]);
        db.all('SELECT slug FROM galleries', cb);
      };
      fetchGalleries((gErr, galleries) => {
        if (gErr) {
          console.error(gErr);
          req.flash('error', 'Database error');
          return res.render('admin/artists', { artists: [], galleries: [], generatedId: '' });
        }
        const generatedId = 'artist_' + Date.now();
        res.render('admin/artists', { artists, galleries, generatedId });
      });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('admin/artists', { artists: [], galleries: [], generatedId: '' });
  }
});

router.get('/artworks', requireRole('admin', 'gallery'), (req, res) => {
  try {
    const artQuery = req.user.role === 'gallery'
      ? ['SELECT a.*, ar.name AS artist_name FROM artworks a LEFT JOIN artists ar ON a.artist_id = ar.id WHERE a.gallery_slug = ?', [req.user.username]]
      : ['SELECT a.*, ar.name AS artist_name FROM artworks a LEFT JOIN artists ar ON a.artist_id = ar.id', []];
    db.all(...artQuery, (err, artworks) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('dashboard/artworks', { artworks: [], collections: [], generatedId: '' });
      }
      const collQuery = req.user.role === 'gallery'
        ? ['SELECT c.id, c.name FROM collections c JOIN artists a ON c.artist_id = a.id WHERE a.gallery_slug = ?', [req.user.username]]
        : ['SELECT id, name FROM collections', []];
      db.all(...collQuery, (cErr, collections) => {
        if (cErr) {
          console.error(cErr);
          req.flash('error', 'Database error');
          return res.render('dashboard/artworks', { artworks: [], collections: [], generatedId: '' });
        }
        const generatedId = 'art_' + Date.now();
        res.render('dashboard/artworks', { artworks, collections, generatedId });
      });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('dashboard/artworks', { artworks: [], collections: [], generatedId: '' });
  }
});

router.post('/galleries', requireRole('admin', 'gallery'), (req, res) => {
  try {
    const { slug, name, bio } = req.body;
    if (!slug || !name || !bio) {
      req.flash('error', 'All fields are required');
      return res.redirect('/dashboard/galleries');
    }
    if (req.user.role === 'gallery' && slug !== req.user.username) {
      req.flash('error', 'Forbidden');
      return res.redirect('/dashboard/galleries');
    }
    const stmt = 'INSERT INTO galleries (slug, name, bio) VALUES (?,?,?)';
    db.run(stmt, [slug, name, bio], err => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.redirect('/dashboard/galleries');
      }
      req.flash('success', 'Gallery added');
      res.redirect('/dashboard/galleries');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.redirect('/dashboard/galleries');
  }
});

router.put('/galleries/:slug', requireRole('admin', 'gallery'), (req, res) => {
  try {
    if (req.user.role === 'gallery' && req.params.slug !== req.user.username) {
      return res.status(403).send('Forbidden');
    }
    const { slug, name, bio } = req.body;
    const newSlug = req.user.role === 'gallery' ? req.user.username : slug;
    const stmt = 'UPDATE galleries SET slug = ?, name = ?, bio = ? WHERE slug = ?';
    db.run(stmt, [newSlug, name, bio, req.params.slug], err => {
      if (err) {
        console.error(err);
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

router.post('/artists', requireRole('admin', 'gallery'), (req, res) => {
  upload.single('bioImageFile')(req, res, async err => {
    if (err) {
      console.error(err);
      req.flash('error', err.message);
      return res.redirect('/dashboard/artists');
    }
    try {
      let { id, gallery_slug, name, bio, fullBio, bioImageUrl } = req.body;
      if (req.user.role === 'gallery') {
        gallery_slug = req.user.username;
      }
      if (!id || !gallery_slug || !name || !bio) {
        req.flash('error', 'All fields are required');
        return res.redirect('/dashboard/artists');
      }
      if (req.file && bioImageUrl) {
        req.flash('error', 'Choose either an upload or a URL');
        return res.redirect('/dashboard/artists');
      }
      let avatarUrl = bioImageUrl;
      if (req.file) {
        try {
          const images = await processImages(req.file);
          avatarUrl = images.imageStandard;
        } catch (imageErr) {
          console.error(imageErr);
          req.flash('error', 'Image processing failed');
          return res.redirect('/dashboard/artists');
        }
      }
      if (!avatarUrl) {
        avatarUrl = randomAvatar();
      }
      const stmt = 'INSERT INTO artists (id, gallery_slug, name, bio, fullBio, bioImageUrl) VALUES (?,?,?,?,?,?)';
      db.run(stmt, [id, gallery_slug, name, bio, fullBio || '', avatarUrl], err2 => {
        if (err2) {
          console.error(err2);
          req.flash('error', 'Database error');
          return res.redirect('/dashboard/artists');
        }
        req.flash('success', 'Artist added');
        res.redirect('/dashboard/artists');
      });
    } catch (err2) {
      console.error(err2);
      req.flash('error', 'Server error');
      res.redirect('/dashboard/artists');
    }
  });
});

router.put('/artists/:id', requireRole('admin', 'gallery'), async (req, res) => {
  try {
    if (req.user.role === 'gallery') {
      const owner = await new Promise((resolve, reject) => {
        db.get('SELECT gallery_slug FROM artists WHERE id = ?', [req.params.id], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });
      if (!owner || owner.gallery_slug !== req.user.username) {
        return res.status(403).send('Forbidden');
      }
    }
    const { name, bio, fullBio, bioImageUrl, gallery_slug } = req.body;
    const avatarUrl = bioImageUrl || randomAvatar();
    let stmt = 'UPDATE artists SET name = ?, bio = ?, fullBio = ?, bioImageUrl = ?';
    const params = [name, bio, fullBio || '', avatarUrl];
    if (req.user.role === 'admin' && gallery_slug) {
      stmt += ', gallery_slug = ?';
      params.push(gallery_slug);
    }
    stmt += ' WHERE id = ?';
    params.push(req.params.id);
    db.run(stmt, params, err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Artist saved');
      res.sendStatus(204);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.delete('/artists/:id', requireRole('admin', 'gallery'), (req, res) => {
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

router.post('/artworks', requireRole('admin', 'gallery'), (req, res) => {
  upload.single('imageFile')(req, res, async err => {
    if (err) {
      console.error(err);
      req.flash('error', err.message);
      return res.redirect('/dashboard/artworks');
    }
    try {
      let { id, gallery_slug, artist_id, title, medium, custom_medium, dimensions, price, imageUrl, status, isVisible, isFeatured } = req.body;
      if (req.user.role === 'gallery') {
        gallery_slug = req.user.username;
      }
      if (!id || !gallery_slug || !artist_id || !title || !medium || !dimensions) {
        req.flash('error', 'All fields are required');
        return res.redirect('/dashboard/artworks');
      }
      let priceValue = '';
      if (price && price.trim() !== '') {
        const sanitized = price.replace(/[^0-9.]/g, '');
        const parsed = parseFloat(sanitized);
        if (isNaN(parsed)) {
          req.flash('error', 'Price must be a valid number');
          return res.redirect('/dashboard/artworks');
        }
        priceValue = parsed.toFixed(2);
      }
      if (req.file && imageUrl) {
        req.flash('error', 'Choose either an upload or a URL');
        return res.redirect('/dashboard/artworks');
      }
      if (!req.file && !imageUrl) {
        req.flash('error', 'Image is required');
        return res.redirect('/dashboard/artworks');
      }
      const gallery = await new Promise((resolve, reject) => {
        db.get('SELECT slug FROM galleries WHERE slug = ?', [gallery_slug], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });
      if (!gallery) {
        req.flash('error', 'Gallery not found');
        return res.redirect('/dashboard/artworks');
      }
      const artist = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM artists WHERE id = ? AND gallery_slug = ?', [artist_id, gallery_slug], (err, row) => {
          if (err) reject(err); else resolve(row);
        });
      });
      if (!artist) {
        req.flash('error', 'Artist not found');
        return res.redirect('/dashboard/artworks');
      }
      let images = {};
      if (req.file) {
        try {
          images = await processImages(req.file);
        } catch (imageErr) {
          console.error(imageErr);
          req.flash('error', 'Image processing failed');
          return res.status(500).redirect('/dashboard/artworks');
        }
      } else if (imageUrl) {
        images.imageFull = imageUrl;
        images.imageStandard = imageUrl;
        images.imageThumb = imageUrl;
      }
      const stmt = `INSERT INTO artworks (id, gallery_slug, artist_id, title, medium, custom_medium, dimensions, price, imageFull, imageStandard, imageThumb, status, isVisible, isFeatured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      const params = [id, gallery_slug, artist_id, title, medium, custom_medium || '', dimensions, priceValue, images.imageFull, images.imageStandard, images.imageThumb, status || '', isVisible ? 1 : 0, isFeatured ? 1 : 0];
      db.run(stmt, params, runErr => {
        if (runErr) {
          console.error(runErr);
          req.flash('error', 'Database error');
          return res.redirect('/dashboard/artworks');
        }
        req.flash('success', 'Artwork added');
        res.redirect('/dashboard/artworks');
      });
    } catch (error) {
      console.error(error);
      req.flash('error', 'Server error');
      res.redirect('/dashboard/artworks');
    }
  });
});

router.put('/artworks/:id', requireRole('admin', 'gallery'), async (req, res) => {
  upload.single('imageFile')(req, res, async err => {
    if (err) {
      console.error(err);
      return res.status(400).send(err.message);
    }
    try {
      if (req.user.role === 'gallery') {
        const owner = await new Promise((resolve, reject) => {
          db.get('SELECT gallery_slug FROM artworks WHERE id=?', [req.params.id], (e, row) => e ? reject(e) : resolve(row));
        });
        if (!owner || owner.gallery_slug !== req.user.username) {
          return res.status(403).send('Forbidden');
        }
      }
      const { title, medium, custom_medium, dimensions, price, imageUrl, status, isVisible, isFeatured } = req.body;
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
      let stmt = `UPDATE artworks SET title=?, medium=?, dimensions=?, price=?, status=?, isVisible=?, isFeatured=?`;
      const params = [title, finalMedium, dimensions, finalPrice, status || '', isVisible ? 1 : 0, isFeatured ? 1 : 0];
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
});

router.delete('/artworks/:id', requireRole('admin', 'gallery'), (req, res) => {
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

router.get('/upload', requireRole('admin', 'gallery'), (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) files = [];
    db.all('SELECT slug FROM galleries', (gErr, galleries) => {
      const data = files.map(f => ({ name: f, url: '/uploads/' + f }));
      const generatedId = 'art_' + Date.now();
      res.render('admin/upload', { files: data, galleries: gErr ? [] : galleries, success: req.query.success, generatedId });
    });
  });
});

router.post('/upload', requireRole('admin', 'gallery'), (req, res) => {
  upload.single('image')(req, res, async err => {
    if (err) {
      console.error(err);
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
      req.flash('error', message);
      return res.status(400).redirect('/dashboard/upload');
    }
    if (!req.file) {
      req.flash('error', 'No file uploaded');
      return res.status(400).redirect('/dashboard/upload');
    }

    const { id, gallery_slug, title, medium, custom_medium, dimensions, price, status, isVisible, isFeatured } = req.body;
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
        const artworkId = id && id.trim() !== '' ? id : 'art_' + Date.now();
        const finalMedium = medium === 'other' ? custom_medium : medium;
        const finalPrice = status === 'collected' ? null : price;
        const images = await processImages(req.file);
        const stmt = `INSERT INTO artworks (id, artist_id, title, medium, dimensions, price, imageFull, imageStandard, imageThumb, status, isVisible, isFeatured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
        db.run(stmt, [artworkId, artist.id, title, finalMedium, dimensions, finalPrice, images.imageFull, images.imageStandard, images.imageThumb, status, isVisible ? 1 : 0, isFeatured ? 1 : 0], runErr => {
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
});

router.get('/settings', requireRole('admin', 'gallery'), (req, res) => {
  db.get('SELECT * FROM gallery_settings WHERE id = 1', (err, settings) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Database error');
      return res.render('admin/settings', { settings: {} });
    }
    res.render('admin/settings', { settings: settings || {} });
  });
});

router.post('/settings', requireRole('admin', 'gallery'), (req, res) => {
  upload.single('logo')(req, res, err => {
    if (err) {
      console.error(err);
      req.flash('error', err.message);
      return res.redirect('/dashboard/settings');
    }
    const { name, slug, phone, email, address, description, owner } = req.body;
    const logo = req.file ? req.file.filename : req.body.existingLogo || null;
    const slugRegex = /^[a-z0-9-]+$/;
    const reservedRoutes = ['dashboard', 'login', 'logout'];
    if (!slugRegex.test(slug)) {
      req.flash('error', 'Invalid slug format. Use lowercase letters, numbers, or hyphens.');
      return res.redirect('/dashboard/settings');
    }
    if (reservedRoutes.includes(slug)) {
      req.flash('error', 'Slug conflicts with an existing route.');
      return res.redirect('/dashboard/settings');
    }
    db.get('SELECT slug FROM gallery_settings WHERE id = 1', (sErr, current) => {
      if (sErr) {
        console.error(sErr);
        req.flash('error', 'Database error');
        return res.redirect('/dashboard/settings');
      }
      const currentSlug = current ? current.slug : null;
      db.get('SELECT slug FROM galleries WHERE slug = ?', [slug], (checkErr, row) => {
        if (checkErr) {
          console.error(checkErr);
          req.flash('error', 'Database error');
          return res.redirect('/dashboard/settings');
        }
        if (row && slug !== currentSlug) {
          req.flash('error', 'Slug conflicts with an existing gallery.');
          return res.redirect('/dashboard/settings');
        }
        const stmt = `INSERT INTO gallery_settings (id, name, slug, phone, email, address, description, owner, logo)
                     VALUES (1,?,?,?,?,?,?,?,?)
                     ON CONFLICT(id) DO UPDATE SET
                       name=excluded.name,
                       slug=excluded.slug,
                       phone=excluded.phone,
                       email=excluded.email,
                       address=excluded.address,
                       description=excluded.description,
                       owner=excluded.owner,
                       logo=excluded.logo`;
        db.run(stmt, [name, slug, phone, email, address, description, owner, logo], runErr => {
          if (runErr) {
            console.error(runErr);
            req.flash('error', 'Database error');
            return res.redirect('/dashboard/settings');
          }
          const galleryStmt = currentSlug
            ? 'UPDATE galleries SET slug = ?, name = ? WHERE slug = ?'
            : 'INSERT INTO galleries (slug, name) VALUES (?, ?)';
          const galleryParams = currentSlug ? [slug, name, currentSlug] : [slug, name];
          db.run(galleryStmt, galleryParams, gErr => {
            if (gErr) {
              console.error(gErr);
              req.flash('error', 'Database error');
            } else {
              req.flash('success', `Settings saved. Your gallery URL: /${slug}`);
            }
            res.redirect('/dashboard/settings');
          });
        });
      });
    });
  });
});

module.exports = router;
