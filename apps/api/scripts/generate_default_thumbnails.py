#!/usr/bin/env python3
"""
Generate thumbnails for existing default animal images (one-time backfill).

For each DefaultAnimalImage record where thumbnail_url IS NULL:
  1. Download the full-res image from public_url
  2. Generate a 300x300 thumbnail
  3. Upload the thumbnail to Supabase (bucket: default-animal-images, prefix: thumbnails)
  4. Update default_animal_images.thumbnail_url

Then batch-update animals.default_thumbnail_url from the updated records.

Safe to re-run: skips records where thumbnail_url IS NOT NULL.

Usage:
    cd apps/api
    python scripts/generate_default_thumbnails.py
    railway run python scripts/generate_default_thumbnails.py
"""

import os
import sys
import asyncio
import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

script_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.dirname(script_dir)
sys.path.insert(0, api_dir)
sys.path.insert(0, os.path.join(api_dir, "src"))

from src.app.core.config import settings
from src.app.services.supabase_storage_service import supabase_storage_service


async def main():
    print("=== Generate thumbnails for default animal images ===\n")

    database_url = settings.DATABASE_URL_ASYNC
    if not database_url:
        print("ERROR: DATABASE_URL_ASYNC not set")
        sys.exit(1)

    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Discovery
        result = await session.execute(
            text("SELECT COUNT(*) FROM default_animal_images WHERE thumbnail_url IS NULL")
        )
        count = result.scalar()
        print(f"Found {count} default images without thumbnail.")

        if count == 0:
            print("Nothing to do.")
            await engine.dispose()
            return

        # 2. Fetch all records without thumbnail
        result = await session.execute(
            text("""
                SELECT id::text, public_url, storage_path
                FROM default_animal_images
                WHERE thumbnail_url IS NULL
                ORDER BY created_at
            """)
        )
        rows = result.fetchall()

    generated = 0
    failed = 0

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        for row in rows:
            img_id, public_url, storage_path = row[0], row[1], row[2]
            filename = os.path.basename(storage_path) if storage_path else "image.jpg"

            # a. Download full-res image
            try:
                response = await http_client.get(public_url)
                if response.status_code != 200:
                    print(f"  WARNING: HTTP {response.status_code} for {public_url} — skipping")
                    failed += 1
                    continue
                file_content = response.content
            except Exception as e:
                print(f"  WARNING: Download failed for {public_url}: {e} — skipping")
                failed += 1
                continue

            # b. Generate thumbnail
            thumb_bytes = supabase_storage_service.generate_thumbnail(file_content)
            if not thumb_bytes:
                print(f"  WARNING: Could not generate thumbnail for {filename} (Pillow missing or error) — skipping")
                failed += 1
                continue

            # c. Upload thumbnail
            try:
                thumb_url, _ = await supabase_storage_service.upload_file(
                    file_content=thumb_bytes,
                    filename=filename,
                    content_type="image/jpeg",
                    organization_id="default",
                    bucket="default-animal-images",
                    path_prefix="thumbnails",
                )
            except Exception as e:
                print(f"  WARNING: Thumbnail upload failed for {filename}: {e} — skipping")
                failed += 1
                continue

            # d. Update DB record
            async with async_session() as session:
                await session.execute(
                    text("UPDATE default_animal_images SET thumbnail_url = :url WHERE id = :id"),
                    {"url": thumb_url, "id": img_id},
                )
                await session.commit()

            generated += 1
            print(f"  OK: {filename} -> {thumb_url}")

    # 3. Batch update animals.default_thumbnail_url
    print(f"\nUpdating animals.default_thumbnail_url...")
    async with async_session() as session:
        result = await session.execute(
            text("""
                UPDATE animals a
                SET default_thumbnail_url = dai.thumbnail_url
                FROM default_animal_images dai
                WHERE a.default_image_url = dai.public_url
                  AND dai.thumbnail_url IS NOT NULL
                  AND a.default_thumbnail_url IS NULL
            """)
        )
        await session.commit()
        animals_updated = result.rowcount

    print(f"\n=== Done ===")
    print(f"Generated: {generated} thumbnails")
    print(f"Failed/skipped: {failed}")
    print(f"Animals updated: {animals_updated}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
