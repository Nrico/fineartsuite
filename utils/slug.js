const slugify = str =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

function generateUniqueSlug(db, table, column, title) {
  return new Promise((resolve, reject) => {
    const TABLES = {
      galleries: 'galleries',
      artists: 'artists',
      artworks: 'artworks'
    };
    const COLUMNS = {
      galleries: { slug: 'slug' },
      artists: { id: 'id' },
      artworks: { id: 'id' }
    };

    const safeTable = TABLES[table];
    const safeColumn = COLUMNS[table] && COLUMNS[table][column];

    if (!safeTable || !safeColumn) {
      return reject(new Error('Invalid table or column'));
    }

    const base = slugify(title || '');
    let slug = base;
    let count = 1;

    function check() {
      const query = `SELECT 1 FROM ${safeTable} WHERE ${safeColumn} = ?`;
      db.get(query, [slug], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(slug);
        slug = `${base}-${count++}`;
        check();
      });
    }

    check();
  });
}

module.exports = { generateUniqueSlug };
