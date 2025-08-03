const { db } = require('./db');

function createCollection(name, artistId, slug, cb) {
  const stmt = `INSERT INTO collections (name, artist_id, slug) VALUES (?,?,?)`;
  db.run(stmt, [name, artistId, slug], cb);
}

function getCollectionsByArtist(artistId, cb) {
  db.all('SELECT * FROM collections WHERE artist_id = ?', [artistId], cb);
}

function updateCollection(id, name, cb) {
  db.run('UPDATE collections SET name = ? WHERE id = ?', [name, id], cb);
}

module.exports = { createCollection, getCollectionsByArtist, updateCollection };
