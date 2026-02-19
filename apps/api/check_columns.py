from sqlalchemy import create_engine, text
import os

engine = create_engine(os.environ['DATABASE_URL_SYNC'])
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'registered_shelters'
        ORDER BY ordinal_position
    """))
    columns = [row[0] for row in result]
    if columns:
        print("Columns in registered_shelters:")
        for col in columns:
            print(f"  - {col}")
    else:
        print("Table registered_shelters does not exist!")
