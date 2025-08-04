-- Add display_order column to artists
ALTER TABLE artists ADD COLUMN display_order INTEGER DEFAULT 0;
-- Initialize order based on rowid for existing records
UPDATE artists SET display_order = rowid;
