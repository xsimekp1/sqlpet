-- Supabase SQL: Create kennels, zones, and stays tables with map layout
-- Run this in Supabase SQL Editor

-- Create enum types if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kennel_size_category') THEN
        CREATE TYPE kennel_size_category AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XLARGE');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kennel_type') THEN
        CREATE TYPE kennel_type AS ENUM ('INDOOR', 'OUTDOOR', 'ISOLATION', 'QUARANTINE');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kennel_status') THEN
        CREATE TYPE kennel_status AS ENUM ('AVAILABLE', 'MAINTENANCE', 'CLOSED');
    END IF;
END $$;

-- Create zones table if it doesn't exist
CREATE TABLE IF NOT EXISTS zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text(200) NOT NULL,
    code text(32) NOT NULL,
    color text(7) NULL, -- hex color like #FF5733
    description text NULL
);

-- Create indexes for zones
CREATE INDEX IF NOT EXISTS ix_zones_org_deleted_created ON zones(organization_id, deleted_at, created_at);
CREATE INDEX IF NOT EXISTS ix_zones_code ON zones(code);

-- Create kennels table if it doesn't exist
CREATE TABLE IF NOT EXISTS kennels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    name text(200) NOT NULL,
    code text(32) NOT NULL,
    
    -- Capacity and sizing
    capacity integer NOT NULL DEFAULT 1,
    capacity_rules jsonb NULL, -- Flexible capacity by species
    size_category kennel_size_category NOT NULL DEFAULT 'MEDIUM',
    
    -- Status and type
    status kennel_status NOT NULL DEFAULT 'AVAILABLE',
    type kennel_type NOT NULL DEFAULT 'INDOOR',
    
    -- Physical properties
    dimensions jsonb NULL, -- {"length": 200, "width": 150, "height": 180}
    notes text NULL,
    primary_photo_path text NULL,
    
    -- Map layout properties (REQUIRED for frontend)
    map_x integer NOT NULL DEFAULT 0,
    map_y integer NOT NULL DEFAULT 0,
    map_w integer NOT NULL DEFAULT 160,
    map_h integer NOT NULL DEFAULT 120,
    map_rotation integer NULL,
    map_meta jsonb NULL
);

-- Add missing map columns if table exists but doesn't have them
DO $$
BEGIN
    -- Check if kennels table exists and add missing columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kennels') THEN
        -- Add map columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kennels' AND column_name = 'map_x') THEN
            ALTER TABLE kennels ADD COLUMN map_x integer NOT NULL DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kennels' AND column_name = 'map_y') THEN
            ALTER TABLE kennels ADD COLUMN map_y integer NOT NULL DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kennels' AND column_name = 'map_w') THEN
            ALTER TABLE kennels ADD COLUMN map_w integer NOT NULL DEFAULT 160;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kennels' AND column_name = 'map_h') THEN
            ALTER TABLE kennels ADD COLUMN map_h integer NOT NULL DEFAULT 120;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kennels' AND column_name = 'map_rotation') THEN
            ALTER TABLE kennels ADD COLUMN map_rotation integer NULL;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kennels' AND column_name = 'map_meta') THEN
            ALTER TABLE kennels ADD COLUMN map_meta jsonb NULL;
        END IF;
    END IF;
END $$;

-- Create indexes for kennels
CREATE INDEX IF NOT EXISTS ix_kennels_org_deleted_created ON kennels(organization_id, deleted_at, created_at);
CREATE INDEX IF NOT EXISTS ix_kennels_zone_code ON kennels(zone_id, code);
CREATE INDEX IF NOT EXISTS ix_kennels_code ON kennels(code);

-- Create kennel_stays table if it doesn't exist
CREATE TABLE IF NOT EXISTS kennel_stays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kennel_id uuid NOT NULL REFERENCES kennels(id) ON DELETE RESTRICT,
    animal_id uuid NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    
    start_at timestamptz NOT NULL DEFAULT now(),
    end_at timestamptz NULL,
    
    reason text(64) NULL,
    notes text NULL,
    moved_by uuid NULL REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for kennel_stays
CREATE INDEX IF NOT EXISTS ix_kennel_stays_org_active ON kennel_stays(organization_id, end_at);
CREATE INDEX IF NOT EXISTS ix_kennel_stays_kennel_active ON kennel_stays(kennel_id, end_at);
CREATE INDEX IF NOT EXISTS ix_kennel_stays_animal_active ON kennel_stays(animal_id, end_at);

-- Enable RLS (Row Level Security)
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE kennels ENABLE ROW LEVEL SECURITY;
ALTER TABLE kennel_stays ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY zones_select ON zones
FOR SELECT USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY zones_insert ON zones
FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY zones_update ON zones
FOR UPDATE USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY kennels_select ON kennels
FOR SELECT USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY kennels_insert ON kennels
FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY kennels_update ON kennels
FOR UPDATE USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY kennel_stays_select ON kennel_stays
FOR SELECT USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY kennel_stays_insert ON kennel_stays
FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY kennel_stays_update ON kennel_stays
FOR UPDATE USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- Insert sample data (optional)
INSERT INTO zones (organization_id, name, code, color, description) VALUES
    ('252c4c09-e87f-4dfb-bfc6-7a269c64397e', 'Main Building', 'MAIN', '#FF5733', 'Primary shelter building'),
    ('252c4c09-e87f-4dfb-bfc6-7a269c64397e', 'Isolation Ward', 'ISO', '#FF0000', 'Sick animal isolation')
ON CONFLICT DO NOTHING;

INSERT INTO kennels (organization_id, zone_id, name, code, capacity, size_category, type, map_x, map_y, map_w, map_h) VALUES
    ('252c4c09-e87f-4dfb-bfc6-7a269c64397e', (SELECT id FROM zones WHERE code = 'MAIN' LIMIT 1), 'Kennel A1', 'A1', 2, 'MEDIUM', 'INDOOR', 0, 0, 160, 120),
    ('252c4c09-e87f-4dfb-bfc6-7a269c64397e', (SELECT id FROM zones WHERE code = 'MAIN' LIMIT 1), 'Kennel A2', 'A2', 1, 'SMALL', 'INDOOR', 170, 0, 160, 120),
    ('252c4c09-e87f-4dfb-bfc6-7a269c64397e', (SELECT id FROM zones WHERE code = 'ISO' LIMIT 1), 'Isolation 1', 'ISO1', 1, 'SMALL', 'ISOLATION', 0, 130, 160, 120)
ON CONFLICT DO NOTHING;