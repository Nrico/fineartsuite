const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');

router.get('/', authorize(), (req, res) => {
  res.render('account', { user: req.session.user });
});

module.exports = router;
