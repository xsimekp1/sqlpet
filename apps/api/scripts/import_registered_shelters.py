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
    csv_path = (
        Path(__file__).parent.parent.parent.parent
        / "Registrované útulky pro zvířata  –  Státní veterinární správaclose.csv"
    )

    if not csv_path.exists():
        print(f"CSV file not found: {csv_path}")
        return

    print(f"Importing from: {csv_path}")

    count = 0
    errors = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            try:
                reg_number = row.get("registrační číslo", "").strip().strip('"')
                name = row.get("název", "").strip().strip('"')
                address = row.get("adresa", "").strip().strip('"')
                region = row.get("kraj", "").strip().strip('"')
                activity_type = row.get("druh činnosti", "").strip().strip('"')
                capacity = row.get("kapacita", "").strip().strip('"')
                gps = row.get("GPS", "").strip().strip('"')
                reg_date = row.get("datum registrace", "").strip().strip('"')

                # Parse GPS
                lat, lng = parse_dms_to_decimal(gps)

                # Parse date
                parsed_date = parse_date(reg_date)

                # Insert into database
                await db.execute(
                    text("""
                        INSERT INTO registered_shelters 
                        (id, registration_number, name, address, region, activity_type, capacity, lat, lng, registration_date, imported_at, created_at, updated_at)
                        VALUES 
                        (gen_random_uuid(), :reg_number, :name, :address, :region, :activity_type, :capacity, :lat, :lng, :reg_date, NOW(), NOW(), NOW())
                        ON CONFLICT (registration_number) DO NOTHING
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
                count += 1

            except Exception as e:
                print(f"Error importing row: {e}")
                errors += 1

    await db.commit()
    print(f"Import complete: {count} records imported, {errors} errors")


if __name__ == "__main__":
    import asyncio
    from src.app.db.session import async_session_maker
    from src.app.core.config import settings

    async def main():
        async with async_session_maker() as db:
            await import_registered_shelters(db)

    asyncio.run(main())
