"""Create findings table in production database."""

from sqlalchemy import create_engine, text

# Use Supabase URL directly - same as quick_setup.py
DATABASE_URL = "postgresql+asyncpg://postgres.ieubksumlsvsdsvqbalh:Malinva2026+@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

# Convert to sync for simpler execution
SYNC_URL = DATABASE_URL.replace("+asyncpg", "").replace(
    "postgresql+asyncpg", "postgresql"
)

# Fix URL format for Railway/Supabase
if "sslmode=require" not in SYNC_URL:
    SYNC_URL += "?sslmode=require"

print(f"Connecting to: {SYNC_URL.split('@')[1].split('/')[0]}")  # hide credentials

engine = create_engine(SYNC_URL)

SQL = """
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    who_found_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    where_lat FLOAT,
    where_lng FLOAT,
    when_found TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_findings_organization_id ON findings(organization_id);
CREATE INDEX IF NOT EXISTS ix_findings_who_found_id ON findings(who_found_id);
CREATE INDEX IF NOT EXISTS ix_findings_animal_id ON findings(animal_id);
"""

with engine.connect() as conn:
    conn.execute(text(SQL))
    conn.commit()

print("OK - Findings table created successfully!")
