"""
Get registered shelters without phone numbers from Supabase.
Run: python scripts/get_shelters_without_phones.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text

# Supabase connection
DATABASE_URL = "postgresql://postgres.ieubksumlsvsdsvqbalh:Malinva2026+@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(
        text("""
        SELECT id, name, address, region, website, phone
        FROM registered_shelters
        WHERE phone IS NULL OR phone = ''
        ORDER BY region, name
    """)
    )

    rows = result.fetchall()
    print(f"Found {len(rows)} shelters without phone numbers\n")

    for row in rows:
        print(f"ID: {row[0]}")
        print(f"Name: {row[1]}")
        print(f"Address: {row[2]}")
        print(f"Region: {row[3]}")
        print(f"Website: {row[4]}")
        print(f"Phone: {row[5]}")
        print("-" * 40)
