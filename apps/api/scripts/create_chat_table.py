"""Create chat_messages table in production database."""
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres.ieubksumlsvsdsvqbalh:Malinva2026+@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

engine = create_engine(DATABASE_URL)

SQL = """
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_chat_messages_organization_id ON chat_messages(organization_id);
CREATE INDEX IF NOT EXISTS ix_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS ix_chat_messages_recipient_id ON chat_messages(recipient_id);
"""

with engine.connect() as conn:
    print("Creating chat_messages table...")
    try:
        conn.execute(text(SQL))
        conn.commit()
        print("OK - chat_messages table created!")
    except Exception as e:
        print(f"Error: {e}")

print("Done!")
