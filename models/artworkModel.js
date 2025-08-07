const { db } = require('./db');
const { randomUUID } = require('crypto');
const { promisify } = require('util');

const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbRun = promisify(db.run.bind(db));

async function getArtwork(gallerySlug, id) {
  const query = `SELECT artworks.*, artists.gallery_slug, artists.id as artistId
                 FROM artworks JOIN artists ON artworks.artist_id = artists.id
                 WHERE artworks.id = ? AND artists.gallery_slug = ?
                 AND artworks.archived = 0 AND artists.archived = 0`;
  const row = await dbGet(query, [id, gallerySlug]);
  if (!row) throw new Error('Not found');
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
    isVisible: row.isVisible,
    isFeatured: row.isFeatured,
    description: row.description,
    framed: row.framed,
    readyToHang: row.ready_to_hang
  };
  return { artwork, artistId: row.artistId };
}

async function getArtworksByArtist(artistId) {
  return dbAll('SELECT * FROM artworks WHERE artist_id = ? AND archived = 0', [artistId]);
}

async function updateArtworkCollection(id, collectionId) {
  await dbRun('UPDATE artworks SET collection_id = ? WHERE id = ?', [collectionId, id]);
}

async function createArtwork(artistId, title, medium, dimensions, price, description, framed, readyToHang, images, isFeatured) {
  const row = await dbGet('SELECT gallery_slug FROM artists WHERE id = ?', [artistId]);
  if (!row) throw new Error('Artist not found');
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
  await dbRun(stmt, params);
  return id;
}

async function archiveArtwork(id) {
  await dbRun('UPDATE artworks SET archived = 1 WHERE id = ?', [id]);
}

async function unarchiveArtwork(id) {
  await dbRun('UPDATE artworks SET archived = 0 WHERE id = ?', [id]);
}

module.exports = {
  getArtwork,
  getArtworksByArtist,
  updateArtworkCollection,
  createArtwork,
  archiveArtwork,
  unarchiveArtwork
};
