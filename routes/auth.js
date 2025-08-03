const express = require('express');
const router = express.Router();
const { createUser, findUserByUsername } = require('../models/userModel');
const bcrypt = require('../utils/bcrypt');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const VALID_PROMO_CODES = ['taos'];

function signupHandler(role) {
  return (req, res) => {
    const { display_name, username, password, passcode } = req.body;
    if (!display_name || !username || !password || !passcode) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/signup/${role}`);
    }
    if (!VALID_PROMO_CODES.includes(passcode)) {
      req.flash('error', 'Invalid passcode');
      return res.redirect(`/signup/${role}`);
    }
    createUser(display_name, username, password, role, passcode, (err, id) => {
      if (err) {
        req.flash('error', 'Signup failed');
        return res.redirect(`/signup/${role}`);
      }
      req.session.user = { id, username, role };
      return res.redirect(`/dashboard/${role}`);
    });
  };
}

router.get('/signup', (req, res) => {
  res.render('signup/index');
});

router.get('/signup/artist', (req, res) => {
  res.render('signup/artist');
});

router.get('/signup/gallery', (req, res) => {
  res.render('signup/gallery');
});

router.post('/signup/artist', signupHandler('artist'));
router.post('/signup/gallery', signupHandler('gallery'));

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.flash('error', 'All fields are required');
    return res.redirect('/login');
  }
  findUserByUsername(username, (err, user) => {
    if (user) {
      return bcrypt.compare(password, user.password, (err2, match) => {
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
      });
    }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.user = { username, role: 'admin' };
      return res.redirect('/dashboard');
    }
    req.flash('error', 'Invalid credentials');
    res.redirect('/login');
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
