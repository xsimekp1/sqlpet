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

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from src.app.core.config import settings
from src.app.services.default_image_service import DefaultImageService
from src.app.db.session import get_async_session


async def main():
    """Main function to import images"""

    # Path to the images directory
    images_dir = Path(__file__).parent.parent.parent / "animals"

    if not images_dir.exists():
        print(f"❌ Images directory not found: {images_dir}")
        print(
            "Please place your images in the 'animals' directory with naming convention:"
        )
        print("  - dog_labrador_black.png")
        print("  - cat_persian_white.jpg")
        print("  - etc.")
        return

    print(f"📁 Importing images from: {images_dir}")
    print(
        f"🖼️  Found {len(list(images_dir.glob('*.png')) + list(images_dir.glob('*.jpg')))} image files"
    )

    # Create async session
    engine = create_async_engine(settings.DATABASE_URL_ASYNC)
    async with engine.begin() as conn:
        # Get session
        async with AsyncSession(conn) as db:
            service = DefaultImageService(db)

            try:
                # Import all images
                imported = await service.import_images_from_directory(str(images_dir))

                print(f"\n✅ Successfully imported {len(imported)} images:")
                for img in imported:
                    breed_info = f" ({img['breed']})" if img["breed"] else ""
                    color_info = f" / {img['color']}" if img["color"] else ""
                    print(
                        f"  🐕 {img['species']}{breed_info}{color_info} -> {img['filename']}"
                    )

                print(f"\n🎯 Hierarchical search will now work in this order:")
                print(f"  1. species + breed + color (most specific)")
                print(f"  2. species + breed")
                print(f"  3. species + color")
                print(f"  4. species only (fallback)")

            except Exception as e:
                print(f"❌ Error during import: {str(e)}")
                await db.rollback()
                raise

    print(
        "\n🚀 You can now create animals and they will automatically get assigned default images!"
    )


if __name__ == "__main__":
    asyncio.run(main())
