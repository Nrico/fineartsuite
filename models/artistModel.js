const { db } = require('./db');

function getArtist(gallerySlug, id, cb) {
  db.get('SELECT * FROM artists WHERE id = ? AND gallery_slug = ?', [id, gallerySlug], (err, artist) => {
    if (err || !artist) return cb(err || new Error('Not found'));
    db.all('SELECT * FROM artworks WHERE artist_id = ?', [id], (err2, artworks) => {
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

module.exports = { getArtist, createArtist };
