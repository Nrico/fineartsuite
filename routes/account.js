const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  res.render('account', { user: req.session.user });
});

module.exports = router;
