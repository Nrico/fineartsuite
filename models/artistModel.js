const { db } = require('./db');

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

async function getArtist(gallerySlug, id) {
  const artistSql =
    'SELECT * FROM artists WHERE id = ? AND gallery_slug = ? AND archived = 0 AND live = 1';
  const artist = await get(artistSql, [id, gallerySlug]);
  if (!artist) throw new Error('Not found');
  const artworks = await all('SELECT * FROM artworks WHERE artist_id = ? AND archived = 0', [id]);
  artist.artworks = artworks || [];
  return artist;
}

async function createArtist(id, name, gallerySlug, live = 0) {
  const stmt = `INSERT INTO artists (id, gallery_slug, name, live, display_order)
                VALUES (?,?,?,?, COALESCE((SELECT MAX(display_order) + 1 FROM artists WHERE gallery_slug = ?), 0))`;
  await run(stmt, [id, gallerySlug, name, live ? 1 : 0, gallerySlug]);
}

async function getArtistById(id) {
  return get('SELECT * FROM artists WHERE id = ?', [id]);
}

async function updateArtist(id, name, bio, fullBio, bioImageUrl) {
  const stmt = `UPDATE artists SET name = ?, bio = ?, fullBio = ?, bioImageUrl = ? WHERE id = ?`;
  await run(stmt, [name, bio, fullBio, bioImageUrl, id]);
}

async function archiveArtist(id) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const rollback = err => db.run('ROLLBACK', () => reject(err));
      db.run('UPDATE artists SET archived = 1 WHERE id = ?', [id], err => {
        if (err) return rollback(err);
        db.run('UPDATE artworks SET archived = 1 WHERE artist_id = ?', [id], err2 => {
          if (err2) return rollback(err2);
          db.run('COMMIT', err3 => (err3 ? reject(err3) : resolve()));
        });
      });
    });
  });
}

async function unarchiveArtist(id) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const rollback = err => db.run('ROLLBACK', () => reject(err));
      db.run('UPDATE artists SET archived = 0 WHERE id = ?', [id], err => {
        if (err) return rollback(err);
        db.run('UPDATE artworks SET archived = 0 WHERE artist_id = ?', [id], err2 => {
          if (err2) return rollback(err2);
          db.run('COMMIT', err3 => (err3 ? reject(err3) : resolve()));
        });
      });
    });
  });
}

module.exports = {
  getArtist,
  createArtist,
  getArtistById,
  updateArtist,
  archiveArtist,
  unarchiveArtist
};
