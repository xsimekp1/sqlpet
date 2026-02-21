"""Tests for birth registration endpoint"""
import pytest
from httpx import AsyncClient
from datetime import date, timedelta
from tests.conftest import make_org_headers


@pytest.mark.asyncio
async def test_register_birth_basic(
    client: AsyncClient,
    auth_headers: dict,
    pregnant_cat: tuple,
):
    """Test basic birth registration creates offspring"""
    cat, org = pregnant_cat
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{cat['id']}/birth",
        headers=headers,
        json={
            "litter_count": 3,
            "birth_date": str(date.today()),
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["created"] == 3
    assert len(data["offspring"]) == 3

    # Verify each offspring exists
    for offspring_data in data["offspring"]:
        offspring_response = await client.get(
            f"/animals/{offspring_data['id']}",
            headers=headers,
        )
        assert offspring_response.status_code == 200
        offspring = offspring_response.json()
        assert offspring["age_group"] == "baby"
        assert offspring["status"] == "intake"


@pytest.mark.asyncio
async def test_register_birth_with_collar_colors(
    client: AsyncClient,
    auth_headers: dict,
    pregnant_cat: tuple,
):
    """Test birth with collar color assignment"""
    cat, org = pregnant_cat
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{cat['id']}/birth",
        headers=headers,
        json={
            "litter_count": 3,
            "birth_date": str(date.today()),
            "collar_colors": ["red", "blue", None],  # 2 with collars, 1 without
        },
    )
    assert response.status_code == 201
    data = response.json()

    # Verify collar assignments
    offspring_ids = [o["id"] for o in data["offspring"]]

    o1 = await client.get(f"/animals/{offspring_ids[0]}", headers=headers)
    assert o1.json()["collar_color"] == "red"

    o2 = await client.get(f"/animals/{offspring_ids[1]}", headers=headers)
    assert o2.json()["collar_color"] == "blue"

    o3 = await client.get(f"/animals/{offspring_ids[2]}", headers=headers)
    assert o3.json()["collar_color"] is None


@pytest.mark.asyncio
async def test_register_birth_with_none_string(
    client: AsyncClient,
    auth_headers: dict,
    pregnant_cat: tuple,
):
    """Test birth with 'none' string is treated as null"""
    cat, org = pregnant_cat
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{cat['id']}/birth",
        headers=headers,
        json={
            "litter_count": 2,
            "collar_colors": ["red", "none"],  # 'none' should be treated as no collar
        },
    )
    assert response.status_code == 201
    data = response.json()

    offspring_ids = [o["id"] for o in data["offspring"]]

    o1 = await client.get(f"/animals/{offspring_ids[0]}", headers=headers)
    assert o1.json()["collar_color"] == "red"

    o2 = await client.get(f"/animals/{offspring_ids[1]}", headers=headers)
    assert o2.json()["collar_color"] is None


@pytest.mark.asyncio
async def test_register_birth_invalid_collar_count(
    client: AsyncClient,
    auth_headers: dict,
    pregnant_cat: tuple,
):
    """Test birth fails if collar_colors length doesn't match litter_count"""
    cat, org = pregnant_cat
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{cat['id']}/birth",
        headers=headers,
        json={
            "litter_count": 3,
            "collar_colors": ["red", "blue"],  # Only 2 colors for 3 offspring
        },
    )
    assert response.status_code == 422  # Validation error
    detail = response.json()["detail"]
    # Check if error message contains expected text (could be in different formats)
    assert any("collar_colors" in str(d).lower() for d in detail if isinstance(detail, list)) or "collar_colors" in str(detail).lower()


@pytest.mark.asyncio
async def test_register_birth_invalid_color(
    client: AsyncClient,
    auth_headers: dict,
    pregnant_cat: tuple,
):
    """Test birth fails with invalid collar color"""
    cat, org = pregnant_cat
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{cat['id']}/birth",
        headers=headers,
        json={
            "litter_count": 2,
            "collar_colors": ["red", "invalid_color"],
        },
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any("invalid" in str(d).lower() for d in detail if isinstance(detail, list)) or "invalid" in str(detail).lower()


@pytest.mark.asyncio
async def test_register_birth_clears_pregnancy(
    client: AsyncClient,
    auth_headers: dict,
    pregnant_cat: tuple,
):
    """Test birth clears is_pregnant and expected_litter_date"""
    cat, org = pregnant_cat
    headers = make_org_headers(auth_headers, org.id)

    # Verify cat is pregnant before
    mother_before = await client.get(
        f"/animals/{cat['id']}",
        headers=headers
    )
    assert mother_before.json()["is_pregnant"] is True

    # Register birth
    await client.post(
        f"/animals/{cat['id']}/birth",
        headers=headers,
        json={"litter_count": 2},
    )

    # Verify cat is no longer pregnant
    mother_after = await client.get(
        f"/animals/{cat['id']}",
        headers=headers
    )
    assert mother_after.json()["is_pregnant"] is False
    assert mother_after.json()["expected_litter_date"] is None
