-- Add display_order column to artworks
ALTER TABLE artworks ADD COLUMN display_order INTEGER DEFAULT 0;
-- Initialize order within each artist based on existing rowid
UPDATE artworks SET display_order = (
  SELECT COUNT(*) - 1 FROM artworks AS a2
  WHERE a2.artist_id = artworks.artist_id AND a2.rowid <= artworks.rowid
);
