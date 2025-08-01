const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { initialize } = require('./models/db');
const { getGallery } = require('./models/galleryModel');
const { getArtist } = require('./models/artistModel');
const { getArtwork } = require('./models/artworkModel');

// Read credentials and session secret from environment variables with
// development-friendly defaults
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const SESSION_SECRET = process.env.SESSION_SECRET || 'gallerysecret';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: true }));

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

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.user = username;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: 'Invalid credentials' });
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

app.get('/dashboard/settings', requireLogin, (req, res) => {
  res.render('admin/settings');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
