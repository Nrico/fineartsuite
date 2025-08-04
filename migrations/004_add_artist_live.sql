-- Add live column to artists
ALTER TABLE artists ADD COLUMN live INTEGER DEFAULT 0;
