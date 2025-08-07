const { db } = require('./db');
const bcrypt = require('../utils/bcrypt');
const { promisify } = require('util');

async function createUser(displayName, username, password, role, promoCode) {
  const stmt = `INSERT INTO users (display_name, username, password, role, promo_code) VALUES (?,?,?,?,?)`;
  const hash = await promisify(bcrypt.hash)(password, 10);
  return new Promise((resolve, reject) => {
    db.run(stmt, [displayName, username, hash, role, promoCode], function(err) {
      if (err) return reject(err);
      resolve(this ? this.lastID : null);
    });
  });
}

function findUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

module.exports = { createUser, findUserByUsername };
