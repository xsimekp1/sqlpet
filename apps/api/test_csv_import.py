import csv
from datetime import datetime

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
    """Parse GPS from DMS format like: 49°8'42.980"N,15°0'6.507"E"""
    if not dms_str:
        return None, None
    try:
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

# Test CSV parsing
with open('../../utulky.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    errors = []
    success = 0

    for row_num, row in enumerate(reader, start=2):
        try:
            reg_number = row.get("registrační číslo", "").strip().strip('"')
            name = row.get("název", "").strip().strip('"')
            address = row.get("adresa", "").strip().strip('"')
            region = row.get("kraj", "").strip().strip('"')
            gps = row.get("GPS", "").strip().strip('"')
            reg_date = row.get("datum registrace", "").strip().strip('"')

            if not reg_number or not name:
                errors.append(f"Row {row_num}: Missing required fields")
                continue

            lat, lng = parse_dms_to_decimal(gps)
            parsed_date = parse_date(reg_date)

            success += 1
            if success <= 3:
                print(f"Row {row_num}: OK - {name} ({region})")
                print(f"  GPS: {gps} -> lat={lat}, lng={lng}")
                print(f"  Date: {reg_date} -> {parsed_date}")

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    print(f"\nSuccess: {success}")
    print(f"Errors: {len(errors)}")
    if errors:
        print("\nFirst 10 errors:")
        for err in errors[:10]:
            print(f"  - {err}")
