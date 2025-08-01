const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'gallerysecret', resave: false, saveUninitialized: true }));

// Placeholder data
const galleries = {
  'demo-gallery': {
    name: 'Demo Gallery',
    bio: 'Welcome to the demo gallery showcasing placeholder artwork.',
    featuredArtwork: {
      id: 'art1',
      title: 'Dreamscape',
      image: 'https://via.placeholder.com/600x400?text=Dreamscape'
    },
    artists: [
      {
        id: 'artist1',
        name: 'Jane Doe',
        bio: 'An abstract artist exploring color and form.',
        artworks: [
          {
            id: 'art1',
            title: 'Dreamscape',
            medium: 'Oil on Canvas',
            dimensions: '30x40',
            price: '$4000',
            image: 'https://via.placeholder.com/600x400?text=Dreamscape'
          },
          {
            id: 'art2',
            title: 'Ocean Depths',
            medium: 'Acrylic',
            dimensions: '24x36',
            price: '$2500',
            image: 'https://via.placeholder.com/600x400?text=Ocean+Depths'
          }
        ]
      }
    ]
  }
};

function findGallery(slug) {
  return galleries[slug];
}

function findArtist(gallery, id) {
  return gallery.artists.find(a => a.id === id);
}

function findArtwork(gallery, id) {
  for (const artist of gallery.artists) {
    const art = artist.artworks.find(a => a.id === id);
    if (art) return { artwork: art, artistId: artist.id };
  }
  return null;
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
  const gallery = findGallery(req.params.gallerySlug);
  if (!gallery) return res.status(404).send('Gallery not found');
  res.render('gallery-home', { gallery, slug: req.params.gallerySlug });
});

app.get('/:gallerySlug/artists/:artistId', (req, res) => {
  const gallery = findGallery(req.params.gallerySlug);
  if (!gallery) return res.status(404).send('Gallery not found');
  const artist = findArtist(gallery, req.params.artistId);
  if (!artist) return res.status(404).send('Artist not found');
  res.render('artist-profile', { gallery, artist, slug: req.params.gallerySlug });
});

app.get('/:gallerySlug/artworks/:artworkId', (req, res) => {
  const gallery = findGallery(req.params.gallerySlug);
  if (!gallery) return res.status(404).send('Gallery not found');
  const result = findArtwork(gallery, req.params.artworkId);
  if (!result) return res.status(404).send('Artwork not found');
  res.render('artwork-detail', { gallery, artwork: result.artwork, artistId: result.artistId, slug: req.params.gallerySlug });
});

// Auth routes
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
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

app.get('/dashboard/settings', requireLogin, (req, res) => {
  res.render('admin/settings');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
