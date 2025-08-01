const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');
const { initialize } = require('./models/db');
const { getGallery } = require('./models/galleryModel');
const { getArtist } = require('./models/artistModel');
const { getArtwork } = require('./models/artworkModel');

// Read credentials and session secret from environment variables with
// development-friendly defaults
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const PASSWORD_SALT = process.env.ADMIN_PASSWORD_SALT || 'staticSalt';
const ADMIN_PASSWORD_HASH = crypto.scryptSync(ADMIN_PASSWORD, PASSWORD_SALT, 64).toString('hex');
const SESSION_SECRET = process.env.SESSION_SECRET || 'gallerysecret';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: true }));

// Simple CSRF protection using a session token
function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  if (req.method === 'POST') {
    const token = req.body._csrf;
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).send('Invalid CSRF token');
    }
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

app.use(csrfProtection);

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

function validateLoginInputs(req, res, next) {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password.trim()) {
    return res.status(400).render('login', { error: 'Invalid input' });
  }
  next();
}

function validateUploadInputs(req, res, next) {
  const { title, medium, dimensions, price } = req.body;
  if (!title || !medium || !dimensions || !price || isNaN(parseFloat(price))) {
    return res.status(400).send('Invalid input');
  }
  next();
}

// Public routes
app.get('/', (req, res) => {
  res.render('home');
});

app.get('/:gallerySlug', (req, res) => {
  getGallery(req.params.gallerySlug, (err, gallery) => {
    if (err) return res.status(404).send('Gallery not found');
    res.render('gallery-home', { gallery, slug: req.params.gallerySlug });
  });
});

app.get('/:gallerySlug/artists/:artistId', (req, res) => {
  getGallery(req.params.gallerySlug, (err, gallery) => {
    if (err) return res.status(404).send('Gallery not found');
    getArtist(req.params.gallerySlug, req.params.artistId, (err2, artist) => {
      if (err2) return res.status(404).send('Artist not found');
      res.render('artist-profile', { gallery, artist, slug: req.params.gallerySlug });
    });
  });
});

app.get('/:gallerySlug/artworks/:artworkId', (req, res) => {
  getGallery(req.params.gallerySlug, (err, gallery) => {
    if (err) return res.status(404).send('Gallery not found');
    getArtwork(req.params.gallerySlug, req.params.artworkId, (err2, result) => {
      if (err2) return res.status(404).send('Artwork not found');
      res.render('artwork-detail', { gallery, artwork: result.artwork, artistId: result.artistId, slug: req.params.gallerySlug });
    });
  });
});

// Auth routes
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', validateLoginInputs, (req, res) => {
  const { username, password } = req.body;
  const attemptedHash = crypto.scryptSync(password, PASSWORD_SALT, 64).toString('hex');
  if (username === ADMIN_USERNAME && attemptedHash === ADMIN_PASSWORD_HASH) {
    req.session.user = username;
    return res.redirect('/dashboard');
  }
  res.status(401).render('login', { error: 'Invalid credentials' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Apply fake authentication for all admin routes
app.use('/dashboard', simulateAuth);

// Admin routes
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('admin/dashboard');
});

app.get('/dashboard/artists', requireLogin, (req, res) => {
  res.render('admin/artists');
});

app.get('/dashboard/artworks', requireLogin, (req, res) => {
  res.render('admin/artworks');
});

app.get('/dashboard/upload', requireLogin, (req, res) => {
  res.render('admin/upload');
});

app.post('/dashboard/upload', requireLogin, validateUploadInputs, (req, res) => {
  res.send('Upload received');
});

app.get('/dashboard/settings', requireLogin, (req, res) => {
  res.render('admin/settings');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
