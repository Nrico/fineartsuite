-- Add archived columns to artists and artworks
ALTER TABLE artists ADD COLUMN archived INTEGER DEFAULT 0;
ALTER TABLE artworks ADD COLUMN archived INTEGER DEFAULT 0;
