# -*- coding: utf-8 -*-
"""
Script to import default animal images from the animals directory.
Run this to populate the default_animal_images table.

Usage:
    python scripts/import_default_images.py

Prerequisites:
    1. Supabase buckets created (animal-photos, default-animal-images)
    2. Database tables created via migration
    3. Supabase credentials configured in .env
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the api directory to Python path (so 'src.app...' imports work)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import text
from src.app.core.config import settings
# Import ALL models first to register SQLAlchemy relationships (avoids 'Tag' mapper error)
import src.app.models
from src.app.services.default_image_service import DefaultImageService


async def main():
    """Main function to import images"""

    # Path to the images directory (project root / animals)
    images_dir = Path(__file__).parent.parent.parent.parent / "animals"

    if not images_dir.exists():
        print(f"ERROR: Images directory not found: {images_dir}")
        print("Please place your images in the 'animals' directory with naming convention:")
        print("  - dog_labrador_black.png")
        print("  - cat_persian_white.jpg")
        return

    image_files = list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpg"))
    print(f"Importing images from: {images_dir}")
    print(f"Found {len(image_files)} image files")

    # Create async session
    engine = create_async_engine(settings.DATABASE_URL_ASYNC)
    async with engine.begin() as conn:
        async with AsyncSession(conn) as db:
            service = DefaultImageService(db)

            try:
                # Clear existing default images first (to allow re-import)
                print("Clearing existing default images...")
                await db.execute(text("DELETE FROM default_animal_images WHERE source = 'uploaded'"))
                await db.commit()
                print("Cleared existing default images\n")

                # Import all images
                imported = await service.import_images_from_directory(str(images_dir))

                print(f"\nSuccessfully imported {len(imported)} images:")
                for img in imported:
                    breed_info = f" ({img['breed']})" if img["breed"] else ""
                    color_info = f" / {img['color']}" if img["color"] else ""
                    print(f"  IMPORTED: {img['species']}{breed_info}{color_info} -> {img['filename']}")

                print("\nHierarchical search will now work in this order:")
                print("  1. species + breed + color (most specific)")
                print("  2. species + breed")
                print("  3. species + color")
                print("  4. species only (fallback)")

            except Exception as e:
                print(f"ERROR during import: {str(e)}")
                await db.rollback()
                raise

    print("\nSUCCESS: You can now create animals and they will automatically get assigned default images!")


if __name__ == "__main__":
    asyncio.run(main())
