const { db, seed } = require('./models/db');

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
