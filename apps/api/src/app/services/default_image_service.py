import os
import uuid
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.app.core.config import settings
from src.app.models.file import File, DefaultAnimalImage
from src.app.models.breed import Breed
from src.app.models.animal import Species
from src.app.services.supabase_storage_service import supabase_storage_service


class DefaultImageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def parse_filename(self, filename: str) -> Dict[str, str]:
        """
        Parse filename like 'dog_labrador_black.png' to extract:
        - species: dog
        - breed: labrador
        - color: black
        - extension: png
        """
        # Remove extension
        name_without_ext = os.path.splitext(filename)[0]

        # Split by underscores
        parts = name_without_ext.split("_")

        result = {
            "species": parts[0] if len(parts) > 0 else None,
            "breed": None,
            "color": None,
            "filename_pattern": filename,
        }

        if len(parts) >= 2:
            result["breed"] = parts[1]
        if len(parts) >= 3:
            result["color"] = parts[2].replace(
                "&", "_"
            )  # Handle black&white -> black_white

        return result

    async def find_breed_id(self, breed_name: str, species: str) -> Optional[uuid.UUID]:
        """Find breed ID by name and species"""
        result = await self.db.execute(
            select(Breed).where(
                Breed.name.lower() == breed_name.lower(), Breed.species == species
            )
        )
        breed = result.scalar_one_or_none()
        return breed.id if breed else None

    async def get_default_image_for_animal(
        self,
        species: str,
        breed_id: Optional[uuid.UUID] = None,
        color: Optional[str] = None,
    ) -> Optional[DefaultAnimalImage]:
        """
        Find default image with hierarchical search:
        1. species + breed + color
        2. species + breed
        3. species + color
        4. species only
        """

        # 1. Try exact match: species + breed + color
        if breed_id and color:
            result = await self.db.execute(
                select(DefaultAnimalImage)
                .where(
                    DefaultAnimalImage.species == species,
                    DefaultAnimalImage.breed_id == breed_id,
                    DefaultAnimalImage.color_pattern == color,
                    DefaultAnimalImage.is_active == True,
                )
                .order_by(
                    DefaultAnimalImage.priority.desc(),
                    DefaultAnimalImage.created_at.desc(),
                )
                .limit(1)
            )
            image = result.scalar_one_or_none()
            if image:
                return image

        # 2. Try species + breed
        if breed_id:
            result = await self.db.execute(
                select(DefaultAnimalImage)
                .where(
                    DefaultAnimalImage.species == species,
                    DefaultAnimalImage.breed_id == breed_id,
                    DefaultAnimalImage.color_pattern.is_(None),
                    DefaultAnimalImage.is_active == True,
                )
                .order_by(
                    DefaultAnimalImage.priority.desc(),
                    DefaultAnimalImage.created_at.desc(),
                )
                .limit(1)
            )
            image = result.scalar_one_or_none()
            if image:
                return image

        # 3. Try species + color
        if color:
            result = await self.db.execute(
                select(DefaultAnimalImage)
                .where(
                    DefaultAnimalImage.species == species,
                    DefaultAnimalImage.breed_id.is_(None),
                    DefaultAnimalImage.color_pattern == color,
                    DefaultAnimalImage.is_active == True,
                )
                .order_by(
                    DefaultAnimalImage.priority.desc(),
                    DefaultAnimalImage.created_at.desc(),
                )
                .limit(1)
            )
            image = result.scalar_one_or_none()
            if image:
                return image

        # 4. Try species only (fallback)
        result = await self.db.execute(
            select(DefaultAnimalImage)
            .where(
                DefaultAnimalImage.species == species,
                DefaultAnimalImage.breed_id.is_(None),
                DefaultAnimalImage.color_pattern.is_(None),
                DefaultAnimalImage.is_active == True,
            )
            .order_by(
                DefaultAnimalImage.priority.desc(), DefaultAnimalImage.created_at.desc()
            )
            .limit(1)
        )
        image = result.scalar_one_or_none()
        return image

    async def import_images_from_directory(
        self, directory_path: str, bucket: str = None
    ) -> List[Dict]:
        """
        Import all images from directory, parse filenames, and create DefaultAnimalImage records
        """
        if bucket is None:
            bucket = supabase_storage_service.default_images_bucket

        imported_images = []
        directory = Path(directory_path)

        if not directory.exists():
            raise ValueError(f"Directory {directory_path} does not exist")

        # Process each image file
        for file_path in directory.glob("*.*"):
            if file_path.suffix.lower() not in [
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".webp",
            ]:
                continue

            try:
                # Parse filename to extract metadata
                parsed = self.parse_filename(file_path.name)

                # Find breed ID if specified
                breed_id = None
                if parsed["breed"]:
                    breed_id = await self.find_breed_id(
                        parsed["breed"], parsed["species"]
                    )

                # Upload to Supabase Storage
                with open(file_path, "rb") as f:
                    file_url, storage_path = await supabase_storage_service.upload_file(
                        file_content=f,
                        filename=file_path.name,
                        content_type=f"image/{file_path.suffix[1:]}",  # Remove the dot
                        organization_id="default",  # Special org for default images
                        bucket=bucket,
                        path_prefix="default-images",
                    )

                # Create DefaultAnimalImage record
                default_image = DefaultAnimalImage(
                    species=parsed["species"],
                    breed_id=breed_id,
                    color_pattern=parsed["color"],
                    storage_path=storage_path,
                    public_url=file_url,
                    filename_pattern=parsed["filename_pattern"],
                    is_active=True,
                    priority=10,  # Default priority
                    source="uploaded",
                )

                self.db.add(default_image)
                await self.db.flush()

                imported_images.append(
                    {
                        "filename": file_path.name,
                        "species": parsed["species"],
                        "breed": parsed["breed"],
                        "color": parsed["color"],
                        "breed_id": str(breed_id) if breed_id else None,
                        "file_url": file_url,
                        "storage_path": storage_path,
                    }
                )

                print(
                    f"✅ Imported: {file_path.name} -> {parsed['species']} / {parsed['breed']} / {parsed['color']}"
                )

            except Exception as e:
                print(f"❌ Failed to import {file_path.name}: {str(e)}")
                continue

        # Commit all changes
        await self.db.commit()

        return imported_images


async def assign_default_image_to_animal(
    self,
    organization_id: uuid.UUID,
    animal_id: uuid.UUID,
    species: str,
    breed_ids: List[uuid.UUID] = None,
    color: Optional[str] = None,
) -> Optional[str]:
    """
    Assign default image URL to animal and return the image URL
    """

    # Normalize color if it might be a breed name
    color, breed_ids = await self._normalize_breed_and_color(color, breed_ids, species)

    # Try each breed in order (primary breed first)
    for breed_id in breed_ids or [None]:
        default_image = await self.get_default_image_for_animal(
            species=species, breed_id=breed_id, color=color
        )

        if default_image:
            return default_image.public_url

    return None


async def _normalize_breed_and_color(
    self, color: Optional[str], breed_ids: List[uuid.UUID], species: str
) -> Tuple[Optional[str], List[uuid.UUID]]:
    """
    Handle case where user accidentally puts breed name in color field
    e.g., species: "dog", breed_ids: null, color: "labrador" -> should become breed_ids: [labrador_uuid], color: "black"
    """
    if not color or breed_ids:
        return color, breed_ids

    # Common breeds that users might accidentally put in color field
    breed_names_as_colors = {
        "labrador",
        "husky",
        "poodle",
        "german-shepherd",
        "chihuahua",
        "daschhund",
        "malamut",
        "pitbull",
        "golden",
        "retriever",
        "collie",
        "beagle",
    }

    color_lower = color.lower()
    if color_lower in breed_names_as_colors:
        # User likely put breed name in color field
        print(
            f"🔍 Detected possible breed/color swap: color='{color}' might be breed name"
        )

        # Try to find breed by name
        from src.app.models.breed import Breed
        from sqlalchemy import select

        result = await self.db.execute(
            select(Breed).where(Breed.name == color_lower, Breed.species == species)
        )
        breed = result.scalar_one_or_none()

        if breed:
            print(f"✅ Found breed: {breed.name} -> ID: {breed.id}")
            return "black", [
                breed.id
            ]  # Use default color black for mis-specified breed

    return color, breed_ids


async def create_placeholder_svg(self, species: str) -> str:
    """
    Create a simple SVG placeholder for when no image is found
    """
    svg_template = f"""
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#f0f0f0"/>
            <circle cx="100" cy="80" r="30" fill="#888"/>
            <rect x="70" y="110" width="60" height="40" fill="#888"/>
            <text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">
                {species.title()}
            </text>
        </svg>
        """

    # For now return a data URL - in future could upload to Supabase
    import base64

    svg_base64 = base64.b64encode(svg_template.encode()).decode()
    return f"data:image/svg+xml;base64,{svg_base64}"
