const fs = require('fs').promises;
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'db.json');

async function loadDB() {
  try {
    const data = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return { artworks: [] };
    throw err;
  }
}

async function saveDB(db) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

async function addArtwork(artwork) {
  const db = await loadDB();
  db.artworks.push(artwork);
  await saveDB(db);
}

module.exports = { loadDB, saveDB, addArtwork };
