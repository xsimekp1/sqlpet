# -*- coding: utf-8 -*-
"""
Script to generate thumbnails for existing animal photos.
Run this once to create thumbnails for all existing photos.

Usage:
    cd apps/api
    python -m scripts.generate_thumbnails

Prerequisites:
    1. Supabase buckets exist (animal-photos, animal-thumbnails)
    2. Pillow installed: pip install Pillow
"""

import asyncio
import os
import sys
from io import BytesIO

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import select, text
from supabase import create_client

from src.app.core.config import settings

try:
    from PIL import Image

    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("WARNING: Pillow not installed. Thumbnails will not be generated.")
    print("Install with: pip install Pillow")


THUMBNAIL_SIZE = (300, 300)
THUMBNAIL_BUCKET = "animal-thumbnails"
PHOTOS_BUCKET = "animal-photos"


async def generate_thumbnail(image_content: bytes) -> bytes | None:
    """Generate 300x300 thumbnail from image content"""
    if not PIL_AVAILABLE:
        return None

    try:
        img = Image.open(BytesIO(image_content))
        img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

        output = BytesIO()
        img_format = img.format or "JPEG"
        if img.mode == "RGBA" and img_format == "JPEG":
            img = img.convert("RGB")
        img.save(output, format=img_format, quality=85)
        return output.getvalue()
    except Exception as e:
        print(f"  Error generating thumbnail: {e}")
        return None


def get_thumbnail_path(storage_path: str) -> str:
    """Convert storage path to thumbnail path"""
    parts = storage_path.split("/")
    if len(parts) >= 2:
        return f"{parts[0]}/thumbnails/{'/'.join(parts[1:])}"
    return f"thumbnails/{storage_path}"


async def main():
    """Main function to generate thumbnails"""
    if not PIL_AVAILABLE:
        print("ERROR: Pillow is required but not installed.")
        print("Install with: pip install Pillow")
        return

    print("=" * 60)
    print("Generating thumbnails for existing animal photos")
    print("=" * 60)

    # Initialize Supabase client
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    # Create async session
    engine = create_async_engine(settings.DATABASE_URL_ASYNC)

    async with engine.begin() as conn:
        async with AsyncSession(conn) as db:
            # Query all primary photos from entity_files
            query = (
                select(
                    text("ef.entity_id"),
                    text("f.storage_path"),
                    text("f.mime_type"),
                    text("a.primary_photo_url"),
                )
                .select_from(
                    text(
                        "entity_files ef JOIN files f ON ef.file_id = f.id JOIN animals a ON ef.entity_id = a.id"
                    )
                )
                .where(
                    text("ef.entity_type = 'animal'"),
                    text("ef.purpose = 'primary_photo'"),
                )
            )

            result = await db.execute(query)
            rows = result.fetchall()

            print(f"\nFound {len(rows)} primary photos to process")

            if len(rows) == 0:
                print("No photos found. Checking animals table directly...")

                # Fallback: check animals.primary_photo_url directly
                query2 = text("""
                    SELECT id, primary_photo_url 
                    FROM animals 
                    WHERE primary_photo_url IS NOT NULL 
                    AND primary_photo_url != ''
                """)
                result2 = await db.execute(query2)
                rows2 = result2.fetchall()
                print(f"Found {len(rows2)} animals with primary_photo_url")

                rows = []
                for row in rows2:
                    animal_id, photo_url = row
                    if photo_url and PHOTOS_BUCKET in photo_url:
                        # Extract storage path from URL
                        # URL format: https://xxx.supabase.co/storage/v1/object/public/animal-photos/{org_id}/{filename}
                        path_parts = photo_url.split(f"{PHOTOS_BUCKET}/")
                        if len(path_parts) > 1:
                            storage_path = path_parts[1]
                            rows.append(
                                (animal_id, storage_path, "image/jpeg", photo_url)
                            )

    if not rows:
        print("No photos to process.")
        return

    # Process each photo
    success_count = 0
    error_count = 0

    for row in rows:
        if len(row) == 4:
            animal_id, storage_path, mime_type, photo_url = row
        else:
            continue

        if not storage_path:
            continue

        try:
            # Download original image
            print(f"\nProcessing: {storage_path[:60]}...")

            response = supabase.storage.from_(PHOTOS_BUCKET).download(storage_path)

            if not response:
                print(f"  WARNING: Could not download file")
                error_count += 1
                continue

            # Generate thumbnail
            thumbnail_content = generate_thumbnail(response)

            if not thumbnail_content:
                print(f"  WARNING: Could not generate thumbnail")
                error_count += 1
                continue

            # Upload thumbnail
            thumbnail_path = get_thumbnail_path(storage_path)

            # Determine content type
            content_type = mime_type or "image/jpeg"

            result = supabase.storage.from_(THUMBNAIL_BUCKET).upload(
                path=thumbnail_path,
                file=thumbnail_content,
                file_options={"content-type": content_type, "x-upsert": "true"},
            )

            if hasattr(result, "error") and result.error:
                print(f"  ERROR uploading thumbnail: {result.error.message}")
                error_count += 1
            else:
                print(f"  ✓ Thumbnail uploaded: {thumbnail_path[:50]}...")
                success_count += 1

        except Exception as e:
            print(f"  ERROR: {str(e)[:100]}")
            error_count += 1

    print("\n" + "=" * 60)
    print(f"Summary: {success_count} thumbnails created, {error_count} errors")
    print("=" * 60)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
