const { db } = require('./db');

function getArtwork(gallerySlug, id, cb) {
  const query = `SELECT artworks.*, artists.gallery_slug, artists.id as artistId
                 FROM artworks JOIN artists ON artworks.artist_id = artists.id
                 WHERE artworks.id = ? AND artists.gallery_slug = ?`;
  db.get(query, [id, gallerySlug], (err, row) => {
    if (err || !row) return cb(err || new Error('Not found'));
    const artwork = {
      id: row.id,
      title: row.title,
      medium: row.medium,
      dimensions: row.dimensions,
      price: row.price,
      imageFull: row.imageFull,
      imageStandard: row.imageStandard,
      imageThumb: row.imageThumb,
      status: row.status,
      hide_collected: row.hide_collected,
      featured: row.featured,
      isVisible: row.isVisible,
      isFeatured: row.isFeatured
    };
    cb(null, { artwork, artistId: row.artistId });
  });
}

function getArtworksByArtist(artistId, cb) {
  db.all('SELECT * FROM artworks WHERE artist_id = ?', [artistId], cb);
}

function updateArtworkCollection(id, collectionId, cb) {
  db.run('UPDATE artworks SET collection_id = ? WHERE id = ?', [collectionId, id], cb);
}

module.exports = { getArtwork, getArtworksByArtist, updateArtworkCollection };
