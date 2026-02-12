"""
Unit tests for DefaultImageService
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.services.default_image_service import DefaultImageService
from src.app.models.file import DefaultAnimalImage
from src.app.models.animal import Species


class TestDefaultImageService:
    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def service(self, mock_db):
        """Create DefaultImageService with mock DB"""
        return DefaultImageService(mock_db)

    def test_parse_filename_dog_labrador_black(self, service):
        """Test parsing of 'dog_labrador_black.png'"""
        filename = "dog_labrador_black.png"
        result = service.parse_filename(filename)

        assert result["species"] == "dog"
        assert result["breed"] == "labrador"
        assert result["color"] == "black"
        assert result["filename_pattern"] == filename

    def test_parse_filename_cat_persian_white(self, service):
        """Test parsing of 'cat_persian_white.jpg'"""
        filename = "cat_persian_white.jpg"
        result = service.parse_filename(filename)

        assert result["species"] == "cat"
        assert result["breed"] == "persian"
        assert result["color"] == "white"
        assert result["filename_pattern"] == filename

    def test_parse_filename_dog_only(self, service):
        """Test parsing of just 'dog.png'"""
        filename = "dog.png"
        result = service.parse_filename(filename)

        assert result["species"] == "dog"
        assert result["breed"] is None
        assert result["color"] is None
        assert result["filename_pattern"] == filename

    def test_parse_filename_with_ampersand(self, service):
        """Test parsing of 'dog_husky_black&white.png'"""
        filename = "dog_husky_black&white.png"
        result = service.parse_filename(filename)

        assert result["species"] == "dog"
        assert result["breed"] == "husky"
        assert result["color"] == "black_white"  # Ampersand replaced with underscore
        assert result["filename_pattern"] == filename

    @pytest.mark.asyncio
    async def test_assign_default_image_exact_match(self, service, mock_db):
        """Test exact match: species + breed + color"""
        breed_id = uuid.uuid4()
        animal_id = uuid.uuid4()
        org_id = uuid.uuid4()

        # Mock exact match found
        mock_image = DefaultAnimalImage(
            id=uuid.uuid4(),
            species="dog",
            breed_id=breed_id,
            color_pattern="black",
            public_url="https://example.com/dog_labrador_black.jpg",
            storage_path="dog_labrador_black.jpg",
            is_active=True,
        )

        # Setup mock return for exact match
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_image
        mock_db.execute.return_value = mock_result

        # Call the method
        result = await service.assign_default_image_to_animal(
            organization_id=org_id,
            animal_id=animal_id,
            species="dog",
            breed_ids=[breed_id],
            color="black",
        )

        assert result == "https://example.com/dog_labrador_black.jpg"

    @pytest.mark.asyncio
    async def test_assign_default_image_fallback_to_species_only(
        self, service, mock_db
    ):
        """Test fallback to species only when no other matches found"""
        breed_id = uuid.uuid4()
        animal_id = uuid.uuid4()
        org_id = uuid.uuid4()

        # Mock fallback image (species only)
        mock_image = DefaultAnimalImage(
            id=uuid.uuid4(),
            species="dog",
            breed_id=None,
            color_pattern=None,
            public_url="https://example.com/dog_default.jpg",
            storage_path="dog_default.jpg",
            is_active=True,
        )

        # Setup mock to return None for specific queries, then fallback
        mock_result = MagicMock()
        # First call returns None (exact match not found)
        # Second call returns None (species+breed not found)
        # Third call returns None (species+color not found)
        # Fourth call returns fallback (species only)
        mock_result.scalar_one_or_none.side_effect = [None, None, None, mock_image]
        mock_db.execute.return_value = mock_result

        # Call the method
        result = await service.assign_default_image_to_animal(
            organization_id=org_id,
            animal_id=animal_id,
            species="dog",
            breed_ids=[breed_id],
            color="unknown_color",
        )

        assert result == "https://example.com/dog_default.jpg"
        assert mock_db.execute.call_count == 4  # Called 4 times for hierarchical search

    @pytest.mark.asyncio
    async def test_assign_default_image_no_match(self, service, mock_db):
        """Test when no default image is found"""
        breed_id = uuid.uuid4()
        animal_id = uuid.uuid4()
        org_id = uuid.uuid4()

        # Setup mock to return None for all queries
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Call the method
        result = await service.assign_default_image_to_animal(
            organization_id=org_id,
            animal_id=animal_id,
            species="unknown_species",
            breed_ids=[],
            color=None,
        )

        assert result is None
        assert mock_db.execute.call_count == 4  # Called 4 times for hierarchical search

    @pytest.mark.asyncio
    async def test_create_placeholder_svg(self, service):
        """Test creation of SVG placeholder"""
        species = "dog"
        result = await service.create_placeholder_svg(species)

        assert result.startswith("data:image/svg+xml;base64,")
        # Check if species name is in the base64 encoded data
        assert "Dog" in result or "dog" in result

    def test_parse_filename_edge_cases(self, service):
        """Test edge cases for filename parsing"""

        # Empty filename
        result = service.parse_filename("")
        assert result["species"] is None
        assert result["breed"] is None
        assert result["color"] is None

        # Only species
        result = service.parse_filename("cat.png")
        assert result["species"] == "cat"
        assert result["breed"] is None
        assert result["color"] is None

        # Species and breed only
        result = service.parse_filename("dog_labrador.png")
        assert result["species"] == "dog"
        assert result["breed"] == "labrador"
        assert result["color"] is None

        # Multiple underscores in color
        result = service.parse_filename("dog_mutt_black_brown.png")
        assert result["species"] == "dog"
        assert result["breed"] == "mutt"
        assert result["color"] == "black_brown"
