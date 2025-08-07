const { db } = require('./db');

function getArtist(gallerySlug, id) {
  return new Promise((resolve, reject) => {
    let artistSql =
      'SELECT * FROM artists WHERE id = ? AND archived = 0 AND live = 1';
    const params = [id];
    if (gallerySlug) {
      artistSql += ' AND gallery_slug = ?';
      params.push(gallerySlug);
    } else {
      artistSql += ' AND gallery_slug IS NULL';
    }
    db.get(artistSql, params, (err, artist) => {
      if (err || !artist) return reject(err || new Error('Not found'));
      const artSql = 'SELECT * FROM artworks WHERE artist_id = ? AND archived = 0';
      db.all(artSql, [id], (err2, artworks) => {
        if (err2) return reject(err2);
        artist.artworks = artworks || [];
        resolve(artist);
      });
    });
  });
}

function createArtist(id, name, gallerySlug, live, cb) {
  if (typeof live === 'function') {
    cb = live;
    live = 0;
  }
  let stmt;
  let params;
  if (gallerySlug) {
    stmt = `INSERT INTO artists (id, gallery_slug, name, live, display_order)
            VALUES (?,?,?,?, COALESCE((SELECT MAX(display_order) + 1 FROM artists WHERE gallery_slug = ?), 0))`;
    params = [id, gallerySlug, name, live ? 1 : 0, gallerySlug];
  } else {
    stmt = `INSERT INTO artists (id, gallery_slug, name, live, display_order)
            VALUES (?,?,?, ?, COALESCE((SELECT MAX(display_order) + 1 FROM artists WHERE gallery_slug IS NULL), 0))`;
    params = [id, null, name, live ? 1 : 0];
  }
  db.run(stmt, params, cb);
}

function getArtistById(id, cb) {
  db.get('SELECT * FROM artists WHERE id = ?', [id], cb);
}

function updateArtist(id, name, bio, fullBio, bioImageUrl, cb) {
  const stmt = `UPDATE artists SET name = ?, bio = ?, fullBio = ?, bioImageUrl = ? WHERE id = ?`;
  db.run(stmt, [name, bio, fullBio, bioImageUrl, id], cb);
}

function setArtistLive(id, live, cb) {
  const stmt = 'UPDATE artists SET live = ? WHERE id = ?';
  db.run(stmt, [live ? 1 : 0, id], cb);
}

function toggleArchive(id, archived, cb) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const rollback = err => db.run('ROLLBACK', () => cb(err));
    db.run('UPDATE artists SET archived = ? WHERE id = ?', [archived, id], err => {
      if (err) return rollback(err);
      db.run('UPDATE artworks SET archived = ? WHERE artist_id = ?', [archived, id], err2 => {
        if (err2) return rollback(err2);
        db.run('COMMIT', cb);
      });
    });
  });
}

function archiveArtist(id, cb) {
  toggleArchive(id, 1, cb);
}

function unarchiveArtist(id, cb) {
  toggleArchive(id, 0, cb);
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
