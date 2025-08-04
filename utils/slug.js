const slugify = str =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

function generateUniqueSlug(db, table, column, title) {
  return new Promise((resolve, reject) => {
    const base = slugify(title || '');
    let slug = base;
    let count = 1;
    function check() {
      db.get(`SELECT 1 FROM ${table} WHERE ${column} = ?`, [slug], (err, row) => {
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
