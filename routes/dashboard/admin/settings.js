const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireRole } = require('../../../middleware/auth');
const { processImages, uploadsDir } = require('../../../utils/image');
const csrf = require('csurf');
const csrfProtection = csrf();

const { db } = require('../../../models/db');

const upload = multer({
  dest: uploadsDir,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or HEIC images are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

router.get('/settings', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  const slug = req.user.role === 'gallery' ? req.user.username : req.query.slug;
  db.get(
    'SELECT name, contact_email AS email, phone, address, bio AS description, gallarist_name AS owner, logo_url FROM galleries WHERE slug = ?',
    [slug],
    (err, settings) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/settings', { settings: {} });
      }
      res.render('admin/settings', { settings: settings || {} });
    }
  );
});

router.post('/settings/logo', requireRole('admin', 'gallery'), upload.single('logoFile'), csrfProtection, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const images = await processImages(req.file);
    res.json({ url: images.imageStandard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Image processing failed' });
  }
});

router.post('/settings', requireRole('admin', 'gallery'), upload.single('logoFile'), csrfProtection, async (req, res) => {
  try {
    const slug = req.user.role === 'gallery' ? req.user.username : req.body.slug;
    let { name, phone, email, address, description, owner, logoUrl, existingLogo } = req.body;
    let logo_url = logoUrl || existingLogo || null;
    if (req.file) {
      try {
        const images = await processImages(req.file);
        logo_url = images.imageStandard;
      } catch (imageErr) {
        console.error(imageErr);
        req.flash('error', 'Image processing failed');
        return res.redirect('/dashboard/settings');
      }
    }
    const stmt = 'UPDATE galleries SET name = ?, phone = ?, contact_email = ?, address = ?, bio = ?, gallarist_name = ?, logo_url = ? WHERE slug = ?';
    db.run(stmt, [name, phone || null, email || null, address || null, description || null, owner || null, logo_url, slug], err => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
      } else {
        req.flash('success', 'Settings saved');
      }
      res.redirect('/dashboard/settings');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.redirect('/dashboard/settings');
  }
});

module.exports = router;
