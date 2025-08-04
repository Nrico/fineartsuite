const { db } = require('./db');

function getArtist(gallerySlug, id, cb) {
  const artistSql =
    'SELECT * FROM artists WHERE id = ? AND gallery_slug = ? AND archived = 0 AND live = 1';
  db.get(artistSql, [id, gallerySlug], (err, artist) => {
    if (err || !artist) return cb(err || new Error('Not found'));
    const artSql = 'SELECT * FROM artworks WHERE artist_id = ? AND archived = 0';
    db.all(artSql, [id], (err2, artworks) => {
      if (err2) return cb(err2);
      artist.artworks = artworks || [];
      cb(null, artist);
    });
  });
}

function createArtist(id, name, gallerySlug, live, cb) {
  if (typeof live === 'function') {
    cb = live;
    live = 0;
  }
  const stmt = `INSERT INTO artists (id, gallery_slug, name, live) VALUES (?,?,?,?)`;
  db.run(stmt, [id, gallerySlug, name, live ? 1 : 0], cb);
}

function getArtistById(id, cb) {
  db.get('SELECT * FROM artists WHERE id = ?', [id], cb);
}

function updateArtist(id, name, bio, fullBio, bioImageUrl, cb) {
  const stmt = `UPDATE artists SET name = ?, bio = ?, fullBio = ?, bioImageUrl = ? WHERE id = ?`;
  db.run(stmt, [name, bio, fullBio, bioImageUrl, id], cb);
}

function archiveArtist(id, cb) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const rollback = err => db.run('ROLLBACK', () => cb(err));
    db.run('UPDATE artists SET archived = 1 WHERE id = ?', [id], err => {
      if (err) return rollback(err);
      db.run('UPDATE artworks SET archived = 1 WHERE artist_id = ?', [id], err2 => {
        if (err2) return rollback(err2);
        db.run('COMMIT', cb);
      });
    });
  });
}

function unarchiveArtist(id, cb) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const rollback = err => db.run('ROLLBACK', () => cb(err));
    db.run('UPDATE artists SET archived = 0 WHERE id = ?', [id], err => {
      if (err) return rollback(err);
      db.run('UPDATE artworks SET archived = 0 WHERE artist_id = ?', [id], err2 => {
        if (err2) return rollback(err2);
        db.run('COMMIT', cb);
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
