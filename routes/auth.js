const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf();
const { createUser, findUserByUsername } = require('../models/userModel');
const { createArtist } = require('../models/artistModel');
const { createGallery } = require('../models/galleryModel');
const { db } = require('../models/db');
const bcrypt = require('../utils/bcrypt');
const { promisify } = require('util');
const { body, validationResult } = require('express-validator');

const createArtistAsync = promisify(createArtist);
const createGalleryAsync = promisify(createGallery);
const compareAsync = promisify(bcrypt.compare);

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const VALID_PROMO_CODES = ['taos'];
const USERNAME_REGEX = /^[a-z0-9-]+$/;

const signupValidation = [
  body('display_name').trim().notEmpty().withMessage('Display name is required')
    .isLength({ max: 100 }).withMessage('Display name must be at most 100 characters'),
  body('username').trim().notEmpty().withMessage('Username is required')
    .isLength({ max: 50 }).withMessage('Username must be at most 50 characters')
    .matches(USERNAME_REGEX).withMessage('Username may only contain lowercase letters, numbers, and hyphens'),
  body('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('passcode').notEmpty().withMessage('Passcode is required')
    .isIn(VALID_PROMO_CODES).withMessage('Invalid passcode')
];

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required')
    .isLength({ max: 50 }),
  body('password').notEmpty().withMessage('Password is required')
];

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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect(`/signup/${role}`);
    }

    const { display_name, username, password, passcode } = req.body;
    let id;
    try {
      id = await createUser(display_name, username, password, role, passcode);
    } catch (err) {
      console.error('Error creating user:', err);
      req.flash('error', 'Signup failed. Please try again.');
      return res.redirect(`/signup/${role}`);
    }

    try {
      if (role === 'artist') {
        await createArtistAsync(id, display_name, '');
      } else if (role === 'gallery') {
        await createGalleryAsync(username, display_name);
      }
    } catch (err) {
      return handleSignupError(id, req, res, role, err);
    }

    completeSignup(req, res, id, username, role);
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

router.post('/signup/artist', csrfProtection, signupValidation, signupHandler('artist'));
router.post('/signup/gallery', csrfProtection, signupValidation, signupHandler('gallery'));

router.get('/login', csrfProtection, (req, res) => {
  res.locals.csrfToken = req.csrfToken();
  res.render('login');
});

router.post('/login', csrfProtection, loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array()[0].msg);
    return res.redirect('/login');
  }
  const { username, password } = req.body;
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
