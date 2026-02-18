"""Run migrations on production database."""

from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres.ieubksumlsvsdsvqbalh:Malinva2026+@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

engine = create_engine(DATABASE_URL)

# Add kennel_id to intakes
SQL1 = """
ALTER TABLE intakes ADD COLUMN IF NOT EXISTS kennel_id UUID REFERENCES kennels(id) ON DELETE SET NULL;
"""

# Add is_paid and status columns to intakes if needed - check first
SQL2 = """
ALTER TABLE intakes ALTER COLUMN animal_id DROP NOT NULL;
"""

# Create hotel_reservations table
SQL3 = """
CREATE TABLE IF NOT EXISTS hotel_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kennel_id UUID NOT NULL REFERENCES kennels(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    animal_name VARCHAR(255) NOT NULL,
    animal_species VARCHAR(50) NOT NULL,
    animal_breed VARCHAR(255),
    animal_notes TEXT,
    reserved_from DATE NOT NULL,
    reserved_to DATE NOT NULL,
    price_per_day NUMERIC(10,2),
    total_price NUMERIC(10,2),
    is_paid BOOLEAN DEFAULT FALSE,
    requires_single_cage BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_hotel_reservations_organization_id ON hotel_reservations(organization_id);
CREATE INDEX IF NOT EXISTS ix_hotel_reservations_kennel_id ON hotel_reservations(kennel_id);
CREATE INDEX IF NOT EXISTS ix_hotel_reservations_contact_id ON hotel_reservations(contact_id);
CREATE INDEX IF NOT EXISTS ix_hotel_reservations_reserved_from ON hotel_reservations(reserved_from);
CREATE INDEX IF NOT EXISTS ix_hotel_reservations_reserved_to ON hotel_reservations(reserved_to);
"""

# Create index on intakes.kennel_id
SQL4 = """
CREATE INDEX IF NOT EXISTS ix_intakes_kennel_id ON intakes(kennel_id);
"""

# Add maintenance date fields to kennels
SQL5 = """
ALTER TABLE kennels 
ADD COLUMN IF NOT EXISTS maintenance_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS maintenance_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS maintenance_reason VARCHAR(500);
"""

with engine.connect() as conn:
    print("Running: Adding kennel_id column to intakes...")
    try:
        conn.execute(text(SQL1))
        conn.commit()
        print("OK")
    except Exception as e:
        print(f"Error: {e}")

    print("Running: Making animal_id nullable in intakes...")
    try:
        conn.execute(text(SQL2))
        conn.commit()
        print("OK")
    except Exception as e:
        print(f"Error: {e}")

    print("Running: Creating hotel_reservations table...")
    try:
        conn.execute(text(SQL3))
        conn.commit()
        print("OK")
    except Exception as e:
        print(f"Error: {e}")

    print("Running: Creating index on intakes.kennel_id...")
    try:
        conn.execute(text(SQL4))
        conn.commit()
        print("OK")
    except Exception as e:
        print(f"Error: {e}")

    print("Running: Adding maintenance date fields to kennels...")
    try:
        conn.execute(text(SQL5))
        conn.commit()
        print("OK")
    except Exception as e:
        print(f"Error: {e}")

print("Done!")
