-- Add archived columns to artists and artworks
ALTER TABLE artists ADD COLUMN IF NOT EXISTS archived INTEGER DEFAULT 0;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS archived INTEGER DEFAULT 0;
