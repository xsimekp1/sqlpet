"""Create walk_logs table in production database."""
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres.ieubksumlsvsdsvqbalh:Malinva2026+@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

engine = create_engine(DATABASE_URL)

SQL = """
CREATE TABLE IF NOT EXISTS walk_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    animal_ids UUID[] DEFAULT '{}',
    walk_type VARCHAR(50) DEFAULT 'walk',
    status VARCHAR(50) DEFAULT 'in_progress',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    duration_minutes INTEGER,
    distance_km NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_walk_logs_organization_id ON walk_logs(organization_id);
CREATE INDEX IF NOT EXISTS ix_walk_logs_started_at ON walk_logs(started_at);
CREATE INDEX IF NOT EXISTS ix_walk_logs_status ON walk_logs(status);
"""

with engine.connect() as conn:
    print("Creating walk_logs table...")
    try:
        conn.execute(text(SQL))
        conn.commit()
        print("OK - walk_logs table created!")
    except Exception as e:
        print(f"Error: {e}")

print("Done!")
