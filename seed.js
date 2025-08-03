const { db, seed, migrate } = require('./models/db');

migrate(() => {
  db.serialize(() => {
    db.run('DELETE FROM galleries');
    db.run('DELETE FROM artists');
    db.run('DELETE FROM artworks', () => {
      seed(() => {
        console.log('Database seeded');
        db.close();
      });
    });
  });
});
