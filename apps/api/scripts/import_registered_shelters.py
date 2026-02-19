import csv
import re
from datetime import datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def parse_dms_to_decimal(dms_str: str) -> tuple[float | None, float | None]:
    """Parse GPS from DMS format like: 49°8'42.980"N,15°0'6.507"E"""
    if not dms_str:
        return None, None

    try:
        # Split by comma
        parts = dms_str.split(",")
        if len(parts) != 2:
            return None, None

        lat_str = parts[0].strip()
        lng_str = parts[1].strip()

        lat = parse_single_dms(lat_str)
        lng = parse_single_dms(lng_str)

        return lat, lng
    except Exception as e:
        print(f"Error parsing GPS '{dms_str}': {e}")
        return None, None


def parse_single_dms(dms: str) -> float | None:
    """Parse single DMS coordinate like 49°8'42.980"N"""
    # Remove degree symbol and quotes
    dms = dms.replace("°", " ").replace("'", " ").replace('"', " ").strip()

    # Check for direction
    direction = None
    if "N" in dms or "S" in dms:
        direction = -1 if "S" in dms else 1
        dms = dms.replace("N", "").replace("S", "").strip()
    elif "E" in dms or "W" in dms:
        direction = -1 if "W" in dms else 1
        dms = dms.replace("E", "").replace("W", "").strip()

    # Split by whitespace
    parts = dms.split()
    if len(parts) < 3:
        return None

    try:
        degrees = float(parts[0])
        minutes = float(parts[1]) if len(parts) > 1 else 0
        seconds = float(parts[2]) if len(parts) > 2 else 0

        decimal = degrees + (minutes / 60) + (seconds / 3600)

        if direction:
            decimal *= direction

        return decimal
    except (ValueError, IndexError):
        return None


def parse_date(date_str: str) -> str | None:
    """Parse date from Czech format like 29.12.2017"""
    if not date_str:
        return None

    try:
        dt = datetime.strptime(date_str.strip(), "%d.%m.%Y")
        return dt.date().isoformat()
    except ValueError:
        return None


async def import_registered_shelters(db: AsyncSession):
    """Import registered shelters from CSV file."""
    csv_path = Path(__file__).parent.parent.parent.parent / "utulky.csv"

    if not csv_path.exists():
        print(f"CSV file not found: {csv_path}")
        return

    print(f"Importing from: {csv_path}")

    imported = 0
    updated = 0
    errors = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for idx, row in enumerate(reader, start=2):
            try:
                reg_number = row.get("registrační číslo", "").strip().strip('"')
                name = row.get("název", "").strip().strip('"')
                address = row.get("adresa", "").strip().strip('"')
                region = row.get("kraj", "").strip().strip('"')
                activity_type = row.get("druh činnosti", "").strip().strip('"')
                capacity = row.get("kapacita", "").strip().strip('"')
                gps = row.get("GPS", "").strip().strip('"')
                reg_date = row.get("datum registrace", "").strip().strip('"')

                if not all([reg_number, name, address, region]):
                    print(f"Row {idx}: Missing required fields")
                    errors += 1
                    continue

                # Parse GPS
                lat, lng = parse_dms_to_decimal(gps)

                # Parse date
                parsed_date = parse_date(reg_date)

                # UPSERT into database
                result = await db.execute(
                    text("""
                        INSERT INTO registered_shelters
                        (id, registration_number, name, address, region, activity_type, capacity, lat, lng, registration_date, imported_at, created_at, updated_at)
                        VALUES
                        (gen_random_uuid(), :reg_number, :name, :address, :region, :activity_type, :capacity, :lat, :lng, :reg_date, NOW(), NOW(), NOW())
                        ON CONFLICT (registration_number) DO UPDATE SET
                            name = EXCLUDED.name,
                            address = EXCLUDED.address,
                            region = EXCLUDED.region,
                            activity_type = EXCLUDED.activity_type,
                            capacity = EXCLUDED.capacity,
                            lat = EXCLUDED.lat,
                            lng = EXCLUDED.lng,
                            registration_date = EXCLUDED.registration_date,
                            updated_at = NOW()
                        RETURNING (xmax = 0) as inserted
                    """),
                    {
                        "reg_number": reg_number,
                        "name": name,
                        "address": address,
                        "region": region,
                        "activity_type": activity_type,
                        "capacity": capacity,
                        "lat": lat,
                        "lng": lng,
                        "reg_date": parsed_date,
                    },
                )
                was_inserted = result.scalar()
                if was_inserted:
                    imported += 1
                else:
                    updated += 1

                if (imported + updated) % 50 == 0:
                    print(f"Progress: {imported + updated} rows processed...")

            except Exception as e:
                print(f"Error importing row {idx}: {e}")
                errors += 1

    await db.commit()
    print("\n" + "="*60)
    print("Import complete!")
    print("="*60)
    print(f"  New records imported: {imported}")
    print(f"  Existing records updated: {updated}")
    print(f"  Total processed: {imported + updated}")
    print(f"  Errors: {errors}")


if __name__ == "__main__":
    import asyncio
    import sys

    # Add src to path for local development
    sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

    from app.db.session import AsyncSessionLocal
    from app.core.config import settings

    async def main():
        print(f"Connecting to database...")
        print(f"Using DATABASE_URL_ASYNC from settings")

        async with AsyncSessionLocal() as db:
            await import_registered_shelters(db)

    asyncio.run(main())
