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

module.exports = { getArtist };
