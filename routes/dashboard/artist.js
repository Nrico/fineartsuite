const express = require('express');
const router = express.Router();
const { createCollection, getCollectionsByArtist, updateCollection } = require('../../models/collectionModel');
const { getArtworksByArtist, updateArtworkCollection } = require('../../models/artworkModel');

function requireRole(role) {
  return function(req, res, next) {
    if (req.user && req.user.role === role) return next();
    res.redirect('/login');
  };
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

router.get('/', requireRole('artist'), (req, res) => {
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

router.post('/collections', requireRole('artist'), (req, res) => {
  const { name } = req.body;
  const slug = slugify(name);
  createCollection(name, req.session.user.id, slug, err => {
    if (err) req.flash('error', 'Could not create collection');
    res.redirect('/dashboard/artist');
  });
});

router.post('/collections/:id', requireRole('artist'), (req, res) => {
  const { name } = req.body;
  updateCollection(req.params.id, name, err => {
    if (err) req.flash('error', 'Could not update collection');
    res.redirect('/dashboard/artist');
  });
});

router.post('/artworks/:id/collection', requireRole('artist'), (req, res) => {
  const { collection_id } = req.body;
  updateArtworkCollection(req.params.id, collection_id || null, err => {
    if (err) req.flash('error', 'Could not update artwork');
    res.redirect('/dashboard/artist');
  });
});

module.exports = router;
