const { db } = require('./db');

function createUser(displayName, username, password, role, promoCode, cb) {
  const stmt = `INSERT INTO users (display_name, username, password, role, promo_code) VALUES (?,?,?,?,?)`;
  db.run(stmt, [displayName, username, password, role, promoCode], function(err) {
    if (cb) cb(err, this ? this.lastID : null);
  });
}

function findUserByUsername(username, cb) {
  db.get('SELECT * FROM users WHERE username = ?', [username], cb);
}

module.exports = { createUser, findUserByUsername };
