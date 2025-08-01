const { db } = require('./db');

function getGallery(slug, cb) {
  const galleryQuery = 'SELECT slug, name, bio FROM galleries WHERE slug = ?';
  db.get(galleryQuery, [slug], (err, gallery) => {
    if (err || !gallery) return cb(err || new Error('Not found'));
    db.all('SELECT * FROM artists WHERE gallery_slug = ?', [slug], (err2, artists) => {
      if (err2) return cb(err2);
      let remaining = artists.length;
      if (remaining === 0) {
        gallery.artists = [];
        return cb(null, gallery);
      }
      artists.forEach(artist => {
        db.all('SELECT * FROM artworks WHERE artist_id = ?', [artist.id], (err3, artworks) => {
          artist.artworks = artworks || [];
          if (--remaining === 0) {
            gallery.artists = artists;
            const firstArtist = artists[0];
            if (firstArtist && firstArtist.artworks && firstArtist.artworks[0]) {
              gallery.featuredArtwork = firstArtist.artworks[0];
            }
            cb(null, gallery);
          }
        });
      });
    });
  });
}

module.exports = { getGallery };
