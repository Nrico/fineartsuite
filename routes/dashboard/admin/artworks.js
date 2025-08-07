const express = require('express');
const router = express.Router();
const fs = require('fs');
const upload = require('../../../middleware/upload');
const { authorize } = require('../../../middleware/auth');
const { generateUniqueSlug } = require('../../../utils/slug');
const { processImages } = require('../../../utils/image');
const csrf = require('csurf');
const csrfProtection = csrf();

const { db } = require('../../../models/db');
const { archiveArtwork, unarchiveArtwork } = require('../../../models/artworkModel');

router.get('/artworks', authorize('admin', 'gallery', 'artist'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  try {
    let artQuery;
    if (req.user.role === 'gallery') {
      artQuery = ['SELECT a.*, ar.name AS artist_name FROM artworks a LEFT JOIN artists ar ON a.artist_id = ar.id WHERE a.gallery_slug = ?', [req.user.username]];
    } else if (req.user.role === 'artist') {
      artQuery = ['SELECT a.*, ar.name AS artist_name FROM artworks a LEFT JOIN artists ar ON a.artist_id = ar.id WHERE a.artist_id = ?', [req.user.id]];
    } else {
      artQuery = ['SELECT a.*, ar.name AS artist_name FROM artworks a LEFT JOIN artists ar ON a.artist_id = ar.id', []];
    }
    db.all(...artQuery, (err, artworks) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('dashboard/artworks', { artworks: [], collections: [], artists: [] });
      }
      let collQuery;
      if (req.user.role === 'gallery') {
        collQuery = ['SELECT c.id, c.name FROM collections c JOIN artists a ON c.artist_id = a.id WHERE a.gallery_slug = ?', [req.user.username]];
      } else if (req.user.role === 'artist') {
        collQuery = ['SELECT id, name FROM collections WHERE artist_id = ?', [req.user.id]];
      } else {
        collQuery = ['SELECT id, name FROM collections', []];
      }
      let artistQuery;
      if (req.user.role === 'gallery') {
        artistQuery = ['SELECT id, name FROM artists WHERE gallery_slug = ? ORDER BY display_order', [req.user.username]];
      } else if (req.user.role === 'artist') {
        artistQuery = ['SELECT id, name FROM artists WHERE id = ?', [req.user.id]];
      } else {
        artistQuery = ['SELECT id, name FROM artists ORDER BY display_order', []];
      }
      db.all(...collQuery, (cErr, collections) => {
        if (cErr) {
          console.error(cErr);
          req.flash('error', 'Database error');
          return res.render('dashboard/artworks', { artworks: [], collections: [], artists: [] });
        }
        db.all(...artistQuery, (aErr, artists) => {
          if (aErr) {
            console.error(aErr);
            req.flash('error', 'Database error');
            return res.render('dashboard/artworks', { artworks: [], collections: [], artists: [] });
          }
          res.render('dashboard/artworks', { artworks, collections, artists });
        });
      });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('dashboard/artworks', { artworks: [], collections: [], artists: [] });
  }
});

router.post('/artworks', authorize('admin', 'gallery', 'artist'), upload.single('imageFile'), csrfProtection, async (req, res) => {
  try {
    let { id, artist_id, title, medium, custom_medium, dimensions, price, description, framed, readyToHang, imageUrl, status, isVisible, isFeatured, collection_id } = req.body;
    if (req.user.role === 'artist') {
      artist_id = req.user.id;
    }
    if ((!artist_id && req.user.role !== 'artist') || !title || !medium || !dimensions) {
      return res.status(400).send('All fields are required');
    }
    const artist = await new Promise((resolve, reject) => {
      db.get('SELECT id, gallery_slug FROM artists WHERE id = ?', [artist_id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    if (!artist) {
      return res.status(400).send('Artist not found');
    }
    if (req.user.role === 'gallery' && artist.gallery_slug !== req.user.username) {
      return res.status(403).send('Forbidden');
    }
    const gallery_slug = artist.gallery_slug;
    const gallery = await new Promise((resolve, reject) => {
      db.get('SELECT slug FROM galleries WHERE slug = ?', [gallery_slug], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    if (!gallery) {
      return res.status(400).send('Gallery not found');
    }
    if (!id) {
      id = await generateUniqueSlug(db, 'artworks', 'id', title);
    }
    let priceValue = '';
    if (price && price.trim() !== '') {
      const sanitized = price.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(sanitized);
      if (!isNaN(parsed)) priceValue = parsed.toFixed(2);
    }
    let imageFull = null;
    let imageStandard = null;
    let imageThumb = null;
    if (req.file) {
      const images = await processImages(req.file);
      imageFull = images.imageFull;
      imageStandard = images.imageStandard;
      imageThumb = images.imageThumb;
    } else if (imageUrl) {
      imageFull = imageUrl;
      imageStandard = imageUrl;
      imageThumb = imageUrl;
    }
    const stmt = 'INSERT OR REPLACE INTO artworks (id, artist_id, gallery_slug, title, medium, custom_medium, dimensions, price, description, framed, ready_to_hang, imageFull, imageStandard, imageThumb, status, isVisible, isFeatured, collection_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
    db.run(stmt, [id, artist_id, gallery_slug, title, medium, custom_medium || null, dimensions, priceValue, description || null, framed ? 1 : 0, readyToHang ? 1 : 0, imageFull, imageStandard, imageThumb, status || 'draft', isVisible ? 1 : 0, isFeatured ? 1 : 0, collection_id || null], err2 => {
      if (err2) {
        console.error(err2);
        return res.status(500).send('Database error');
      }
      res.status(201).json({ id });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.put('/artworks/:id/archive', authorize('admin', 'gallery', 'artist'), (req, res) => {
  archiveArtwork(req.params.id, req.user, err => {
    if (err) return res.status(500).send('Server error');
    res.sendStatus(204);
  });
});

router.put('/artworks/:id/unarchive', authorize('admin', 'gallery', 'artist'), (req, res) => {
  unarchiveArtwork(req.params.id, req.user, err => {
    if (err) return res.status(500).send('Server error');
    res.sendStatus(204);
  });
});

module.exports = router;
