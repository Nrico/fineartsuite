const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const { getGallery } = require('../models/galleryModel');
const { getArtist } = require('../models/artistModel');
const { getArtwork } = require('../models/artworkModel');

// Home route displaying available galleries
router.get('/', (req, res) => {
  db.all('SELECT slug FROM galleries', (err, rows) => {
    const galleries = err ? [] : rows;
    res.render('home', { galleries });
  });
});

// Public gallery home page
router.get('/:gallerySlug', (req, res) => {
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

// Artist profile page within a gallery
router.get('/:gallerySlug/artists/:artistId', (req, res) => {
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

// Artwork detail page within a gallery
router.get('/:gallerySlug/artworks/:artworkId', (req, res) => {
  try {
    getGallery(req.params.gallerySlug, (err, gallery) => {
      if (err) return res.status(404).send('Gallery not found');
      getArtwork(req.params.gallerySlug, req.params.artworkId, (err2, result) => {
        if (err2) return res.status(404).send('Artwork not found');
        res.render('artwork-detail', {
          gallery,
          artwork: result.artwork,
          artistId: result.artistId,
          slug: req.params.gallerySlug
        });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
