const { db, seed, migrate } = require('./models/db');

migrate(() => {
  db.serialize(() => {
    db.run('DELETE FROM galleries', () => {
      seed(() => {
        console.log('Database seeded');
        db.close();
      });
    });
  });
});
