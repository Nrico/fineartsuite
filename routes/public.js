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
router.get('/:gallerySlug', (req, res) => {
  getGallery(req.params.gallerySlug, galleryOptions, (err, gallery) => {
    if (err) {
      console.error(err);
      return res.status(404).send('Gallery not found');
    }
    res.render('gallery-home', { gallery, slug: req.params.gallerySlug });
  });
});

// Artist profile page within a gallery
router.get('/:gallerySlug/artists/:artistId', (req, res) => {
  getGallery(req.params.gallerySlug, galleryOptions, (err, gallery) => {
    if (err) {
      console.error(err);
      return res.status(404).send('Gallery not found');
    }
    getArtist(req.params.gallerySlug, req.params.artistId, (err2, artist) => {
      if (err2) {
        console.error(err2);
        return res.status(404).send('Artist not found');
      }
      res.render('artist-profile', { gallery, artist, slug: req.params.gallerySlug });
    });
  });
});

// Artwork detail page within a gallery
router.get('/:gallerySlug/artworks/:artworkId', (req, res) => {
  getGallery(req.params.gallerySlug, galleryOptions, (err, gallery) => {
    if (err) {
      console.error(err);
      return res.status(404).send('Gallery not found');
    }
    getArtwork(req.params.gallerySlug, req.params.artworkId, (err2, result) => {
      if (err2) {
        console.error(err2);
        return res.status(404).send('Artwork not found');
      }

      // Fetch full artist profile including other artworks
      getArtist(req.params.gallerySlug, result.artistId, (err3, artist) => {
        if (err3) {
          console.error(err3);
          return res.status(404).send('Artist not found');
        }

        const moreFromArtist = (artist.artworks || []).filter(a => a.id !== result.artwork.id).slice(0, 5);

        const relatedSql = `SELECT artworks.*, artists.name as artistName
                               FROM artworks JOIN artists ON artworks.artist_id = artists.id
                               WHERE artworks.gallery_slug = ? AND artworks.artist_id != ? AND artworks.id != ?
                               LIMIT 8`;
        db.all(relatedSql, [req.params.gallerySlug, result.artistId, result.artwork.id], (err4, relatedRows) => {
          const relatedArtworks = err4 ? [] : relatedRows;

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
        });
      });
    });
  });
});

module.exports = router;
