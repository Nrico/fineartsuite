const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf();
const { createUser, findUserByUsername } = require('../models/userModel');
const { createArtist } = require('../models/artistModel');
const { generateUniqueSlug } = require('../utils/slug');
const { createGallery } = require('../models/galleryModel');
const { db } = require('../models/db');
const bcrypt = require('../utils/bcrypt');
const { promisify } = require('util');

const createArtistAsync = promisify(createArtist);
const createGalleryAsync = promisify(createGallery);
const compareAsync = promisify(bcrypt.compare);

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

function handleSignupError(id, req, res, role, err) {
  if (err) console.error('Signup error:', err);
  db.run('DELETE FROM users WHERE id = ?', [id], () => {
    req.flash('error', 'Signup failed. Please try again.');
    res.redirect(`/signup/${role}`);
  });
}

function completeSignup(req, res, id, username, role) {
  req.session.user = { id, username, role };
  res.redirect(`/dashboard/${role}`);
}

function isAdminCredentials(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function signupHandler(role) {
  return async (req, res) => {
    const error = validateSignup(req);
    if (error) {
      req.flash('error', error);
      return res.redirect(`/signup/${role}`);
    }

    const { display_name, username, password, passcode } = req.body;
    let userId;
    let artistId;
    try {
      userId = await createUser(display_name, username, password, role, passcode);
    } catch (err) {
      console.error('Error creating user:', err);
      req.flash('error', 'Signup failed. Please try again.');
      return res.redirect(`/signup/${role}`);
    }

    try {
      if (role === 'artist') {
        artistId = await generateUniqueSlug(db, 'artists', 'id', display_name);
        await createArtistAsync(artistId, display_name, null);
      } else if (role === 'gallery') {
        await createGalleryAsync(username, display_name);
      }
    } catch (err) {
      return handleSignupError(userId, req, res, role, err);
    }

    completeSignup(req, res, artistId || userId, username, role);
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
  if (isAdminCredentials(username, password)) {
    req.session.user = { username, role: 'admin' };
    return res.redirect('/dashboard');
  }
  try {
    const user = await findUserByUsername(username);
    if (!user) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    const match = await compareAsync(password, user.password);
    if (match) {
      req.session.user = { id: user.id, username: user.username, role: user.role };
      return res.redirect(`/dashboard/${user.role}`);
    }
    req.flash('error', 'Invalid credentials');
    res.redirect('/login');
  } catch (err) {
    console.error('Login error:', err);
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
