-- Migration: add_organization_details_fields
-- Run this on Railway production database

ALTER TABLE organizations ADD COLUMN registration_number VARCHAR(20);
ALTER TABLE organizations ADD COLUMN address TEXT;
ALTER TABLE organizations ADD COLUMN lat FLOAT;
ALTER TABLE organizations ADD COLUMN lng FLOAT;
ALTER TABLE organizations ADD COLUMN capacity_dogs INTEGER;
ALTER TABLE organizations ADD COLUMN capacity_cats INTEGER;
ALTER TABLE organizations ADD COLUMN capacity_rabbits INTEGER;
ALTER TABLE organizations ADD COLUMN capacity_small INTEGER;
ALTER TABLE organizations ADD COLUMN capacity_birds INTEGER;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name IN ('registration_number', 'address', 'lat', 'lng', 'capacity_dogs', 'capacity_cats', 'capacity_rabbits', 'capacity_small', 'capacity_birds');
