const { db } = require('./db');
const bcrypt = require('../utils/bcrypt');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function createUser(displayName, username, password, role, promoCode) {
  const stmt = `INSERT INTO users (display_name, username, password, role, promo_code) VALUES (?,?,?,?,?)`;
  const hash = await new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, (err, h) => (err ? reject(err) : resolve(h)));
  });
  const res = await run(stmt, [displayName, username, hash, role, promoCode]);
  return res.lastID;
}

async function findUserByUsername(username) {
  return get('SELECT * FROM users WHERE username = ?', [username]);
}

module.exports = { createUser, findUserByUsername };
