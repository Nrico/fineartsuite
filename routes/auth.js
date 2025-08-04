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

function validateSignup(req) {
  const { display_name, username, password, passcode } = req.body;
  if (!display_name || !username || !password || !passcode) {
    return 'All fields are required';
  }
  if (!VALID_PROMO_CODES.includes(passcode)) {
    return 'Invalid passcode';
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username may only contain lowercase letters, numbers, and hyphens';
  }
  return null;
}

function handleSignupError(id, req, res, role) {
  db.run('DELETE FROM users WHERE id = ?', [id], () => {
    req.flash('error', 'Signup failed');
    res.redirect(`/signup/${role}`);
  });
}

function completeSignup(req, res, id, username, role) {
  req.session.user = { id, username, role };
  res.redirect(`/dashboard/${role}`);
}

function handleArtistSignup(id, username, displayName, req, res) {
  createArtist(id, displayName, '', err => {
    if (err) {
      return handleSignupError(id, req, res, 'artist');
    }
    completeSignup(req, res, id, username, 'artist');
  });
}

function handleGallerySignup(id, username, displayName, req, res) {
  createGallery(username, displayName, err => {
    if (err) {
      return handleSignupError(id, req, res, 'gallery');
    }
    completeSignup(req, res, id, username, 'gallery');
  });
}

function isAdminCredentials(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function signupHandler(role) {
  return (req, res) => {
    const error = validateSignup(req);
    if (error) {
      req.flash('error', error);
      return res.redirect(`/signup/${role}`);
    }

    const { display_name, username, password, passcode } = req.body;
    createUser(display_name, username, password, role, passcode, (err, id) => {
      if (err) {
        req.flash('error', 'Signup failed');
        return res.redirect(`/signup/${role}`);
      }
      if (role === 'artist') {
        return handleArtistSignup(id, username, display_name, req, res);
      }
      if (role === 'gallery') {
        return handleGallerySignup(id, username, display_name, req, res);
      }
      completeSignup(req, res, id, username, role);
    });
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

router.post('/login', csrfProtection, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.flash('error', 'All fields are required');
    return res.redirect('/login');
  }
  if (isAdminCredentials(username, password)) {
    req.session.user = { username, role: 'admin' };
    return res.redirect('/dashboard');
  }
  findUserByUsername(username, (err, user) => {
    if (err) {
      console.error('Error finding user by username:', err);
      req.flash('error', 'Server error');
      return res.redirect('/login');
    }
    if (!user) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    bcrypt.compare(password, user.password, (err2, match) => {
      if (match) {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        return res.redirect(`/dashboard/${user.role}`);
      }
      req.flash('error', 'Invalid credentials');
      res.redirect('/login');
    });
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
