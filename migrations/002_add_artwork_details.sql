-- Add new artwork detail columns
ALTER TABLE artworks ADD COLUMN description TEXT;
ALTER TABLE artworks ADD COLUMN framed INTEGER DEFAULT 0;
ALTER TABLE artworks ADD COLUMN ready_to_hang INTEGER DEFAULT 0;
