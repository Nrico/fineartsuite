const { db } = require('./db');

function getArtist(gallerySlug, id, cb) {
  const artistSql =
    'SELECT * FROM artists WHERE id = ? AND gallery_slug = ? AND archived = 0';
  db.get(artistSql, [id, gallerySlug], (err, artist) => {
    if (err || !artist) return cb(err || new Error('Not found'));
    const artSql = 'SELECT * FROM artworks WHERE artist_id = ? AND archived = 0';
    db.all(artSql, [id], (err2, artworks) => {
      if (err2) return cb(err2);
      artist.artworks = artworks || [];
      cb(null, artist);
    });
  });
}

function createArtist(id, name, gallerySlug, cb) {
  const stmt = `INSERT INTO artists (id, gallery_slug, name) VALUES (?,?,?)`;
  db.run(stmt, [id, gallerySlug, name], cb);
}

function getArtistById(id, cb) {
  db.get('SELECT * FROM artists WHERE id = ?', [id], cb);
}

function updateArtist(id, name, bio, fullBio, bioImageUrl, cb) {
  const stmt = `UPDATE artists SET name = ?, bio = ?, fullBio = ?, bioImageUrl = ? WHERE id = ?`;
  db.run(stmt, [name, bio, fullBio, bioImageUrl, id], cb);
}

function archiveArtist(id, cb) {
  db.run('UPDATE artists SET archived = 1 WHERE id = ?', [id], cb);
}

function unarchiveArtist(id, cb) {
  db.run('UPDATE artists SET archived = 0 WHERE id = ?', [id], cb);
}

module.exports = {
  getArtist,
  createArtist,
  getArtistById,
  updateArtist,
  archiveArtist,
  unarchiveArtist
};
