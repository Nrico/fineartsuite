const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index');
});

router.get('/gallery', (req, res) => {
  res.render('gallery/home');
});

router.get('/gallery/artist', (req, res) => {
  res.render('gallery/artist');
});

router.get('/gallery/artwork', (req, res) => {
  res.render('gallery/artwork');
});

module.exports = router;
