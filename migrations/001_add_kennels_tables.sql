-- Add kennels, zones, kennel_stays, kennel_photos tables
-- Migration for kennels management system

-- Create PostgreSQL enums
DO $$
BEGIN
    -- Kennel size categories
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kennel_size_category') THEN
        CREATE TYPE kennel_size_category AS ENUM ('small', 'medium', 'large', 'xlarge');
    END IF;

    -- Kennel types
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kennel_type') THEN
        CREATE TYPE kennel_type AS ENUM ('indoor', 'outdoor', 'isolation', 'quarantine');
    END IF;

    -- Kennel operational status (not including "occupied" - that's calculated)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kennel_status') THEN
        CREATE TYPE kennel_status AS ENUM ('available', 'maintenance', 'closed');
    END IF;
END $$;

-- Create zones table
CREATE TABLE IF NOT EXISTS zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    code varchar(32) NOT NULL,
    color varchar(7) NULL, -- hex color like #FF5733
    description text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL
);

-- Create kennels table
CREATE TABLE IF NOT EXISTS kennels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    name text NOT NULL,
    code varchar(32) NOT NULL,
    capacity integer NOT NULL DEFAULT 1,
    capacity_rules jsonb NULL, -- Flexible capacity by species: {"by_species": {"CAT": 5, "DOG": 2}}
    size_category kennel_size_category NOT NULL DEFAULT 'medium',
    status kennel_status NOT NULL DEFAULT 'available',
    type kennel_type NOT NULL DEFAULT 'indoor',
    dimensions jsonb NULL, -- Physical dimensions: {"length": 200, "width": 150, "height": 180}
    notes text NULL,
    primary_photo_path text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL
);

-- Create kennel_stays table (audit trail + current occupancy)
CREATE TABLE IF NOT EXISTS kennel_stays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kennel_id uuid NOT NULL REFERENCES kennels(id) ON DELETE RESTRICT,
    animal_id uuid NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    start_at timestamptz NOT NULL DEFAULT now(),
    end_at timestamptz NULL, -- NULL means currently staying in kennel
    reason varchar(64) NULL, -- move/intake/cleaning/medical/quarantine
    notes text NULL,
    moved_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create kennel_photos table
CREATE TABLE IF NOT EXISTS kennel_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kennel_id uuid NOT NULL REFERENCES kennels(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_zones_org_deleted_created ON zones(organization_id, deleted_at, created_at);
CREATE INDEX IF NOT EXISTS idx_zones_code ON zones(code);

CREATE INDEX IF NOT EXISTS idx_kennels_org_deleted_created ON kennels(organization_id, deleted_at, created_at);
CREATE INDEX IF NOT EXISTS idx_kennels_zone_code ON kennels(zone_id, code);
CREATE INDEX IF NOT EXISTS idx_kennels_org_zone ON kennels(organization_id, zone_id);

CREATE INDEX IF NOT EXISTS idx_kennel_stays_org_active ON kennel_stays(organization_id, end_at);
CREATE INDEX IF NOT EXISTS idx_kennel_stays_kennel_active ON kennel_stays(kennel_id, end_at);
CREATE INDEX IF NOT EXISTS idx_kennel_stays_animal_active ON kennel_stays(animal_id, end_at);

CREATE INDEX IF NOT EXISTS idx_kennel_photos_org_kennel ON kennel_photos(organization_id, kennel_id);
CREATE INDEX IF NOT EXISTS idx_kennel_photos_primary ON kennel_photos(kennel_id, is_primary);

-- Add unique constraints
ALTER TABLE zones ADD CONSTRAINT uq_zones_org_code UNIQUE (organization_id, code) WHERE deleted_at IS NULL;
ALTER TABLE kennels ADD CONSTRAINT uq_kennels_zone_code UNIQUE (zone_id, code) WHERE deleted_at IS NULL;

-- Ensure only one primary photo per kennel
CREATE UNIQUE INDEX IF NOT EXISTS uq_kennel_primary_photo 
ON kennel_photos(kennel_id) 
WHERE is_primary = true AND deleted_at IS NULL;

-- One active stay per animal constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_stay_per_animal
ON kennel_stays(animal_id)
WHERE end_at IS NULL;

-- Basic sanity check for stay dates
ALTER TABLE kennel_stays
ADD CONSTRAINT kennel_stays_end_after_start
CHECK (end_at IS NULL OR end_at > start_at);

-- Create view for current occupancy (useful for queries)
CREATE OR REPLACE VIEW kennel_occupancy AS
SELECT 
    kennel_id,
    count(*)::int AS occupied_count,
    array_agg(animal_id) as animal_ids
FROM kennel_stays 
WHERE end_at IS NULL 
GROUP BY kennel_id;

-- Create view for kennel details with occupancy
CREATE OR REPLACE VIEW kennel_details AS
SELECT 
    k.*,
    z.name as zone_name,
    z.code as zone_code,
    z.color as zone_color,
    COALESCE(o.occupied_count, 0) as occupied_count,
    CASE 
        WHEN k.status = 'closed' THEN 'closed'
        WHEN k.status = 'maintenance' THEN 'maintenance' 
        WHEN COALESCE(o.occupied_count, 0) = 0 THEN 'empty'
        WHEN COALESCE(o.occupied_count, 0) < k.capacity THEN 'partially_full'
        WHEN COALESCE(o.occupied_count, 0) = k.capacity THEN 'full'
        ELSE 'over_capacity'
    END as occupancy_status
FROM kennels k
LEFT JOIN zones z ON k.zone_id = z.id
LEFT JOIN kennel_occupancy o ON k.id = o.kennel_id
WHERE k.deleted_at IS NULL;

-- Row Level Security (RLS) policies
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE kennels ENABLE ROW LEVEL SECURITY;
ALTER TABLE kennel_stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE kennel_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for zones
CREATE POLICY "Organizations can view their zones" ON zones
    FOR SELECT USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "Organizations can insert their zones" ON zones
    FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "Organizations can update their zones" ON zones
    FOR UPDATE USING (organization_id = current_setting('app.current_org_id')::uuid);

-- RLS policies for kennels
CREATE POLICY "Organizations can view their kennels" ON kennels
    FOR SELECT USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "Organizations can insert their kennels" ON kennels
    FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "Organizations can update their kennels" ON kennels
    FOR UPDATE USING (organization_id = current_setting('app.current_org_id')::uuid);

-- RLS policies for kennel_stays
CREATE POLICY "Organizations can view their kennel_stays" ON kennel_stays
    FOR SELECT USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "Organizations can insert their kennel_stays" ON kennel_stays
    FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "Organizations can update their kennel_stays" ON kennel_stays
    FOR UPDATE USING (organization_id = current_setting('app.current_org_id')::uuid);

-- RLS policies for kennel_photos
CREATE POLICY "Organizations can view their kennel_photos" ON kennel_photos
    FOR SELECT USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "Organizations can insert their kennel_photos" ON kennel_photos
    FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY "Organizations can update their kennel_photos" ON kennel_photos
    FOR UPDATE USING (organization_id = current_setting('app.current_org_id')::uuid);