const { db } = require('./db');

function getGallery(slug, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  const { includeArchivedArtists = false, includeArchivedArtworks = false } =
    options || {};

  const galleryQuery =
    'SELECT slug, name, bio, logo_url, contact_email, phone FROM galleries WHERE slug = ?';
  db.get(galleryQuery, [slug], (err, gallery) => {
    if (err || !gallery) return cb(err || new Error('Not found'));
    const artistCond = includeArchivedArtists ? '' : 'AND a.archived = 0';
    const liveCond = 'AND a.live = 1';
    const artworkCond = includeArchivedArtworks ? '' : 'AND w.archived = 0';
    const sql = `SELECT a.id as artistId, a.name as artistName, a.bio, a.bioImageUrl, a.fullBio, a.archived as artistArchived,
                        w.id as artworkId, w.title, w.medium, w.dimensions, w.price, w.imageFull, w.imageStandard, w.imageThumb,
                        w.status, w.hide_collected, w.featured, w.isVisible, w.isFeatured, w.description, w.framed, w.ready_to_hang,
                        w.archived as artworkArchived
                 FROM artists a
                 LEFT JOIN artworks w ON w.artist_id = a.id AND w.isVisible = 1 ${artworkCond}
                 WHERE a.gallery_slug = ? ${artistCond} ${liveCond}
                 ORDER BY a.display_order, w.display_order`;
    db.all(sql, [slug], (err2, rows) => {
      if (err2) return cb(err2);
      const artistMap = {};
      const featured = [];
      rows.forEach(row => {
        let artist = artistMap[row.artistId];
        if (!artist) {
          artist = {
            id: row.artistId,
            name: row.artistName,
            bio: row.bio,
            bioImageUrl: row.bioImageUrl,
            fullBio: row.fullBio,
            archived: row.artistArchived,
            artworks: []
          };
          artistMap[row.artistId] = artist;
        }
        if (row.artworkId) {
          const artwork = {
            id: row.artworkId,
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
            readyToHang: row.ready_to_hang,
            archived: row.artworkArchived,
            artistName: row.artistName
          };
          artist.artworks.push(artwork);
          if (artwork.isFeatured) featured.push(artwork);
        }
      });
      // Exclude archived artists and artworks from the returned gallery data
      const artists = Object.values(artistMap).filter(a => !a.archived);
      artists.forEach(a => {
        a.artworks = a.artworks.filter(w => !w.archived);
      });
      gallery.artists = artists;
      gallery.featuredArtworks = featured.filter(w => !w.archived);
      cb(null, gallery);
    });
  });
}

function createGallery(slug, name, cb) {
  const stmt = 'INSERT INTO galleries (slug, name) VALUES (?, ?)';
  db.run(stmt, [slug, name], cb);
}

module.exports = { getGallery, createGallery };
