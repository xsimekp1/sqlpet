"""
Simple script to analyze animal images and show how they would be categorized.
This doesn't require database or Supabase - just analyzes the filenames.
"""

import os
from pathlib import Path


def parse_filename(filename: str) -> dict:
    """
    Parse filename like 'dog_labrador_black.png' to extract metadata.
    """
    # Remove extension
    name_without_ext = os.path.splitext(filename)[0]

    # Split by underscores
    parts = name_without_ext.split("_")

    result = {
        "species": parts[0] if len(parts) > 0 else None,
        "breed": None,
        "color": None,
        "filename": filename,
    }

    if len(parts) >= 2:
        result["breed"] = parts[1]
    if len(parts) >= 3:
        result["color"] = parts[2].replace(
            "&", "_"
        )  # Handle black&white -> black_white

    return result


def show_image_analysis():
    """Analyze all images in animals directory"""

    # Path to images
    images_dir = Path(__file__).parent.parent.parent.parent / "animals"

    if not images_dir.exists():
        print(f"ERROR: Images directory not found: {images_dir}")
        return

    print(f"Analyzing images in: {images_dir}")
    print("=" * 80)

    # Process each image
    images = (
        list(images_dir.glob("*.png"))
        + list(images_dir.glob("*.jpg"))
        + list(images_dir.glob("*.jpeg"))
    )

    if not images:
        print("No image files found!")
        return

    # Group analysis by species/breed/color
    grouped = {}

    for image_path in images:
        parsed = parse_filename(image_path.name)

        # Create grouping key
        key = f"{parsed['species']}_{parsed['breed']}_{parsed['color'] or 'unknown'}"
        if key not in grouped:
            grouped[key] = []

        grouped[key].append(
            {
                "filename": image_path.name,
                "size_mb": round(image_path.stat().st_size / 1024 / 1024, 2),
                "species": parsed["species"],
                "breed": parsed["breed"],
                "color": parsed["color"],
            }
        )

    # Show analysis results
    print(f"Found {len(images)} images with {len(grouped)} unique combinations:")
    print()

    for key, files in sorted(grouped.items()):
        file_info = files[0]  # Get first file for info
        color_info = f" / {file_info['color']}" if file_info["color"] else ""
        breed_info = f" ({file_info['breed']})" if file_info["breed"] else ""

        print(f"{file_info['species'].title()}{breed_info}{color_info}")
        for f in files:
            print(f"    - {f['filename']} ({f['size_mb']} MB)")
        print()

    print("Hierarchical search order for auto-assignment:")
    print("  1. species + breed + color (most specific)")
    print("  2. species + breed")
    print("  3. species + color")
    print("  4. species only (fallback)")
    print()

    # Show what we need in the database
    print("Required breeds in database:")
    breeds_needed = set()
    for files in grouped.values():
        if files[0]["breed"]:
            breeds_needed.add(f"{files[0]['species']}/{files[0]['breed']}")

    for breed in sorted(breeds_needed):
        print(f"  - {breed}")

    print()
    print("Colors found:")
    colors_found = set()
    for files in grouped.values():
        if files[0]["color"]:
            colors_found.add(files[0]["color"])

    for color in sorted(colors_found):
        print(f"  - {color}")

    print()
    print("Next steps:")
    print("  1. Run: python scripts/seed_breeds.py (to create breed records)")
    print("  2. Configure Supabase Storage in .env")
    print("  3. Run database migration")
    print("  4. Run: python scripts/import_default_images.py (to upload & catalog)")
    print("  5. Test animal creation with automatic image assignment!")


if __name__ == "__main__":
    show_image_analysis()
