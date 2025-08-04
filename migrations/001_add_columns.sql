-- Add columns to galleries
ALTER TABLE galleries ADD COLUMN contact_email TEXT;
ALTER TABLE galleries ADD COLUMN phone TEXT;
ALTER TABLE galleries ADD COLUMN address TEXT;
ALTER TABLE galleries ADD COLUMN gallarist_name TEXT;
ALTER TABLE galleries ADD COLUMN bio_short TEXT;
ALTER TABLE galleries ADD COLUMN bio_full TEXT;
ALTER TABLE galleries ADD COLUMN logo_url TEXT;

-- Add columns to artists
ALTER TABLE artists ADD COLUMN bioImageUrl TEXT;
ALTER TABLE artists ADD COLUMN fullBio TEXT;
ALTER TABLE artists ADD COLUMN bio_short TEXT;
ALTER TABLE artists ADD COLUMN bio_full TEXT;
ALTER TABLE artists ADD COLUMN portrait_url TEXT;
ALTER TABLE artists ADD COLUMN gallery_id TEXT;

-- Add columns to users
ALTER TABLE users ADD COLUMN role TEXT;
ALTER TABLE users ADD COLUMN promo_code TEXT;

-- Add columns to artworks
ALTER TABLE artworks ADD COLUMN imageFull TEXT;
ALTER TABLE artworks ADD COLUMN imageStandard TEXT;
ALTER TABLE artworks ADD COLUMN imageThumb TEXT;
ALTER TABLE artworks ADD COLUMN status TEXT;
ALTER TABLE artworks ADD COLUMN hide_collected INTEGER DEFAULT 0;
ALTER TABLE artworks ADD COLUMN featured INTEGER DEFAULT 0;
ALTER TABLE artworks ADD COLUMN isVisible INTEGER DEFAULT 1;
ALTER TABLE artworks ADD COLUMN isFeatured INTEGER DEFAULT 0;
ALTER TABLE artworks ADD COLUMN collection_id INTEGER;
ALTER TABLE artworks ADD COLUMN gallery_slug TEXT;
ALTER TABLE artworks ADD COLUMN custom_medium TEXT;
