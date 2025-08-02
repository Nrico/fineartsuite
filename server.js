const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
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
const { initialize, db } = require('./models/db');
const { getGallery } = require('./models/galleryModel');
const { getArtist } = require('./models/artistModel');
const { getArtwork } = require('./models/artworkModel');

// Read credentials and session secret from environment variables with
// development-friendly defaults
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const SESSION_SECRET = process.env.SESSION_SECRET || 'gallerysecret';
// When true, admin pages are automatically authenticated
const USE_DEMO_AUTH = process.env.USE_DEMO_AUTH === 'true';

const app = express();

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({
  dest: uploadsDir,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: true }));

// Flash messages using connect-flash or fallback implementation
app.use(flash());
app.use((req, res, next) => {
  res.locals.flash = req.flash();
  next();
});

// Initialize the SQLite database and seed demo data if needed
initialize();

function simulateAuth(req, res, next) {
  if (!req.session.user) {
    req.session.user = 'demoAdmin';
  }
  next();
}

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// Public routes
app.get('/', (req, res) => {
  res.render('home');
});

// Auth routes
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      req.flash('error', 'All fields are required');
      return res.redirect('/login');
    }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.user = username;
      return res.redirect('/dashboard');
    }
    req.flash('error', 'Invalid credentials');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Login failed');
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
  res.redirect('/login');
});
});

// Apply fake authentication for all admin routes when enabled
if (USE_DEMO_AUTH) {
  app.use('/dashboard', simulateAuth);
}

// Admin routes
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('admin/dashboard');
});

app.get('/dashboard/artists', requireLogin, (req, res) => {
  try {
    db.all('SELECT * FROM artists', (err, artists) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/artists', { artists: [] });
      }
      res.render('admin/artists', { artists });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('admin/artists', { artists: [] });
  }
});

app.get('/dashboard/artworks', requireLogin, (req, res) => {
  try {
    db.all('SELECT * FROM artworks', (err, artworks) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/artworks', { artworks: [] });
      }
      res.render('admin/artworks', { artworks });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('admin/artworks', { artworks: [] });
  }
});

app.post('/dashboard/artists', requireLogin, (req, res) => {
  try {
    const { id, gallery_slug, name, bio } = req.body;
    if (!id || !gallery_slug || !name || !bio) {
      req.flash('error', 'All fields are required');
      return res.redirect('/dashboard/artists');
    }
    const stmt = 'INSERT INTO artists (id, gallery_slug, name, bio) VALUES (?,?,?,?)';
    db.run(stmt, [id, gallery_slug, name, bio], err => {
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
    const { name, bio } = req.body;
    const stmt = 'UPDATE artists SET name = ?, bio = ? WHERE id = ?';
    db.run(stmt, [name, bio, req.params.id], err => {
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
  try {
    const { id, artist_id, title, medium, dimensions, price, image } = req.body;
    if (!id || !artist_id || !title || !medium || !dimensions || !price || !image) {
      req.flash('error', 'All fields are required');
      return res.redirect('/dashboard/artworks');
    }
    const stmt = `INSERT INTO artworks (id, artist_id, title, medium, dimensions, price, image) VALUES (?,?,?,?,?,?,?)`;
    db.run(stmt, [id, artist_id, title, medium, dimensions, price, image], err => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.redirect('/dashboard/artworks');
      }
      req.flash('success', 'Artwork added');
      res.redirect('/dashboard/artworks');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.redirect('/dashboard/artworks');
  }
});

app.put('/dashboard/artworks/:id', requireLogin, (req, res) => {
  try {
    const { title, medium, dimensions, price, image } = req.body;
    const stmt = `UPDATE artworks SET title=?, medium=?, dimensions=?, price=?, image=? WHERE id=?`;
    db.run(stmt, [title, medium, dimensions, price, image, req.params.id], err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Artwork saved');
      res.sendStatus(204);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
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
    const data = files.map(f => ({ name: f, url: '/uploads/' + f }));
    res.render('admin/upload', { files: data, success: req.query.success });
  });
});

app.post('/dashboard/upload', requireLogin, (req, res) => {
  upload.single('image')(req, res, err => {
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
    res.redirect('/dashboard/upload?success=1');
  });
});

app.get('/dashboard/settings', requireLogin, (req, res) => {
  res.render('admin/settings');
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

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
