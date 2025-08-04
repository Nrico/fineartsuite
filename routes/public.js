const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const { getGallery } = require('../models/galleryModel');

// Default options to ensure archived artists and artworks are excluded
const galleryOptions = {
  includeArchivedArtists: false,
  includeArchivedArtworks: false
};
const { getArtist } = require('../models/artistModel');
const { getArtwork } = require('../models/artworkModel');

// Home route displaying available galleries
router.get('/', (req, res) => {
  db.all('SELECT slug, name FROM galleries', (err, rows) => {
    const galleries = err ? [] : rows;
    res.render('home', { galleries });
  });
});

// FAQ page
router.get('/faq', (req, res) => {
  res.render('faq');
});

// Public gallery home page
router.get('/:gallerySlug', async (req, res) => {
  try {
    const gallery = await getGallery(req.params.gallerySlug, galleryOptions);
    res.render('gallery-home', { gallery, slug: req.params.gallerySlug });
  } catch (err) {
    console.error(err);
    res.status(404).send('Gallery not found');
  }
});

// Artist profile page within a gallery
router.get('/:gallerySlug/artists/:artistId', async (req, res) => {
  try {
    const gallery = await getGallery(req.params.gallerySlug, galleryOptions);
    const artist = await getArtist(req.params.gallerySlug, req.params.artistId);
    res.render('artist-profile', { gallery, artist, slug: req.params.gallerySlug });
  } catch (err) {
    console.error(err);
    res.status(404).send('Artist not found');
  }
});

// Artwork detail page within a gallery
router.get('/:gallerySlug/artworks/:artworkId', async (req, res) => {
  try {
    const gallery = await getGallery(req.params.gallerySlug, galleryOptions);
    const result = await getArtwork(req.params.gallerySlug, req.params.artworkId);
    const artist = await getArtist(req.params.gallerySlug, result.artistId);
    const moreFromArtist = (artist.artworks || []).filter(a => a.id !== result.artwork.id).slice(0, 5);

    const relatedSql = `SELECT artworks.*, artists.name as artistName
                               FROM artworks JOIN artists ON artworks.artist_id = artists.id
                               WHERE artworks.gallery_slug = ? AND artworks.artist_id != ? AND artworks.id != ?
                               LIMIT 8`;
    const relatedArtworks = await new Promise((resolve, reject) => {
      db.all(relatedSql, [req.params.gallerySlug, result.artistId, result.artwork.id], (err4, rows) => {
        if (err4) return reject(err4);
        resolve(rows);
      });
    });

    res.render('artwork-detail', {
      gallery,
      artwork: result.artwork,
      artist: {
        id: artist.id,
        name: artist.name,
        bio: artist.bio,
        bioImageUrl: artist.bioImageUrl
      },
      artistId: result.artistId,
      slug: req.params.gallerySlug,
      moreFromArtist,
      relatedArtworks
    });
  } catch (err) {
    console.error(err);
    res.status(404).send('Artwork not found');
  }
});

module.exports = router;
