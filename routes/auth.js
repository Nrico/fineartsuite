const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf();
const { createUser, findUserByUsername } = require('../models/userModel');
const { createArtist } = require('../models/artistModel');
const { createGallery } = require('../models/galleryModel');
const { db } = require('../models/db');
const bcrypt = require('../utils/bcrypt');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const VALID_PROMO_CODES = ['taos'];
const USERNAME_REGEX = /^[a-z0-9-]+$/;

function signupHandler(role) {
  return async (req, res) => {
    const { display_name, username, password, passcode } = req.body;
    if (!display_name || !username || !password || !passcode) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/signup/${role}`);
    }
    if (!VALID_PROMO_CODES.includes(passcode)) {
      req.flash('error', 'Invalid passcode');
      return res.redirect(`/signup/${role}`);
    }
    if (!USERNAME_REGEX.test(username)) {
      req.flash('error', 'Username may only contain lowercase letters, numbers, and hyphens');
      return res.redirect(`/signup/${role}`);
    }
    try {
      const id = await createUser(display_name, username, password, role, passcode);
      if (role === 'artist') {
        try {
          await createArtist(id, display_name, '');
          req.session.user = { id, username, role };
          return res.redirect(`/dashboard/${role}`);
        } catch (err2) {
          await new Promise(resolve => db.run('DELETE FROM users WHERE id = ?', [id], resolve));
          req.flash('error', 'Signup failed');
          return res.redirect(`/signup/${role}`);
        }
      } else if (role === 'gallery') {
        try {
          await createGallery(username, display_name);
          req.session.user = { id, username, role };
          return res.redirect(`/dashboard/${role}`);
        } catch (err2) {
          await new Promise(resolve => db.run('DELETE FROM users WHERE id = ?', [id], resolve));
          req.flash('error', 'Signup failed');
          return res.redirect(`/signup/${role}`);
        }
      } else {
        req.session.user = { id, username, role };
        return res.redirect(`/dashboard/${role}`);
      }
    } catch (err) {
      req.flash('error', 'Signup failed');
      return res.redirect(`/signup/${role}`);
    }
  };
}

router.get('/signup', csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  res.render('signup/index');
});

router.get('/signup/artist', csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  res.render('signup/artist');
});

router.get('/signup/gallery', csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  res.render('signup/gallery');
});

router.post('/signup/artist', csrfProtection, signupHandler('artist'));
router.post('/signup/gallery', csrfProtection, signupHandler('gallery'));

router.get('/login', csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  res.render('login');
});

router.post('/login', csrfProtection, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.flash('error', 'All fields are required');
    return res.redirect('/login');
  }
  try {
    const user = await findUserByUsername(username);
    if (user) {
      const match = await new Promise((resolve, reject) => {
        bcrypt.compare(password, user.password, (err, m) => (err ? reject(err) : resolve(m)));
      });
      if (match) {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        return res.redirect(`/dashboard/${user.role}`);
      }
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.user = { username, role: 'admin' };
        return res.redirect('/dashboard');
      }
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.user = { username, role: 'admin' };
      return res.redirect('/dashboard');
    }
    req.flash('error', 'Invalid credentials');
    res.redirect('/login');
  } catch (err) {
    console.error('Error finding user by username:', err);
    req.flash('error', 'Server error');
    res.redirect('/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
