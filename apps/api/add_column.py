"""Add missing primary_photo_url column to animals table."""
from sqlalchemy import text
from src.app.db.session import sync_engine

def add_column():
    with sync_engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE animals ADD COLUMN IF NOT EXISTS primary_photo_url TEXT"
        ))
        conn.commit()
        print("Column primary_photo_url added successfully!")

if __name__ == "__main__":
    add_column()
