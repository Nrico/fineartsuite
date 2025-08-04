const { db } = require('./db');
const { randomUUID } = require('crypto');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
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

async function getArtwork(gallerySlug, id) {
  const query = `SELECT artworks.*, artists.gallery_slug, artists.id as artistId
                 FROM artworks JOIN artists ON artworks.artist_id = artists.id
                 WHERE artworks.id = ? AND artists.gallery_slug = ?
                 AND artworks.archived = 0 AND artists.archived = 0`;
  const row = await get(query, [id, gallerySlug]);
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
    featured: row.featured,
    isVisible: row.isVisible,
    isFeatured: row.isFeatured,
    description: row.description,
    framed: row.framed,
    readyToHang: row.ready_to_hang
  };
  return { artwork, artistId: row.artistId };
}

async function getArtworksByArtist(artistId) {
  return all('SELECT * FROM artworks WHERE artist_id = ? AND archived = 0', [artistId]);
}

async function updateArtworkCollection(id, collectionId) {
  await run('UPDATE artworks SET collection_id = ? WHERE id = ?', [collectionId, id]);
}

async function createArtwork(
  artistId,
  title,
  medium,
  dimensions,
  price,
  description,
  framed,
  readyToHang,
  images,
  isFeatured
) {
  const row = await get('SELECT gallery_slug FROM artists WHERE id = ?', [artistId]);
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
  await run(stmt, params);
  return id;
}

async function archiveArtwork(id) {
  await run('UPDATE artworks SET archived = 1 WHERE id = ?', [id]);
}

async function unarchiveArtwork(id) {
  await run('UPDATE artworks SET archived = 0 WHERE id = ?', [id]);
}

module.exports = {
  getArtwork,
  getArtworksByArtist,
  updateArtworkCollection,
  createArtwork,
  archiveArtwork,
  unarchiveArtwork
};

