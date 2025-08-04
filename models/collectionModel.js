const { db } = require('./db');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function createCollection(name, artistId, slug) {
  const stmt = `INSERT INTO collections (name, artist_id, slug) VALUES (?,?,?)`;
  await run(stmt, [name, artistId, slug]);
}

async function getCollectionsByArtist(artistId) {
  return all('SELECT * FROM collections WHERE artist_id = ?', [artistId]);
}

async function updateCollection(id, name) {
  await run('UPDATE collections SET name = ? WHERE id = ?', [name, id]);
}

module.exports = { createCollection, getCollectionsByArtist, updateCollection };
