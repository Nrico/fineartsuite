const express = require('express');
const router = express.Router();

const { authorize } = require('../../../middleware/auth');

router.get('/gallery', authorize('gallery'), (req, res) => {
  res.render('dashboard/gallery', { user: req.session.user });
});

router.get('/', authorize('admin'), (req, res) => {
  res.render('admin/dashboard', { user: req.session.user });
});

router.use(require('./galleries'));
router.use(require('./artists'));
router.use(require('./artworks'));
router.use(require('./settings'));

router.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF token mismatch on admin route', err);
    return res.status(403).send('Invalid CSRF token');
  }
  if (err.code === 'LIMIT_FILE_SIZE' || err.message === 'Only JPG, PNG, or HEIC images are allowed') {
    console.error(err);
    req.flash('error', err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message);
    const redirectPath = req.originalUrl.includes('/upload') ? '/dashboard/upload' : '/dashboard/artworks';
    return res.status(400).redirect(redirectPath);
  }
  next(err);
});

module.exports = router;
