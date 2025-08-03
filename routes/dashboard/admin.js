const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
let Jimp;
try {
  Jimp = require('jimp');
} catch (err) {
  console.warn('jimp not installed, images will be copied without resizing');
}

const { db } = require('../../models/db');

function simulateAuth(req, res, next) {
  if (!req.session.user) {
    req.session.user = { username: 'demoAdmin', role: 'admin' };
  }
  next();
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  res.redirect('/login');
}

function requireRole(role) {
  return function(req, res, next) {
    if (!req.user) {
      return res.redirect('/login');
    }
    if (req.user.role !== role) {
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
  if (Jimp) {
    try {
      const image = await Jimp.read(file.path);
      await image.clone().scaleToFit(2000, 2000).writeAsync(fullPath);
      await image.clone().scaleToFit(800, 800).writeAsync(standardPath);
      await image.clone().cover(300, 300).writeAsync(thumbPath);
    } catch {
      fs.copyFileSync(file.path, fullPath);
      fs.copyFileSync(file.path, standardPath);
      fs.copyFileSync(file.path, thumbPath);
    }
    fs.unlinkSync(file.path);
  } else {
    fs.copyFileSync(file.path, fullPath);
    fs.copyFileSync(file.path, standardPath);
    fs.copyFileSync(file.path, thumbPath);
    fs.unlinkSync(file.path);
  }
  return {
    imageFull: `/uploads/${path.basename(fullPath)}`,
    imageStandard: `/uploads/${path.basename(standardPath)}`,
    imageThumb: `/uploads/${path.basename(thumbPath)}`
  };
}

// Gallery dashboard for gallery role
router.get('/gallery', requireRole('gallery'), (req, res) => {
  res.render('dashboard/gallery', { user: req.session.user });
});

// Apply fake authentication for admin routes when enabled
if (process.env.USE_DEMO_AUTH === 'true') {
  router.use(simulateAuth);
}

// Admin dashboard
router.get('/', requireRole('admin'), (req, res) => {
  res.render('admin/dashboard', { user: req.session.user });
});

router.get('/galleries', requireRole('admin'), (req, res) => {
  try {
    db.all('SELECT slug, name, bio FROM galleries', (err, galleries) => {
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

router.get('/artists', requireRole('admin'), (req, res) => {
  try {
    db.all('SELECT * FROM artists', (err, artists) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/artists', { artists: [], galleries: [], generatedId: '' });
      }
      db.all('SELECT slug FROM galleries', (gErr, galleries) => {
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

router.get('/artworks', requireRole('admin'), (req, res) => {
  try {
    db.all('SELECT * FROM artworks', (err, artworks) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('dashboard/artworks', { artworks: [], collections: [], generatedId: '' });
      }
      db.all('SELECT id, name FROM collections', (cErr, collections) => {
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

router.post('/galleries', requireRole('admin'), (req, res) => {
  try {
    const { slug, name, bio } = req.body;
    if (!slug || !name || !bio) {
      req.flash('error', 'All fields are required');
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

router.put('/galleries/:slug', requireRole('admin'), (req, res) => {
  try {
    const { slug, name, bio } = req.body;
    const stmt = 'UPDATE galleries SET slug = ?, name = ?, bio = ? WHERE slug = ?';
    db.run(stmt, [slug, name, bio, req.params.slug], err => {
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

router.delete('/galleries/:slug', requireRole('admin'), (req, res) => {
  try {
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

router.post('/artists', requireRole('admin'), (req, res) => {
  try {
    const { id, gallery_slug, name, bio, fullBio, bioImageUrl } = req.body;
    if (!id || !gallery_slug || !name || !bio) {
      req.flash('error', 'All fields are required');
      return res.redirect('/dashboard/artists');
    }
    const stmt = 'INSERT INTO artists (id, gallery_slug, name, bio, fullBio, bioImageUrl) VALUES (?,?,?,?,?,?)';
    db.run(stmt, [id, gallery_slug, name, bio, fullBio || '', bioImageUrl || ''], err => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.redirect('/dashboard/artists');
      }
      req.flash('success', 'Artist added');
      res.redirect('/dashboard/artists');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.redirect('/dashboard/artists');
  }
});

router.put('/artists/:id', requireRole('admin'), (req, res) => {
  try {
    const { name, bio, fullBio, bioImageUrl, gallery_slug } = req.body;
    let stmt = 'UPDATE artists SET name = ?, bio = ?, fullBio = ?, bioImageUrl = ?';
    const params = [name, bio, fullBio || '', bioImageUrl || ''];
    if (gallery_slug) {
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

router.delete('/artists/:id', requireRole('admin'), (req, res) => {
  try {
    db.run('DELETE FROM artists WHERE id = ?', [req.params.id], err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Artist deleted');
      res.sendStatus(204);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.post('/artworks', requireRole('admin'), (req, res) => {
  upload.single('imageFile')(req, res, async err => {
    if (err) {
      console.error(err);
      req.flash('error', err.message);
      return res.redirect('/dashboard/artworks');
    }
    try {
      const { id, gallery_slug, artist_id, title, medium, custom_medium, dimensions, price, imageUrl, status, isVisible, isFeatured } = req.body;
      if (!id || !gallery_slug || !artist_id || !title || !medium || !dimensions) {
        req.flash('error', 'All fields are required');
        return res.redirect('/dashboard/artworks');
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
      const params = [id, gallery_slug, artist_id, title, medium, custom_medium || '', dimensions, price || '', images.imageFull, images.imageStandard, images.imageThumb, status || '', isVisible ? 1 : 0, isFeatured ? 1 : 0];
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

router.put('/artworks/:id', requireRole('admin'), (req, res) => {
  upload.single('imageFile')(req, res, async err => {
    if (err) {
      console.error(err);
      return res.status(400).send(err.message);
    }
    try {
      const { title, medium, custom_medium, dimensions, price, imageUrl, status, isVisible, isFeatured } = req.body;
      const finalMedium = medium === 'other' ? custom_medium : medium;
      let finalPrice = null;
      if (status !== 'collected') {
        const parsed = parseFloat(price);
        if (isNaN(parsed)) {
          return res.status(400).send('Price must be a valid number');
        }
        finalPrice = parsed.toFixed(2);
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

router.delete('/artworks/:id', requireRole('admin'), (req, res) => {
  try {
    db.run('DELETE FROM artworks WHERE id=?', [req.params.id], err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Artwork deleted');
      res.sendStatus(204);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/upload', requireLogin, (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) files = [];
    db.all('SELECT slug FROM galleries', (gErr, galleries) => {
      const data = files.map(f => ({ name: f, url: '/uploads/' + f }));
      const generatedId = 'art_' + Date.now();
      res.render('admin/upload', { files: data, galleries: gErr ? [] : galleries, success: req.query.success, generatedId });
    });
  });
});

router.post('/upload', requireLogin, (req, res) => {
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

router.get('/settings', requireLogin, (req, res) => {
  db.get('SELECT * FROM gallery_settings WHERE id = 1', (err, settings) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Database error');
      return res.render('admin/settings', { settings: {} });
    }
    res.render('admin/settings', { settings: settings || {} });
  });
});

router.post('/settings', requireLogin, (req, res) => {
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
    db.get('SELECT 1 FROM galleries WHERE slug = ?', [slug], (checkErr, row) => {
      if (checkErr) {
        console.error(checkErr);
        req.flash('error', 'Database error');
        return res.redirect('/dashboard/settings');
      }
      if (row) {
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
        } else {
          req.flash('success', 'Settings saved');
        }
        res.redirect('/dashboard/settings');
      });
    });
  });
});

module.exports = router;
