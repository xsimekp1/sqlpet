-- Fix enum values and skip duplicate migration
-- Update existing data from uppercase to lowercase

-- Step 1: Update existing kennel data to use lowercase values
UPDATE kennels SET size_category = 'small' WHERE size_category = 'SMALL';
UPDATE kennels SET size_category = 'medium' WHERE size_category = 'MEDIUM';  
UPDATE kennels SET size_category = 'large' WHERE size_category = 'LARGE';
UPDATE kennels SET size_category = 'xlarge' WHERE size_category = 'XLARGE';

-- Step 2: Drop and recreate enum types
DROP TYPE IF EXISTS kennel_size_category CASCADE;
DROP TYPE IF EXISTS kennel_type CASCADE;
DROP TYPE IF EXISTS kennel_status CASCADE;

CREATE TYPE kennel_size_category AS ENUM ('small', 'medium', 'large', 'xlarge');
CREATE TYPE kennel_type AS ENUM ('indoor', 'outdoor', 'isolation', 'quarantine');
CREATE TYPE kennel_status AS ENUM ('available', 'maintenance', 'closed');

-- Step 3: Update kennel type and status to lowercase
UPDATE kennels SET type = 'indoor' WHERE type = 'INDOOR';
UPDATE kennels SET type = 'outdoor' WHERE type = 'OUTDOOR';
UPDATE kennels SET type = 'isolation' WHERE type = 'ISOLATION';
UPDATE kennels SET type = 'quarantine' WHERE type = 'QUARANTINE';

UPDATE kennels SET status = 'available' WHERE status = 'AVAILABLE';
UPDATE kennels SET status = 'maintenance' WHERE status = 'MAINTENANCE';
UPDATE kennels SET status = 'closed' WHERE status = 'CLOSED';