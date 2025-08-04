const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('../utils/bcrypt');
const randomAvatar = require('../utils/avatar');

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
      gallery_id TEXT,
      archived INTEGER DEFAULT 0,
      live INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      promo_code TEXT
    )`);

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
      isFeatured INTEGER DEFAULT 0,
      description TEXT,
      framed INTEGER DEFAULT 0,
      ready_to_hang INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0
    )`);

    db.get('SELECT COUNT(*) as count FROM galleries', (err, row) => {
      if (err) return;
      if (row.count === 0) seed();
    });
  });
}

function migrate(done) {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    if (done) done();
    return;
  }
  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY
    )`);

    const runNext = index => {
      if (index >= files.length) {
        if (done) done();
        return;
      }
      const file = files[index];
      db.get('SELECT 1 FROM migrations WHERE id = ?', [file], (err, row) => {
        if (err) {
          throw err;
        }
        if (row) {
          runNext(index + 1);
        } else {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          db.exec(sql, execErr => {
            if (execErr && !/no such table/.test(execErr.message)) {
              throw execErr;
            }
            db.run('INSERT INTO migrations (id) VALUES (?)', [file], insertErr => {
              if (insertErr) {
                throw insertErr;
              }
              runNext(index + 1);
            });
          });
        }
      });
    };

    runNext(0);
  });
}

function seed(done) {
  const galleries = [
    { slug: 'demo-gallery', name: 'Demo Gallery', bio: 'Welcome to the demo gallery showcasing placeholder artwork.', contact_email: 'info@demogallery.example', phone: '555-000-0001', logo_url: randomAvatar() },
    { slug: 'city-gallery', name: 'City Gallery', bio: 'Featuring modern works from local artists.', contact_email: 'hello@citygallery.example', phone: '555-000-0002', logo_url: randomAvatar() },
    { slug: 'western-gallery', name: 'Western Gallery', bio: 'Frontier art and desert dreams.', contact_email: 'hello@western.example', phone: '555-867-5309', logo_url: '/line-logo.svg' }
  ];
  const artists = [
    { id: 'artist1', gallery_slug: 'demo-gallery', name: 'Jane Doe', bio: 'An abstract artist exploring color and form.', bioImageUrl: randomAvatar(), fullBio: 'Jane Doe investigates the emotional resonance of color and shape.\n\nHer canvases challenge viewers to find their own narratives within abstract forms.' },
    { id: 'artist2', gallery_slug: 'demo-gallery', name: 'John Smith', bio: 'Exploring the geometry of urban life.', bioImageUrl: randomAvatar(), fullBio: 'John Smith captures cityscapes through precise lines and bold structure.\n\nHis work reflects the tension between order and chaos in metropolitan spaces.' },
    { id: 'artist3', gallery_slug: 'demo-gallery', name: 'Emily Carter', bio: 'Mixed media artist inspired by nature.', bioImageUrl: randomAvatar(), fullBio: 'Emily Carter combines found objects and paint to evoke forest serenity.\n\nHer layered textures invite close inspection and contemplation.' },
    { id: 'artist4', gallery_slug: 'demo-gallery', name: 'Liam Nguyen', bio: 'Digital artist focusing on surreal landscapes.', bioImageUrl: randomAvatar(), fullBio: 'Liam Nguyen crafts dreamlike vistas with a digital brush.\n\nHe blends reality and imagination to transport viewers beyond the ordinary.' },
    { id: 'artist5', gallery_slug: 'city-gallery', name: 'Sophia Martinez', bio: 'Sculptor merging modern and classical motifs.', bioImageUrl: randomAvatar(), fullBio: 'Sophia Martinez merges historical influences with contemporary design.\n\nHer sculptures echo timeless narratives through modern materials.' },
    { id: 'artist6', gallery_slug: 'city-gallery', name: 'Luca Green', bio: 'Painter capturing urban life with bold colors.', bioImageUrl: randomAvatar(), fullBio: 'Luca Green paints bustling streets with vibrant energy.\n\nHis dynamic brushwork celebrates the rhythm of city living.' },
    { id: 'artist7', gallery_slug: 'city-gallery', name: 'Ava Patel', bio: 'Digital artist blending technology and emotion.', bioImageUrl: randomAvatar(), fullBio: 'Ava Patel explores human connection through digital mediums.\n\nHer creations blur the line between code and compassion.' },
    { id: 'sierra', gallery_slug: 'western-gallery', name: 'Sierra Blaze', bio: 'Painter of fiery desert sunsets.', bioImageUrl: randomAvatar(), fullBio: 'Sierra Blaze captures the burnished skies of the frontier.\n\nHer canvases glow with sun and sand.' },
    { id: 'dusty', gallery_slug: 'western-gallery', name: 'Dusty Canyon', bio: 'Sculptor shaping metal and wind.', bioImageUrl: randomAvatar(), fullBio: 'Dusty Canyon bends reclaimed steel into swirling desert forms.\n\nEach piece hums with the whisper of arid breezes.' },
    { id: 'mesa', gallery_slug: 'western-gallery', name: 'Mesa Lark', bio: 'Watercolorist of quiet mesas.', bioImageUrl: randomAvatar(), fullBio: 'Mesa Lark washes paper with tranquil pigments.\n\nHer work celebrates the soft songs of high desert mornings.' },
    { id: 'ridge', gallery_slug: 'western-gallery', name: 'Ridge Walker', bio: 'Digital artist reimagining frontier myths.', bioImageUrl: randomAvatar(), fullBio: 'Ridge Walker rides the line between code and cowboy lore.\n\nHis pixels gallop through cosmic prairies.' }
  ];

  const galleryStmt = db.prepare('INSERT INTO galleries (slug, name, bio, contact_email, phone, logo_url) VALUES (?,?,?,?,?,?)');
  galleries.forEach(g => galleryStmt.run(g.slug, g.name, g.bio, g.contact_email, g.phone, g.logo_url));
  galleryStmt.finalize();

  const artistStmt = db.prepare('INSERT INTO artists (id, gallery_slug, name, bio, bioImageUrl, fullBio, live) VALUES (?,?,?,?,?,?,1)');
  artists.forEach(a => artistStmt.run(a.id, a.gallery_slug, a.name, a.bio, a.bioImageUrl, a.fullBio));
  artistStmt.finalize();

  const userStmt = db.prepare('INSERT INTO users (display_name, username, password, role, promo_code) VALUES (?,?,?,?,?)');
  const demoHash = bcrypt.hashSync('password', 10);
  userStmt.run('Demo User', 'demouser', demoHash, 'artist', 'taos');
  userStmt.finalize();

  const artworkStmt = db.prepare('INSERT INTO artworks (id, artist_id, gallery_slug, title, medium, dimensions, price, imageFull, imageStandard, imageThumb, status, hide_collected, featured, isVisible, isFeatured, description, framed, ready_to_hang) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

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
  const adjectives = ['Crimson', 'Luminous', 'Silent', 'Mystic', 'Azure', 'Golden', 'Ethereal', 'Verdant', 'Shadowed', 'Radiant'];
  const nouns = ['Reverie', 'Horizon', 'Echo', 'Forest', 'Dream', 'Symphony', 'Canvas', 'Whisper', 'Rhythm', 'Voyage'];
  const descriptions = [
    'An exploration of light and shadow.',
    'A vibrant study in color.',
    'Inspired by urban landscapes.',
    'An abstract representation of emotion.',
    'A minimalist piece evoking serenity.',
    'Textures from nature combined with bold hues.',
    'A digital collage capturing movement.',
    'A contemplative work examining space.'
  ];

  const customArtworks = {
    sierra: [
      { id: 'sierra-art1', title: 'Sunset Over Sage', medium: 'Oil', description: 'Glowing hues chase twilight across open plains.' },
      { id: 'sierra-art2', title: 'Ember Trail', medium: 'Oil', description: 'Footprints of fire fading into night.' }
    ],
    dusty: [
      { id: 'dusty-art1', title: 'Whistling Gulch', medium: 'Sculpture', description: 'Metal and wind shaped into canyon whispers.' },
      { id: 'dusty-art2', title: 'Rust and Stardust', medium: 'Mixed Media', description: 'Found relics fused with desert starlight.' }
    ],
    mesa: [
      { id: 'mesa-art1', title: 'Quiet Mesa Morning', medium: 'Watercolor', description: 'Soft washes catching first light over mesas.' },
      { id: 'mesa-art2', title: 'Cactus Serenade', medium: 'Watercolor', description: 'Prickly pear blooms singing in color.' }
    ],
    ridge: [
      { id: 'ridge-art1', title: 'Pixel Pony Express', medium: 'Digital', description: 'Neon riders racing across virtual plains.' },
      { id: 'ridge-art2', title: 'Lassoed Nebula', medium: 'Digital', description: 'Stars corralled into a cosmic rodeo.' }
    ]
  };

  function generateTitle(artist, index) {
    const a = adjectives[(index + artist.id.length) % adjectives.length];
    const n = nouns[(index * 3 + artist.id.length) % nouns.length];
    return `${a} ${n}`;
  }

  artists.forEach(artist => {
    const custom = customArtworks[artist.id];
    if (custom) {
      custom.forEach((art, i) => {
        const img = randomImage();
        const status = 'available';
        const isFeatured = i === 0 ? 1 : 0;
        artworkStmt.run(art.id, artist.id, artist.gallery_slug, art.title, art.medium, '24x36', randomPrice(), img, img, img, status, 0, 0, 1, isFeatured, art.description, 1, 0);
      });
    } else {
      for (let i = 0; i < 8; i++) {
        const img = randomImage();
        const artId = `${artist.id}-art${i + 1}`;
        const title = generateTitle(artist, i);
        const medium = mediums[i % mediums.length];
        const status = i === 0 ? 'collected' : 'available';
        const isFeatured = i === 0 ? 1 : 0;
        const description = descriptions[(i + artist.id.length) % descriptions.length];
        const framed = i % 2 === 0 ? 1 : 0;
        const ready = (i + 1) % 2 === 0 ? 1 : 0;
        artworkStmt.run(artId, artist.id, artist.gallery_slug, title, medium, '24x36', randomPrice(), img, img, img, status, 0, 0, 1, isFeatured, description, framed, ready);
      }
    }
  });

  artworkStmt.finalize(() => {
    if (done) done();
  });
}

// Run pending migrations at startup then initialize the database
migrate(() => initialize());

module.exports = { db, initialize, seed, migrate };
