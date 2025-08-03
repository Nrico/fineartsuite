const { db } = require('./db');
const bcrypt = require('../utils/bcrypt');

function createUser(displayName, username, password, role, promoCode, cb) {
  const stmt = `INSERT INTO users (display_name, username, password, role, promo_code) VALUES (?,?,?,?,?)`;
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      if (cb) cb(err);
      return;
    }
    db.run(stmt, [displayName, username, hash, role, promoCode], function(err2) {
      if (cb) cb(err2, this ? this.lastID : null);
    });
  });
}

function findUserByUsername(username, cb) {
  db.get('SELECT * FROM users WHERE username = ?', [username], cb);
}

module.exports = { createUser, findUserByUsername };
