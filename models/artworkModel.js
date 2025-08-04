const { db } = require('./db');
const { randomUUID } = require('crypto');

function getArtwork(gallerySlug, id, cb) {
  const query = `SELECT artworks.*, artists.gallery_slug, artists.id as artistId
                 FROM artworks JOIN artists ON artworks.artist_id = artists.id
                 WHERE artworks.id = ? AND artists.gallery_slug = ?
                 AND artworks.archived = 0 AND artists.archived = 0`;
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
      isFeatured: row.isFeatured,
      description: row.description,
      framed: row.framed,
      readyToHang: row.ready_to_hang
    };
    cb(null, { artwork, artistId: row.artistId });
  });
}

function getArtworksByArtist(artistId, cb) {
  db.all('SELECT * FROM artworks WHERE artist_id = ? AND archived = 0', [artistId], cb);
}

function updateArtworkCollection(id, collectionId, cb) {
  db.run('UPDATE artworks SET collection_id = ? WHERE id = ?', [collectionId, id], cb);
}

function createArtwork(artistId, title, medium, dimensions, price, description, framed, readyToHang, images, isFeatured, cb) {
  db.get('SELECT gallery_slug FROM artists WHERE id = ?', [artistId], (err, row) => {
    if (err || !row) return cb(err || new Error('Artist not found'));
    const id = randomUUID();
    const stmt = `INSERT INTO artworks (id, artist_id, gallery_slug, title, medium, dimensions, price, imageFull, imageStandard, imageThumb, status, isVisible, isFeatured, description, framed, ready_to_hang)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [
      id,
      artistId,
      row.gallery_slug,
      title,
      medium,
      dimensions,
      price || '',
      images.imageFull,
      images.imageStandard,
      images.imageThumb,
      'available',
      1,
      isFeatured ? 1 : 0,
      description || '',
      framed ? 1 : 0,
      readyToHang ? 1 : 0
    ];
    db.run(stmt, params, err2 => cb(err2, id));
  });
}

function archiveArtwork(id, cb) {
  db.run('UPDATE artworks SET archived = 1 WHERE id = ?', [id], cb);
}

function unarchiveArtwork(id, cb) {
  db.run('UPDATE artworks SET archived = 0 WHERE id = ?', [id], cb);
}

module.exports = {
  getArtwork,
  getArtworksByArtist,
  updateArtworkCollection,
  createArtwork,
  archiveArtwork,
  unarchiveArtwork
};
