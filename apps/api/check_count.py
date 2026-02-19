from sqlalchemy import create_engine, text
import os

engine = create_engine(os.environ['DATABASE_URL_SYNC'])
with engine.connect() as conn:
    result = conn.execute(text("SELECT COUNT(*), COUNT(DISTINCT region) FROM registered_shelters"))
    row = result.fetchone()
    print(f"Celkem útulků: {row[0]}")
    print(f"Počet krajů: {row[1]}")

    # Show some sample records
    result = conn.execute(text("SELECT name, region FROM registered_shelters LIMIT 5"))
    print("\nPrvních 5 útulků:")
    for row in result:
        print(f"  - {row[0]} ({row[1]})")
