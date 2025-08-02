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
      bio TEXT,
      bioImageUrl TEXT,
      fullBio TEXT
    )`);
    db.run('ALTER TABLE artists ADD COLUMN bioImageUrl TEXT', () => {});
    db.run('ALTER TABLE artists ADD COLUMN fullBio TEXT', () => {});

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

    db.run(`CREATE TABLE IF NOT EXISTS artworks (
      id TEXT PRIMARY KEY,
      artist_id TEXT,
      title TEXT,
      medium TEXT,
      dimensions TEXT,
      price TEXT,
      imageFull TEXT,
      imageStandard TEXT,
      imageThumb TEXT,
      status TEXT,
      hide_collected INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0
    )`);
    db.run('ALTER TABLE artworks ADD COLUMN imageFull TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN imageStandard TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN imageThumb TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN status TEXT', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN hide_collected INTEGER DEFAULT 0', () => {});
    db.run('ALTER TABLE artworks ADD COLUMN featured INTEGER DEFAULT 0', () => {});

    db.get('SELECT COUNT(*) as count FROM galleries', (err, row) => {
      if (err) return;
      if (row.count === 0) seed();
    });
  });
}

function seed(done) {
  const galleryStmt = db.prepare('INSERT INTO galleries (slug, name, bio) VALUES (?,?,?)');
  galleryStmt.run('demo-gallery', 'Demo Gallery', 'Welcome to the demo gallery showcasing placeholder artwork.');
  galleryStmt.run('city-gallery', 'City Gallery', 'Featuring modern works from local artists.');
  galleryStmt.finalize();

  const artistStmt = db.prepare('INSERT INTO artists (id, gallery_slug, name, bio, bioImageUrl, fullBio) VALUES (?,?,?,?,?,?)');
  artistStmt.run('artist1', 'demo-gallery', 'Jane Doe', 'An abstract artist exploring color and form.',
    'https://picsum.photos/id/250/150/150',
    'Jane Doe investigates the emotional resonance of color and shape.\n\nHer canvases challenge viewers to find their own narratives within abstract forms.');
  artistStmt.run('artist2', 'demo-gallery', 'John Smith', 'Exploring the geometry of urban life.',
    'https://picsum.photos/id/251/150/150',
    'John Smith captures cityscapes through precise lines and bold structure.\n\nHis work reflects the tension between order and chaos in metropolitan spaces.');
  artistStmt.run('artist3', 'demo-gallery', 'Emily Carter', 'Mixed media artist inspired by nature.',
    'https://picsum.photos/id/252/150/150',
    'Emily Carter combines found objects and paint to evoke forest serenity.\n\nHer layered textures invite close inspection and contemplation.');
  artistStmt.run('artist4', 'demo-gallery', 'Liam Nguyen', 'Digital artist focusing on surreal landscapes.',
    'https://picsum.photos/id/253/150/150',
    'Liam Nguyen crafts dreamlike vistas with a digital brush.\n\nHe blends reality and imagination to transport viewers beyond the ordinary.');
  artistStmt.run('artist5', 'city-gallery', 'Sophia Martinez', 'Sculptor merging modern and classical motifs.',
    'https://picsum.photos/id/254/150/150',
    'Sophia Martinez merges historical influences with contemporary design.\n\nHer sculptures echo timeless narratives through modern materials.');
  artistStmt.run('artist6', 'city-gallery', 'Luca Green', 'Painter capturing urban life with bold colors.',
    'https://picsum.photos/id/255/150/150',
    'Luca Green paints bustling streets with vibrant energy.\n\nHis dynamic brushwork celebrates the rhythm of city living.');
  artistStmt.run('artist7', 'city-gallery', 'Ava Patel', 'Digital artist blending technology and emotion.',
    'https://picsum.photos/id/256/150/150',
    'Ava Patel explores human connection through digital mediums.\n\nHer creations blur the line between code and compassion.');
  artistStmt.finalize();

  const artworkStmt = db.prepare('INSERT INTO artworks (id, artist_id, title, medium, dimensions, price, imageFull, imageStandard, imageThumb, status, hide_collected, featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  function addArtwork(id, artist, title, medium, dimensions, price, imageUrl) {
    artworkStmt.run(id, artist, title, medium, dimensions, price, imageUrl, imageUrl, imageUrl, 'available', 0, 0);
  }
  addArtwork('art1', 'artist1', 'Dreamscape', 'Oil on Canvas', '30x40', '$4000', 'https://picsum.photos/id/205/420/630');
  addArtwork('art2', 'artist1', 'Ocean Depths', 'Acrylic', '24x36', '$2500', 'https://picsum.photos/id/207/380/560');
  addArtwork('c1', 'artist2', 'City Lights', 'Oil on Canvas', '24x30', '$3500', 'https://picsum.photos/id/208/360/540');
  addArtwork('art3', 'artist3', 'Forest Whisper', 'Watercolor', '18x24', '$1800', 'https://picsum.photos/id/209/340/520');
  addArtwork('art4', 'artist4', 'Dream Horizon', 'Digital', '1920x1080', '$1200', 'https://picsum.photos/id/206/400/600');

  addArtwork('sophia1', 'artist5', 'Stone Echo', 'Marble', '20x40', '$5000', 'https://picsum.photos/id/210/400/600');
  addArtwork('sophia2', 'artist5', 'Urban Rhythm', 'Bronze', '15x30', '$3200', 'https://picsum.photos/id/215/350/500');
  addArtwork('sophia3', 'artist5', 'Silent Form', 'Marble', '25x50', '$4800', 'https://picsum.photos/id/220/360/540');
  addArtwork('sophia4', 'artist5', 'Echoed Motion', 'Granite', '18x36', '$4100', 'https://picsum.photos/id/225/370/560');
  addArtwork('sophia5', 'artist5', 'Timeless Curve', 'Limestone', '22x44', '$4500', 'https://picsum.photos/id/230/380/580');

  addArtwork('luca1', 'artist6', 'City Pulse', 'Oil on Canvas', '28x40', '$3600', 'https://picsum.photos/id/235/320/480');
  addArtwork('luca2', 'artist6', 'Neon Nights', 'Oil on Canvas', '30x45', '$3900', 'https://picsum.photos/id/240/330/500');
  addArtwork('luca3', 'artist6', 'Market Rush', 'Acrylic', '24x36', '$3100', 'https://picsum.photos/id/245/340/520');
  addArtwork('luca4', 'artist6', 'Dawn Commute', 'Oil on Canvas', '26x38', '$3300', 'https://picsum.photos/id/250/350/530');
  addArtwork('luca5', 'artist6', 'Steel & Sky', 'Mixed Media', '32x48', '$4200', 'https://picsum.photos/id/260/360/540');

  addArtwork('ava1', 'artist7', 'Digital Bloom', 'Digital', '1920x1080', '$1500', 'https://picsum.photos/id/265/310/460');
  addArtwork('ava2', 'artist7', 'Neural Path', 'Digital', '1920x1200', '$1600', 'https://picsum.photos/id/270/320/480');
  addArtwork('ava3', 'artist7', 'Emote Wave', 'Digital', '2000x1300', '$1700', 'https://picsum.photos/id/275/330/500');
  addArtwork('ava4', 'artist7', 'Circuit Dream', 'Digital', '1800x1100', '$1550', 'https://picsum.photos/id/280/340/520');
  addArtwork('ava5', 'artist7', 'Binary Sunset', 'Digital', '2200x1400', '$1800', 'https://picsum.photos/id/285/350/540');

  artworkStmt.finalize(() => {
    if (done) done();
  });
}

module.exports = { db, initialize, seed };
