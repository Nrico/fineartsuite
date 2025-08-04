const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db } = require('../../../models/db');
const { requireRole } = require('../../../middleware/auth');
const { generateUniqueSlug } = require('../../../utils/slug');
const { processImages, uploadsDir } = require('../../../utils/image');
const csrf = require('csurf');
const csrfProtection = csrf();

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

router.get('/galleries', requireRole('admin', 'gallery'), csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  try {
    const baseQuery = 'SELECT slug, name, bio AS description, contact_email AS email, phone, address, gallarist_name AS owner, logo_url FROM galleries';
    const query = req.user.role === 'gallery'
      ? baseQuery + ' WHERE slug = ?'
      : baseQuery;
    const params = req.user.role === 'gallery' ? [req.user.username] : [];
    db.all(query, params, (err, galleries) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.render('admin/galleries', { galleries: [] });
      }
      res.render('admin/galleries', { galleries });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    res.render('admin/galleries', { galleries: [] });
  }
});

router.post('/galleries', requireRole('admin', 'gallery'), upload.single('logoFile'), csrfProtection, async (req, res) => {
  try {
    let { name, description, email, phone, address, owner, logoUrl } = req.body;
    if (!name || !description) {
      return handleGalleryResponse(req, res, 400, 'All fields are required');
    }
    const slug = req.user.role === 'gallery'
      ? req.user.username
      : await generateUniqueSlug(db, 'galleries', 'slug', name);
    let logo_url = logoUrl || null;
    if (req.file) {
      try {
        const images = await processImages(req.file);
        logo_url = images.imageStandard;
      } catch (imageErr) {
        console.error(imageErr);
        return handleGalleryResponse(req, res, 500, 'Image processing failed');
      }
    }
    const stmt = 'INSERT INTO galleries (slug, name, bio, contact_email, phone, address, gallarist_name, logo_url) VALUES (?,?,?,?,?,?,?,?)';
    db.run(stmt, [slug, name, description, email || null, phone || null, address || null, owner || null, logo_url], err2 => {
      if (err2) {
        console.error(err2);
        return handleGalleryResponse(req, res, 500, 'Database error');
      }
      handleGalleryResponse(req, res, 201, { slug });
    });
  } catch (err) {
    console.error(err);
    handleGalleryResponse(req, res, 500, 'Server error');
  }
});

function handleGalleryResponse(req, res, status, data) {
  if (req.is('application/x-www-form-urlencoded')) {
    if (status >= 400) {
      req.flash('error', data);
      return res.redirect('/dashboard/galleries');
    }
    req.flash('success', 'Gallery added');
    return res.redirect('/dashboard/galleries');
  }
  if (status >= 400) return res.status(status).send(data);
  res.status(status).json(data);
}

router.put('/galleries/:slug', requireRole('admin', 'gallery'), upload.single('logoFile'), csrfProtection, async (req, res) => {
  try {
    if (req.user.role === 'gallery' && req.params.slug !== req.user.username) {
      return res.status(403).send('Forbidden');
    }
    const { name, description, email, phone, address, owner, logoUrl } = req.body;
    let logo_url = logoUrl || null;
    if (req.file) {
      try {
        const images = await processImages(req.file);
        logo_url = images.imageStandard;
      } catch (imageErr) {
        console.error(imageErr);
        return res.status(500).send('Image processing failed');
      }
    }
    const stmt = 'UPDATE galleries SET name = ?, bio = ?, contact_email = ?, phone = ?, address = ?, gallarist_name = ?, logo_url = ? WHERE slug = ?';
    db.run(stmt, [name, description, email || null, phone || null, address || null, owner || null, logo_url, req.params.slug], err2 => {
      if (err2) {
        console.error(err2);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Gallery saved');
      res.sendStatus(204);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.delete('/galleries/:slug', requireRole('admin', 'gallery'), (req, res) => {
  try {
    if (req.user.role === 'gallery' && req.params.slug !== req.user.username) {
      return res.status(403).send('Forbidden');
    }
    db.run('DELETE FROM galleries WHERE slug = ?', [req.params.slug], err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Gallery deleted');
      res.sendStatus(204);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
