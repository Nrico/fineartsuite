const { db } = require('./db');
const { promisify } = require('util');

const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbRun = promisify(db.run.bind(db));

async function getArtist(gallerySlug, id) {
  const artistSql =
    'SELECT * FROM artists WHERE id = ? AND gallery_slug = ? AND archived = 0 AND live = 1';
  const artist = await dbGet(artistSql, [id, gallerySlug]);
  if (!artist) throw new Error('Not found');
  const artSql = 'SELECT * FROM artworks WHERE artist_id = ? AND archived = 0';
  const artworks = await dbAll(artSql, [id]);
  artist.artworks = artworks || [];
  return artist;
}

async function createArtist(id, name, gallerySlug, live = 0) {
  const stmt = `INSERT INTO artists (id, gallery_slug, name, live, display_order)
                VALUES (?,?,?,?, COALESCE((SELECT MAX(display_order) + 1 FROM artists WHERE gallery_slug = ?), 0))`;
  await dbRun(stmt, [id, gallerySlug, name, live ? 1 : 0, gallerySlug]);
}

async function getArtistById(id) {
  return dbGet('SELECT * FROM artists WHERE id = ?', [id]);
}

async function updateArtist(id, name, bio, fullBio, bioImageUrl) {
  const stmt = `UPDATE artists SET name = ?, bio = ?, fullBio = ?, bioImageUrl = ? WHERE id = ?`;
  await dbRun(stmt, [name, bio, fullBio, bioImageUrl, id]);
}

async function setArtistLive(id, live) {
  const stmt = 'UPDATE artists SET live = ? WHERE id = ?';
  await dbRun(stmt, [live ? 1 : 0, id]);
}

async function toggleArchive(id, archived) {
  try {
    await dbRun('BEGIN TRANSACTION');
    await dbRun('UPDATE artists SET archived = ? WHERE id = ?', [archived, id]);
    await dbRun('UPDATE artworks SET archived = ? WHERE artist_id = ?', [archived, id]);
    await dbRun('COMMIT');
  } catch (err) {
    await dbRun('ROLLBACK');
    throw err;
  }
}

async function archiveArtist(id) {
  await toggleArchive(id, 1);
}

async function unarchiveArtist(id) {
  await toggleArchive(id, 0);
}

module.exports = {
  getArtist,
  createArtist,
  getArtistById,
  updateArtist,
  setArtistLive,
  archiveArtist,
  unarchiveArtist
};
