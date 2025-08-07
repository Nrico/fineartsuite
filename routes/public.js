const express = require('express');
const router = express.Router();
const { db } = require('../models/db');
const util = require('util');
const send404 = require('../middleware/notFound');
const { getGallery } = require('../models/galleryModel');

// Default options to ensure archived artists and artworks are excluded
const galleryOptions = {
  includeArchivedArtists: false,
  includeArchivedArtworks: false
};
const { getArtist } = require('../models/artistModel');
const { getArtwork } = require('../models/artworkModel');

const getGalleryAsync = util.promisify(getGallery);
const getArtworkAsync = util.promisify(getArtwork);
const dbAll = util.promisify(db.all.bind(db));

// Home route displaying available galleries
router.get('/', (req, res) => {
  db.all('SELECT slug, name FROM galleries', (err, rows) => {
    if (err) {
      console.error('Error loading galleries:', err);
    }
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
    const gallery = await getGalleryAsync(req.params.gallerySlug, galleryOptions);
    const heroData = {
      image: gallery.heroImageUrl,
      featuredWork: (gallery.featuredArtworks || [])[0],
      announcement: gallery.announcement
    };
    res.render('gallery-home', { gallery, slug: req.params.gallerySlug, heroData });
  } catch (err) {
    send404(res, 'Gallery not found', err);
  }
});

// Artist profile page within a gallery
router.get('/:gallerySlug/artists/:artistId', async (req, res) => {
  let gallery;
  try {
    gallery = await getGalleryAsync(req.params.gallerySlug, galleryOptions);
  } catch (err) {
    return send404(res, 'Gallery not found', err);
  }

  try {
    const artist = await getArtist(req.params.gallerySlug, req.params.artistId);
    const heroData = {
      image: artist.bioImageUrl,
      featuredWork: (artist.artworks || []).find(a => a.isFeatured),
      announcement: artist.announcement
    };
    res.render('artist-profile', { gallery, artist, slug: req.params.gallerySlug, heroData });
  } catch (err) {
    send404(res, 'Artist not found', err);
  }
});

// Artwork detail page within a gallery
router.get('/:gallerySlug/artworks/:artworkId', async (req, res) => {
  let gallery;
  try {
    gallery = await getGalleryAsync(req.params.gallerySlug, galleryOptions);
  } catch (err) {
    return send404(res, 'Gallery not found', err);
  }

  let result;
  try {
    result = await getArtworkAsync(req.params.gallerySlug, req.params.artworkId);
  } catch (err) {
    return send404(res, 'Artwork not found', err);
  }

  let artist;
  try {
    artist = await getArtist(req.params.gallerySlug, result.artistId);
  } catch (err) {
    return send404(res, 'Artist not found', err);
  }

  const moreFromArtist = (artist.artworks || []).filter(a => a.id !== result.artwork.id).slice(0, 5);

  const relatedSql = `SELECT artworks.*, artists.name as artistName
                               FROM artworks JOIN artists ON artworks.artist_id = artists.id
                               WHERE artworks.gallery_slug = ? AND artworks.artist_id != ? AND artworks.id != ?
                               LIMIT 8`;

  let relatedRows = [];
  try {
    relatedRows = await dbAll(relatedSql, [req.params.gallerySlug, result.artistId, result.artwork.id]);
  } catch (err) {
    console.error(err);
  }

  const relatedArtworks = relatedRows || [];

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

module.exports = router;
