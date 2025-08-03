const express = require('express');
const session = require('express-session');
let SQLiteStore;
try {
  SQLiteStore = require('connect-sqlite3')(session);
} catch (err) {
  console.warn('connect-sqlite3 not installed, falling back to default session store');
}
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
let Jimp;
try {
  Jimp = require('jimp');
} catch (err) {
  console.warn('jimp not installed, images will be copied without resizing');
}
let flash;
try {
  flash = require('connect-flash');
} catch (err) {
  // Fallback implementation when connect-flash is not installed
  flash = () => (req, res, next) => {
    res.locals.flash = req.session?.flash || {};
    req.flash = function(type, msg) {
      if (!req.session) throw new Error('flash requires sessions');
      if (!req.session.flash) req.session.flash = {};
      if (!req.session.flash[type]) req.session.flash[type] = [];
      if (msg) req.session.flash[type].push(msg);
      return req.session.flash[type];
    };
    delete req.session?.flash;
    next();
  };
}
const csrf = require('./middleware/csrf');
const { initialize, db } = require('./models/db');
const { getGallery } = require('./models/galleryModel');
const { getArtist } = require('./models/artistModel');
const { getArtwork, getArtworksByArtist, updateArtworkCollection } = require('./models/artworkModel');
const { createUser, findUserByUsername } = require('./models/userModel');
const { createCollection, getCollectionsByArtist, updateCollection } = require('./models/collectionModel');

// Read credentials and session secret from environment variables with
// development-friendly defaults
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const SESSION_SECRET = process.env.SESSION_SECRET || 'gallerysecret';
// When true, admin pages are automatically authenticated
const USE_DEMO_AUTH = process.env.USE_DEMO_AUTH === 'true';
const VALID_PROMO_CODES = ['taos'];

const app = express();
// Ensure secure cookies work correctly behind reverse proxies
// so that sessions (and thus CSRF tokens) persist when deployed
// on platforms like Render or Heroku.
app.set('trust proxy', 1);

const uploadsDir = path.join(__dirname, 'public', 'uploads');
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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const sessionOptions = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
};
if (SQLiteStore) {
  sessionOptions.store = new SQLiteStore();
}
app.use(session(sessionOptions));
const csrfProtection = csrf();
app.use(csrfProtection);

// Flash messages using connect-flash or fallback implementation
app.use(flash());
app.use((req, res, next) => {
  req.user = req.session.user;
  res.locals.user = req.user;
  res.locals.flash = req.flash();
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Initialize the SQLite database and seed demo data if needed
initialize();

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
    if (req.user && req.user.role === role) return next();
    res.redirect('/login');
  };
}

function blockArtist(req, res, next) {
  if (req.user && req.user.role === 'artist') return res.redirect('/dashboard/artist');
  next();
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function signupHandler(role) {
  return (req, res) => {
    const { display_name, username, password, passcode } = req.body;
    if (!display_name || !username || !password || !passcode) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/signup/${role}`);
    }
    if (!VALID_PROMO_CODES.includes(passcode)) {
      req.flash('error', 'Invalid passcode');
      return res.redirect(`/signup/${role}`);
    }
    createUser(display_name, username, password, role, passcode, (err, id) => {
      if (err) {
        req.flash('error', 'Signup failed');
        return res.redirect(`/signup/${role}`);
      }
      req.session.user = { id, username, role };
      return res.redirect(`/dashboard/${role}`);
    });
  };
}

// Public routes
app.get('/', (req, res) => {
  db.all('SELECT slug FROM galleries', (err, rows) => {
    const galleries = err ? [] : rows;
    res.render('home', { galleries });
  });
});

// Auth routes
app.get('/signup/artist', (req, res) => {
  res.render('signup/artist');
});

app.get('/signup/gallery', (req, res) => {
  res.render('signup/gallery');
});

app.post('/signup/artist', signupHandler('artist'));
app.post('/signup/gallery', signupHandler('gallery'));

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.flash('error', 'All fields are required');
    return res.redirect('/login');
  }
  findUserByUsername(username, (err, user) => {
    if (user && user.password === password) {
      req.session.user = { id: user.id, username: user.username, role: user.role };
      return res.redirect(`/dashboard/${user.role}`);
    }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.user = { username, role: 'admin' };
      return res.redirect('/dashboard');
    }
    req.flash('error', 'Invalid credentials');
    res.redirect('/login');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
  res.redirect('/login');
});
});

app.get('/dashboard/artist', requireRole('artist'), (req, res) => {
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

app.post('/dashboard/artist/collections', requireRole('artist'), (req, res) => {
  const { name } = req.body;
  const slug = slugify(name);
  createCollection(name, req.session.user.id, slug, err => {
    if (err) req.flash('error', 'Could not create collection');
    res.redirect('/dashboard/artist');
  });
});

app.post('/dashboard/artist/collections/:id', requireRole('artist'), (req, res) => {
  const { name } = req.body;
  updateCollection(req.params.id, name, err => {
    if (err) req.flash('error', 'Could not update collection');
    res.redirect('/dashboard/artist');
  });
});

app.post('/dashboard/artist/artworks/:id/collection', requireRole('artist'), (req, res) => {
  const { collection_id } = req.body;
  updateArtworkCollection(req.params.id, collection_id || null, err => {
    if (err) req.flash('error', 'Could not update artwork');
    res.redirect('/dashboard/artist');
  });
});

app.get('/dashboard/gallery', requireRole('gallery'), (req, res) => {
  res.render('dashboard/gallery', { user: req.session.user });
});

// Apply fake authentication for all admin routes when enabled
if (USE_DEMO_AUTH) {
  app.use('/dashboard', simulateAuth);
}

// Admin routes
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('admin/dashboard', { user: req.session.user });
});

app.get('/dashboard/galleries', requireLogin, blockArtist, (req, res) => {
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

app.get('/dashboard/artists', requireLogin, blockArtist, (req, res) => {
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

app.get('/dashboard/artworks', requireLogin, (req, res) => {
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

app.post('/dashboard/galleries', requireLogin, (req, res) => {
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

app.put('/dashboard/galleries/:slug', requireLogin, (req, res) => {
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

app.delete('/dashboard/galleries/:slug', requireLogin, (req, res) => {
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

app.post('/dashboard/artists', requireLogin, (req, res) => {
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

app.put('/dashboard/artists/:id', requireLogin, (req, res) => {
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

app.delete('/dashboard/artists/:id', requireLogin, (req, res) => {
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

app.post('/dashboard/artworks', requireLogin, (req, res) => {
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
        req.flash('error', 'Artist does not belong to gallery');
        return res.redirect('/dashboard/artworks');
      }
      const finalMedium = medium === 'other' ? custom_medium : medium;
      let finalPrice = null;
      if (status !== 'collected') {
        const parsed = parseFloat(price);
        if (isNaN(parsed)) {
          req.flash('error', 'Price must be a valid number');
          return res.redirect('/dashboard/artworks');
        }
        finalPrice = parsed.toFixed(2);
      }
      const images = req.file ? await processImages(req.file) : { imageFull: imageUrl, imageStandard: imageUrl, imageThumb: imageUrl };
      const stmt = `INSERT INTO artworks (id, artist_id, title, medium, dimensions, price, imageFull, imageStandard, imageThumb, status, isVisible, isFeatured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
      db.run(stmt, [id, artist_id, title, finalMedium, dimensions, finalPrice, images.imageFull, images.imageStandard, images.imageThumb, status || '', isVisible ? 1 : 0, isFeatured ? 1 : 0], runErr => {
        if (runErr) {
          console.error(runErr);
          req.flash('error', 'Database error');
          return res.redirect('/dashboard/artworks');
        }
        req.flash('success', 'Artwork added');
        res.redirect('/dashboard/artworks');
      });
    } catch (e) {
      console.error(e);
      req.flash('error', 'Server error');
      res.redirect('/dashboard/artworks');
    }
  });
});

app.put('/dashboard/artworks/:id', requireLogin, (req, res) => {
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
        const images = req.file ? await processImages(req.file) : { imageFull: imageUrl, imageStandard: imageUrl, imageThumb: imageUrl };
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

app.delete('/dashboard/artworks/:id', requireLogin, (req, res) => {
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

app.get('/dashboard/upload', requireLogin, (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) files = [];
    db.all('SELECT slug FROM galleries', (gErr, galleries) => {
      const data = files.map(f => ({ name: f, url: '/uploads/' + f }));
      const generatedId = 'art_' + Date.now();
      res.render('admin/upload', { files: data, galleries: gErr ? [] : galleries, success: req.query.success, generatedId });
    });
  });
});

app.post('/dashboard/upload', requireLogin, (req, res) => {
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

app.get('/dashboard/settings', requireLogin, (req, res) => {
  db.get('SELECT * FROM gallery_settings WHERE id = 1', (err, settings) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Database error');
      return res.render('admin/settings', { settings: {} });
    }
    res.render('admin/settings', { settings: settings || {} });
  });
});

app.post('/dashboard/settings', requireLogin, (req, res) => {
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

// Public gallery routes
app.get('/:gallerySlug', (req, res) => {
  try {
    getGallery(req.params.gallerySlug, (err, gallery) => {
      if (err) return res.status(404).send('Gallery not found');
      res.render('gallery-home', { gallery, slug: req.params.gallerySlug });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.get('/:gallerySlug/artists/:artistId', (req, res) => {
  try {
    getGallery(req.params.gallerySlug, (err, gallery) => {
      if (err) return res.status(404).send('Gallery not found');
      getArtist(req.params.gallerySlug, req.params.artistId, (err2, artist) => {
        if (err2) return res.status(404).send('Artist not found');
        res.render('artist-profile', { gallery, artist, slug: req.params.gallerySlug });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.get('/:gallerySlug/artworks/:artworkId', (req, res) => {
  try {
    getGallery(req.params.gallerySlug, (err, gallery) => {
      if (err) return res.status(404).send('Gallery not found');
      getArtwork(req.params.gallerySlug, req.params.artworkId, (err2, result) => {
        if (err2) return res.status(404).send('Artwork not found');
        res.render('artwork-detail', { gallery, artwork: result.artwork, artistId: result.artistId, slug: req.params.gallerySlug });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Render custom 404 page for any unmatched routes
app.use((req, res) => {
  res.status(404).render('404');
});

// Handle CSRF token errors
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send('Invalid CSRF token');
  }
  console.error(err);
  res.status(500).send('Server error');
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
