const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'gallery.db'));

function initialize() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS galleries (
      slug TEXT PRIMARY KEY,
      name TEXT,
      bio TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      gallery_slug TEXT,
      name TEXT,
      bio TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS artworks (
      id TEXT PRIMARY KEY,
      artist_id TEXT,
      title TEXT,
      medium TEXT,
      dimensions TEXT,
      price TEXT,
      image TEXT,
      status TEXT
    )`);
    db.run('ALTER TABLE artworks ADD COLUMN status TEXT', () => {});

    db.get('SELECT COUNT(*) as count FROM galleries', (err, row) => {
      if (err) return;
      if (row.count === 0) seed();
    });
  });
}

function seed() {
  const galleryStmt = db.prepare('INSERT INTO galleries (slug, name, bio) VALUES (?,?,?)');
  galleryStmt.run('demo-gallery', 'Demo Gallery', 'Welcome to the demo gallery showcasing placeholder artwork.');
  galleryStmt.run('city-gallery', 'City Gallery', 'Featuring modern works from local artists.');
  galleryStmt.finalize();

  const artistStmt = db.prepare('INSERT INTO artists (id, gallery_slug, name, bio) VALUES (?,?,?,?)');
  artistStmt.run('artist1', 'demo-gallery', 'Jane Doe', 'An abstract artist exploring color and form.');
  artistStmt.run('artist2', 'demo-gallery', 'John Smith', 'Exploring the geometry of urban life.');
  artistStmt.run('artist3', 'demo-gallery', 'Emily Carter', 'Mixed media artist inspired by nature.');
  artistStmt.run('artist4', 'demo-gallery', 'Liam Nguyen', 'Digital artist focusing on surreal landscapes.');
  artistStmt.run('artist5', 'city-gallery', 'Sophia Martinez', 'Sculptor merging modern and classical motifs.');
  artistStmt.finalize();

  const artworkStmt = db.prepare('INSERT INTO artworks (id, artist_id, title, medium, dimensions, price, image, status) VALUES (?,?,?,?,?,?,?,?)');
  artworkStmt.run('art1', 'artist1', 'Dreamscape', 'Oil on Canvas', '30x40', '$4000', 'https://placehold.co/600x400?text=Dreamscape', 'available');
  artworkStmt.run('art2', 'artist1', 'Ocean Depths', 'Acrylic', '24x36', '$2500', 'https://placehold.co/600x400?text=Ocean+Depths', 'available');
  artworkStmt.run('c1', 'artist2', 'City Lights', 'Oil on Canvas', '24x30', '$3500', 'https://via.placeholder.com/600x400?text=City+Lights', 'available');
  artworkStmt.run('art3', 'artist3', 'Forest Whisper', 'Watercolor', '18x24', '$1800', 'https://placehold.co/600x400?text=Forest+Whisper', 'available');
  artworkStmt.run('art4', 'artist4', 'Dream Horizon', 'Digital', '1920x1080', '$1200', 'https://placehold.co/600x400?text=Dream+Horizon', 'available');
  artworkStmt.run('art5', 'artist5', 'Stone Echo', 'Marble', '20x40', '$5000', 'https://placehold.co/600x400?text=Stone+Echo', 'available');
  artworkStmt.finalize();
}

module.exports = { db, initialize };
