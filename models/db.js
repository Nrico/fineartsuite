const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('../utils/bcrypt');

const db = new sqlite3.Database(path.join(__dirname, '..', 'gallery.db'));

function initialize() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS galleries (
      slug TEXT PRIMARY KEY,
      name TEXT,
      bio TEXT,
      contact_email TEXT,
      phone TEXT,
      address TEXT,
      gallarist_name TEXT,
      bio_short TEXT,
      bio_full TEXT,
      logo_url TEXT
    )`);
    db.run('ALTER TABLE galleries ADD COLUMN contact_email TEXT', () => {});
    db.run('ALTER TABLE galleries ADD COLUMN phone TEXT', () => {});
    db.run('ALTER TABLE galleries ADD COLUMN address TEXT', () => {});
    db.run('ALTER TABLE galleries ADD COLUMN gallarist_name TEXT', () => {});
    db.run('ALTER TABLE galleries ADD COLUMN bio_short TEXT', () => {});
    db.run('ALTER TABLE galleries ADD COLUMN bio_full TEXT', () => {});
    db.run('ALTER TABLE galleries ADD COLUMN logo_url TEXT', () => {});

    db.run(`CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      gallery_slug TEXT,
      name TEXT,
      bio TEXT,
      bioImageUrl TEXT,
      fullBio TEXT,
      bio_short TEXT,
      bio_full TEXT,
      portrait_url TEXT,
      gallery_id TEXT
    )`);
    db.run('ALTER TABLE artists ADD COLUMN bioImageUrl TEXT', () => {});
    db.run('ALTER TABLE artists ADD COLUMN fullBio TEXT', () => {});
    db.run('ALTER TABLE artists ADD COLUMN bio_short TEXT', () => {});
    db.run('ALTER TABLE artists ADD COLUMN bio_full TEXT', () => {});
    db.run('ALTER TABLE artists ADD COLUMN portrait_url TEXT', () => {});
    db.run('ALTER TABLE artists ADD COLUMN gallery_id TEXT', () => {});

    db.run(`CREATE TABLE IF NOT EXISTS gallery_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT,
      slug TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      description TEXT,
      owner TEXT,
      logo TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      promo_code TEXT
    )`);
    db.run('ALTER TABLE users ADD COLUMN role TEXT', () => {});
    db.run('ALTER TABLE users ADD COLUMN promo_code TEXT', () => {});

    db.run(`CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      artist_id TEXT,
      slug TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS artworks (
      id TEXT PRIMARY KEY,
      artist_id TEXT,
      gallery_slug TEXT,
      title TEXT,
      medium TEXT,
      custom_medium TEXT,
      dimensions TEXT,
      price TEXT,
      imageFull TEXT,
      imageStandard TEXT,
      imageThumb TEXT,
      status TEXT,
      hide_collected INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      isVisible INTEGER DEFAULT 1,
      isFeatured INTEGER DEFAULT 0
    )`);
    db.run('ALTER TABLE artworks ADD COLUMN imageFull TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN imageStandard TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN imageThumb TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN status TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN hide_collected INTEGER DEFAULT 0', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN featured INTEGER DEFAULT 0', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN isVisible INTEGER DEFAULT 1', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN isFeatured INTEGER DEFAULT 0', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN collection_id INTEGER', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN gallery_slug TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN custom_medium TEXT', () => {});

    db.get('SELECT COUNT(*) as count FROM galleries', (err, row) => {
      if (err) return;
      if (row.count === 0) seed();
    });
  });
}

function seed(done) {
  const galleries = [
    { slug: 'demo-gallery', name: 'Demo Gallery', bio: 'Welcome to the demo gallery showcasing placeholder artwork.' },
    { slug: 'city-gallery', name: 'City Gallery', bio: 'Featuring modern works from local artists.' }
  ];
  const artists = [
    { id: 'artist1', gallery_slug: 'demo-gallery', name: 'Jane Doe', bio: 'An abstract artist exploring color and form.', bioImageUrl: 'https://picsum.photos/id/360/150/150', fullBio: 'Jane Doe investigates the emotional resonance of color and shape.\n\nHer canvases challenge viewers to find their own narratives within abstract forms.' },
    { id: 'artist2', gallery_slug: 'demo-gallery', name: 'John Smith', bio: 'Exploring the geometry of urban life.', bioImageUrl: 'https://picsum.photos/id/361/150/150', fullBio: 'John Smith captures cityscapes through precise lines and bold structure.\n\nHis work reflects the tension between order and chaos in metropolitan spaces.' },
    { id: 'artist3', gallery_slug: 'demo-gallery', name: 'Emily Carter', bio: 'Mixed media artist inspired by nature.', bioImageUrl: 'https://picsum.photos/id/362/150/150', fullBio: 'Emily Carter combines found objects and paint to evoke forest serenity.\n\nHer layered textures invite close inspection and contemplation.' },
    { id: 'artist4', gallery_slug: 'demo-gallery', name: 'Liam Nguyen', bio: 'Digital artist focusing on surreal landscapes.', bioImageUrl: 'https://picsum.photos/id/363/150/150', fullBio: 'Liam Nguyen crafts dreamlike vistas with a digital brush.\n\nHe blends reality and imagination to transport viewers beyond the ordinary.' },
    { id: 'artist5', gallery_slug: 'city-gallery', name: 'Sophia Martinez', bio: 'Sculptor merging modern and classical motifs.', bioImageUrl: 'https://picsum.photos/id/364/150/150', fullBio: 'Sophia Martinez merges historical influences with contemporary design.\n\nHer sculptures echo timeless narratives through modern materials.' },
    { id: 'artist6', gallery_slug: 'city-gallery', name: 'Luca Green', bio: 'Painter capturing urban life with bold colors.', bioImageUrl: 'https://picsum.photos/id/365/150/150', fullBio: 'Luca Green paints bustling streets with vibrant energy.\n\nHis dynamic brushwork celebrates the rhythm of city living.' },
    { id: 'artist7', gallery_slug: 'city-gallery', name: 'Ava Patel', bio: 'Digital artist blending technology and emotion.', bioImageUrl: 'https://picsum.photos/id/366/150/150', fullBio: 'Ava Patel explores human connection through digital mediums.\n\nHer creations blur the line between code and compassion.' }
  ];

  const galleryStmt = db.prepare('INSERT INTO galleries (slug, name, bio) VALUES (?,?,?)');
  galleries.forEach(g => galleryStmt.run(g.slug, g.name, g.bio));
  galleryStmt.finalize();

  const artistStmt = db.prepare('INSERT INTO artists (id, gallery_slug, name, bio, bioImageUrl, fullBio) VALUES (?,?,?,?,?,?)');
  artists.forEach(a => artistStmt.run(a.id, a.gallery_slug, a.name, a.bio, a.bioImageUrl, a.fullBio));
  artistStmt.finalize();

  const userStmt = db.prepare('INSERT INTO users (display_name, username, password, role, promo_code) VALUES (?,?,?,?,?)');
  const demoHash = bcrypt.hashSync('password', 10);
  userStmt.run('Demo User', 'demouser', demoHash, 'artist', 'taos');
  userStmt.finalize();

  const artworkStmt = db.prepare('INSERT INTO artworks (id, artist_id, title, medium, dimensions, price, imageFull, imageStandard, imageThumb, status, hide_collected, featured, isVisible, isFeatured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

  function randomImage() {
    const id = Math.floor(Math.random() * 90) + 10; // 10-99
    const r = Math.random();
    if (r < 0.45) {
      // landscape
      return `https://picsum.photos/id/${id}/600/400`;
    } else if (r < 0.9) {
      // square
      return `https://picsum.photos/id/${id}/500/500`;
    }
    // portrait
    return `https://picsum.photos/id/${id}/400/600`;
  }

  function randomPrice() {
    return `$${Math.floor(Math.random() * 4000) + 1000}`;
  }

  const mediums = ['Oil', 'Acrylic', 'Digital', 'Watercolor'];

  artists.forEach(artist => {
    for (let i = 1; i <= 5; i++) {
      const img = randomImage();
      const artId = `${artist.id}-art${i}`;
      const title = `Artwork ${i}`;
      const medium = mediums[(i - 1) % mediums.length];
      const status = i === 1 ? 'collected' : 'available';
      const isFeatured = i === 1 ? 1 : 0;
      artworkStmt.run(artId, artist.id, title, medium, '24x36', randomPrice(), img, img, img, status, 0, 0, 1, isFeatured);
    }
  });

  artworkStmt.finalize(() => {
    if (done) done();
  });
}

module.exports = { db, initialize, seed };
