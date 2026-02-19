"""Direct CSV import script for Railway"""
import asyncio
import csv
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.app.db.session import AsyncSessionLocal

def parse_single_dms(dms: str) -> float | None:
    """Parse single DMS coordinate like 49°8'42.980"N"""
    try:
        dms = dms.replace("°", " ").replace("'", " ").replace('"', " ").strip()
        direction = None
        if "N" in dms or "S" in dms:
            direction = -1 if "S" in dms else 1
            dms = dms.replace("N", "").replace("S", "").strip()
        elif "E" in dms or "W" in dms:
            direction = -1 if "W" in dms else 1
            dms = dms.replace("E", "").replace("W", "").strip()
        parts = dms.split()
        if len(parts) < 3:
            return None
        degrees = float(parts[0])
        minutes = float(parts[1]) if len(parts) > 1 else 0
        seconds = float(parts[2]) if len(parts) > 2 else 0
        decimal = degrees + (minutes / 60) + (seconds / 3600)
        if direction:
            decimal *= direction
        return decimal
    except (ValueError, IndexError) as e:
        print(f"Error parsing DMS '{dms}': {e}")
        return None

def parse_dms_to_decimal(dms_str: str) -> tuple[float | None, float | None]:
    """Parse GPS from DMS format"""
    if not dms_str:
        return None, None
    try:
        parts = dms_str.split(",")
        if len(parts) != 2:
            return None, None
        lat = parse_single_dms(parts[0].strip())
        lng = parse_single_dms(parts[1].strip())
        return lat, lng
    except Exception as e:
        print(f"Error parsing GPS '{dms_str}': {e}")
        return None, None

def parse_date(date_str: str) -> str | None:
    """Parse date from Czech format like 29.12.2017"""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str.strip(), "%d.%m.%Y")
        return dt.date().isoformat()
    except ValueError as e:
        print(f"Error parsing date '{date_str}': {e}")
        return None

async def import_csv():
    # Try multiple possible paths for utulky.csv
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "../../utulky.csv"),
        os.path.join(os.path.dirname(__file__), "../../../utulky.csv"),
        "utulky.csv",
        "/app/utulky.csv"
    ]
    csv_path = None
    for path in possible_paths:
        if os.path.exists(path):
            csv_path = path
            print(f"Found CSV at: {path}")
            break

    if not csv_path:
        raise FileNotFoundError(f"Could not find utulky.csv in any of: {possible_paths}")

    count = 0
    errors = []

    async with AsyncSessionLocal() as db:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            for row_num, row in enumerate(reader, start=2):
                try:
                    reg_number = row.get("registrační číslo", "").strip().strip('"')
                    name = row.get("název", "").strip().strip('"')
                    address = row.get("adresa", "").strip().strip('"')
                    region = row.get("kraj", "").strip().strip('"')
                    activity_type = row.get("druh činnosti", "").strip().strip('"')
                    capacity = row.get("kapacita", "").strip().strip('"')
                    gps = row.get("GPS", "").strip().strip('"')
                    reg_date = row.get("datum registrace", "").strip().strip('"')

                    if not reg_number or not name:
                        errors.append(f"Row {row_num}: Missing required fields")
                        continue

                    lat, lng = parse_dms_to_decimal(gps)
                    parsed_date = parse_date(reg_date)

                    await db.execute(
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
                                imported_at = NOW(),
                                updated_at = NOW()
                        """),
                        {
                            "reg_number": reg_number,
                            "name": name,
                            "address": address,
                            "region": region,
                            "activity_type": activity_type or None,
                            "capacity": capacity or None,
                            "lat": lat,
                            "lng": lng,
                            "reg_date": parsed_date,
                        },
                    )
                    count += 1
                    if count % 50 == 0:
                        print(f"Imported {count} records...")

                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    print(f"Error on row {row_num}: {e}")

        await db.commit()
        print(f"\nImport complete!")
        print(f"Imported: {count}")
        print(f"Errors: {len(errors)}")
        if errors:
            print("\nFirst 10 errors:")
            for err in errors[:10]:
                print(f"  {err}")

if __name__ == "__main__":
    asyncio.run(import_csv())
