-- Recreate core tables with foreign key constraints
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

CREATE TABLE artists_new (
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
  live INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gallery_slug) REFERENCES galleries(slug) ON DELETE CASCADE
);
INSERT INTO artists_new
  SELECT id, gallery_slug, name, bio, bioImageUrl, fullBio, bio_short, bio_full,
         portrait_url, gallery_id, archived, live, display_order, updated_at
  FROM artists;
DROP TABLE artists;
ALTER TABLE artists_new RENAME TO artists;

CREATE TABLE collections_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  artist_id TEXT,
  slug TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
INSERT INTO collections_new
  SELECT id, name, artist_id, slug, updated_at
  FROM collections;
DROP TABLE collections;
ALTER TABLE collections_new RENAME TO collections;

CREATE TABLE artworks_new (
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
  archived INTEGER DEFAULT 0,
  collection_id INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
  FOREIGN KEY (gallery_slug) REFERENCES galleries(slug) ON DELETE CASCADE
);
INSERT INTO artworks_new
  SELECT id, artist_id, gallery_slug, title, medium, custom_medium, dimensions, price,
         imageFull, imageStandard, imageThumb, status, hide_collected, featured,
         isVisible, isFeatured, description, framed, ready_to_hang, archived,
         collection_id, updated_at
  FROM artworks;
DROP TABLE artworks;
ALTER TABLE artworks_new RENAME TO artworks;

COMMIT;
PRAGMA foreign_keys=on;
