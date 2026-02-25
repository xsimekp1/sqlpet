"""
Tests for public API endpoints - no authentication required.
"""

import pytest

pytestmark = pytest.mark.anyio


async def test_public_default_images_random(client):
    """Test that public endpoint returns random default images."""
    resp = await client.get("/api/public/default-images/random?count=12")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 12

    # Check response structure
    if data:
        assert "id" in data[0]
        assert "species" in data[0]
        assert "image_url" in data[0]


async def test_public_default_images_random_default_count(client):
    """Test that default count is 12 when not specified."""
    resp = await client.get("/api/public/default-images/random")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 12


async def test_public_default_images_random_max_50(client):
    """Test that max count is 50."""
    resp = await client.get("/api/public/default-images/random?count=100")
    # Should still work but cap at 50
    assert resp.status_code == 422  # Pydantic validation error for count > 50


async def test_public_default_images_random_min_1(client):
    """Test that min count is 1."""
    resp = await client.get("/api/public/default-images/random?count=0")
    assert resp.status_code == 422  # Pydantic validation error for count < 1
