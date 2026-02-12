# -*- coding: utf-8 -*-
"""
Script to import default animal images using local/CDN URLs (no Supabase Storage needed).
Images should be placed in apps/web/public/animals/ first.

Run this when SUPABASE_URL is not configured (development mode).
The script uses relative public paths (e.g., /animals/dog_labrador_black.png).

Usage:
    python scripts/import_default_images_local.py
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

# Add the api directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import asyncpg
from src.app.core.config import settings

# Hardcoded typo corrections in filenames
BREED_NAME_FIXES = {
    "daschhund": "dachshund",
    "malamut": "malamute",
}


def parse_filename(filename: str) -> dict:
    """Parse breed and color from filename like dog_labrador_black.png"""
    name = os.path.splitext(filename)[0]
    parts = name.split("_", 2)  # Split max 2 times: species, breed, color

    result = {"species": None, "breed": None, "color": None}
    if len(parts) >= 1:
        result["species"] = parts[0]
    if len(parts) >= 2:
        breed = parts[1]
        # Fix common filename typos
        result["breed"] = BREED_NAME_FIXES.get(breed, breed)
    if len(parts) >= 3:
        # Color: convert & to _ for consistency
        result["color"] = parts[2].replace("&", "_")

    return result


async def main():
    # Connect to Supabase DB
    db_url = settings.DATABASE_URL_ASYNC.replace("postgresql+asyncpg://", "postgresql://")

    # Frontend public base URL - images served from Next.js
    # The path /animals/filename.png works when images are in apps/web/public/animals/
    PUBLIC_BASE = "/animals"

    images_dir = Path(__file__).parent.parent.parent.parent / "animals"
    if not images_dir.exists():
        print(f"ERROR: Images directory not found: {images_dir}")
        return

    image_files = sorted(list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpg")))
    print(f"Found {len(image_files)} image files in {images_dir}")

    conn = await asyncpg.connect(db_url)
    try:
        # Clear existing records
        await conn.execute("DELETE FROM default_animal_images WHERE source = 'uploaded'")
        print("Cleared existing records")

        imported = 0
        skipped = 0

        for img_path in image_files:
            filename = img_path.name
            parsed = parse_filename(filename)

            if not parsed["species"] or not parsed["breed"] or not parsed["color"]:
                print(f"SKIP: Cannot parse '{filename}' (species={parsed['species']}, breed={parsed['breed']}, color={parsed['color']})")
                skipped += 1
                continue

            # Look up breed ID
            breed_id = await conn.fetchval(
                "SELECT id FROM breeds WHERE species = $1 AND name = $2",
                parsed["species"],
                parsed["breed"]
            )

            if not breed_id:
                print(f"SKIP: No breed found for species={parsed['species']}, name={parsed['breed']}")
                skipped += 1
                continue

            # Use relative URL path (frontend serves from /public/animals/)
            public_url = f"{PUBLIC_BASE}/{filename}"
            storage_path = f"default-images/{filename}"

            # Insert record
            record_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO default_animal_images (
                    id, species, breed_id, color_pattern,
                    storage_path, public_url, filename_pattern,
                    is_active, priority, source,
                    created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 10, 'uploaded', NOW(), NOW())
                ON CONFLICT DO NOTHING
                """,
                record_id,
                parsed["species"],
                breed_id,
                parsed["color"],
                storage_path,
                public_url,
                filename
            )

            print(f"IMPORTED: {filename} -> breed={parsed['breed']} color={parsed['color']} url={public_url}")
            imported += 1

        print()
        print(f"Summary: {imported} imported, {skipped} skipped")
        print("SUCCESS! Images are now linked to breeds in the database.")
        print("Make sure images are also in apps/web/public/animals/ for the frontend to serve them.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
