const { db } = require('./db');

function getGallery(slug, cb) {
  const galleryQuery = 'SELECT slug, name, bio FROM galleries WHERE slug = ?';
  db.get(galleryQuery, [slug], (err, gallery) => {
    if (err || !gallery) return cb(err || new Error('Not found'));
    db.all('SELECT * FROM artists WHERE gallery_slug = ?', [slug], (err2, artists) => {
      if (err2) return cb(err2);
      let remaining = artists.length;
      const featured = [];
      if (remaining === 0) {
        gallery.artists = [];
        gallery.featuredArtworks = [];
        return cb(null, gallery);
      }
      artists.forEach(artist => {
        db.all('SELECT * FROM artworks WHERE artist_id = ? AND isVisible = 1', [artist.id], (err3, artworks) => {
          artist.artworks = artworks || [];
          featured.push(...(artworks || []).filter(a => a.isFeatured));
          if (--remaining === 0) {
            gallery.artists = artists;
            gallery.featuredArtworks = featured;
            cb(null, gallery);
          }
        });
      });
    });
  });
}

module.exports = { getGallery };
