"""Tests for document template system and document generation endpoints"""
import pytest
from httpx import AsyncClient
from datetime import date
from tests.conftest import make_org_headers
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from src.app.models.animal import Animal
from src.app.models.document_template import DocumentTemplate, DocumentInstance


@pytest.fixture()
async def test_dog(db_session: AsyncSession, test_org_with_write_permission):
    """Create a test dog for document generation"""
    org, membership, role = test_org_with_write_permission

    dog = Animal(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Rex",
        species="dog",
        sex="male",
        status="available",
        age_group="adult",
        color="hnědý",
        weight_current_kg=25.5,
        description="Klidný a přátelský pes",
    )
    db_session.add(dog)
    await db_session.commit()

    # Return as dict for easy access in tests
    return {
        "id": str(dog.id),
        "name": dog.name,
        "species": dog.species,
        "sex": dog.sex,
        "color": dog.color,
        "weight_current_kg": dog.weight_current_kg,
    }, org


@pytest.fixture()
async def donation_contract_template(db_session: AsyncSession, test_org_with_write_permission):
    """Create the donation contract template for testing"""
    org, _, _ = test_org_with_write_permission

    template = DocumentTemplate(
        id=uuid.uuid4(),
        organization_id=org.id,
        code="donation_contract_dog",
        name="Darovací smlouva na psa",
        language="cs",
        content_html="""
<h1>DAROVACÍ SMLOUVA NA PSA</h1>
<p>Smluvní strany</p>
<p>Dárce: {{donor.full_name}}, {{donor.address}}</p>
<p>Obdarovaný: {{org.name}}, {{org.address}}</p>
<p>Místo: {{doc.place}}, Datum: {{doc.date}}</p>

<h2>Článek 1: Charakteristika psa</h2>
<p>Jméno: {{animal.name}}</p>
<p>Plemeno: {{animal.breed}}</p>
<p>Pohlaví: {{animal.sex}}</p>
<p>Stáří: {{animal.age}}</p>
<p>Barva: {{animal.color}}</p>
<p>Čip: {{animal.microchip}}</p>
<p>Váha: {{animal.weight_current_kg}} kg</p>

<h2>Článek 3: Zdravotní stav</h2>
<p>Zdravotní stav: {{manual.health_state}}</p>
<p>Povaha: {{manual.temperament}}</p>

<h2>Nález</h2>
<p>Datum nálezu: {{manual.found_date}}</p>
<p>Místo nálezu: {{manual.found_street}}, {{manual.found_city}}</p>

<h2>Předání</h2>
<p>Místo předání: {{manual.handover_place}}</p>
<p>Datum předání: {{manual.handover_date}}</p>
        """.strip(),
        is_active=True,
    )
    db_session.add(template)
    await db_session.commit()

    return template


@pytest.mark.asyncio
async def test_create_document_basic(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
):
    """Test basic document creation with minimal fields"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
                "health_state": "Dobrý zdravotní stav",
                "temperament": "Klidný a přátelský",
            },
            "status": "final",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["template_code"] == "donation_contract_dog"
    assert data["status"] == "final"
    assert data["animal_id"] == dog["id"]
    assert "rendered_html" in data
    assert "Praha" in data["rendered_html"]
    assert dog["name"] in data["rendered_html"]


@pytest.mark.asyncio
async def test_create_document_with_all_manual_fields(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
):
    """Test document creation with all manual fields populated"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    manual_fields = {
        "place": "Brno",
        "date": "2026-02-20",
        "time": "14:30",
        "health_state": "Dobrý zdravotní stav, očkován",
        "temperament": "Klidný, vhodný do rodiny s dětmi",
        "other_important": "Žádné speciální potřeby",
        "found_date": "2026-01-15",
        "found_street": "Hlavní 123",
        "found_city": "Brno",
        "found_time": "10:00",
        "found_registry": "Evidence města Brna",
        "handover_place": "Útulek Brno",
        "handover_date": "2026-02-20",
        "handover_time": "15:00",
    }

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": manual_fields,
            "status": "final",
        },
    )

    assert response.status_code == 201
    data = response.json()

    # Verify rendered HTML contains manual fields
    rendered = data["rendered_html"]
    assert "Brno" in rendered
    assert "Hlavní 123" in rendered
    assert "Klidný, vhodný do rodiny s dětmi" in rendered
    assert "2026-01-15" in rendered


@pytest.mark.asyncio
async def test_create_document_draft_status(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
):
    """Test creating a draft document (for preview)"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
                "health_state": "Dobrý",
                "temperament": "Klidný",
            },
            "status": "draft",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "draft"
    assert "rendered_html" in data


@pytest.mark.asyncio
async def test_create_document_invalid_template(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
):
    """Test document creation with non-existent template code"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "nonexistent_template",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
            },
            "status": "final",
        },
    )

    assert response.status_code == 404
    assert "template" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_document_invalid_animal(
    client: AsyncClient,
    auth_headers: dict,
    test_org_with_write_permission,
    donation_contract_template: DocumentTemplate,
):
    """Test document creation with non-existent animal ID"""
    org, _, _ = test_org_with_write_permission
    headers = make_org_headers(auth_headers, org.id)

    fake_animal_id = str(uuid.uuid4())

    response = await client.post(
        f"/animals/{fake_animal_id}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
            },
            "status": "final",
        },
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_animal_documents(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
    db_session: AsyncSession,
):
    """Test listing all documents for an animal"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    # Create two documents
    for i in range(2):
        await client.post(
            f"/animals/{dog['id']}/documents",
            headers=headers,
            json={
                "template_code": "donation_contract_dog",
                "manual_fields": {
                    "place": f"Praha {i+1}",
                    "date": str(date.today()),
                    "health_state": "Dobrý",
                    "temperament": "Klidný",
                },
                "status": "final",
            },
        )

    # List documents
    response = await client.get(
        f"/animals/{dog['id']}/documents",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(doc["animal_id"] == dog["id"] for doc in data)
    assert all(doc["template_code"] == "donation_contract_dog" for doc in data)


@pytest.mark.asyncio
async def test_get_document_by_id(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
):
    """Test retrieving a specific document by ID"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    # Create a document
    create_response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Ostrava",
                "date": str(date.today()),
                "health_state": "Výborný",
                "temperament": "Energický",
            },
            "status": "final",
        },
    )

    assert create_response.status_code == 201
    document_id = create_response.json()["id"]

    # Get the document
    response = await client.get(
        f"/documents/{document_id}",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == document_id
    assert data["animal_id"] == dog["id"]
    assert "Ostrava" in data["rendered_html"]
    assert "Energický" in data["rendered_html"]


@pytest.mark.asyncio
async def test_template_rendering_with_animal_data(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
):
    """Test that template correctly renders animal data placeholders"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
                "health_state": "Dobrý",
                "temperament": "Klidný",
            },
            "status": "draft",
        },
    )

    assert response.status_code == 201
    rendered = response.json()["rendered_html"]

    # Verify animal placeholders are replaced
    assert dog["name"] in rendered  # {{animal.name}}
    assert dog["color"] in rendered  # {{animal.color}}
    assert str(dog["weight_current_kg"]) in rendered  # {{animal.weight_current_kg}}
    assert "male" in rendered or "pes" in rendered  # {{animal.sex}}


@pytest.mark.asyncio
async def test_template_rendering_with_org_data(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
    db_session: AsyncSession,
):
    """Test that template correctly renders organization data placeholders"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    # Update org with more details
    from sqlalchemy import update
    from src.app.models.organization import Organization

    await db_session.execute(
        update(Organization)
        .where(Organization.id == org.id)
        .values(
            address_line1="Testovací 123",
            address_line2="Praha 1, 110 00",
            phone="+420123456789",
        )
    )
    await db_session.commit()

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
                "health_state": "Dobrý",
                "temperament": "Klidný",
            },
            "status": "draft",
        },
    )

    assert response.status_code == 201
    rendered = response.json()["rendered_html"]

    # Verify org placeholders are replaced
    assert org.name in rendered  # {{org.name}}
    assert "Testovací 123" in rendered  # {{org.address}}


@pytest.mark.asyncio
async def test_document_without_permission(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    test_org_with_membership,  # Different org without write permission
    donation_contract_template: DocumentTemplate,
):
    """Test that document creation requires proper permissions"""
    dog, org_with_dog = test_dog
    org_without_permission, _, _ = test_org_with_membership

    # Try to create document with wrong org header
    headers = make_org_headers(auth_headers, org_without_permission.id)

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
            },
            "status": "final",
        },
    )

    # Should get 404 (animal not found in this org) or 403 (no permission)
    assert response.status_code in [403, 404]


@pytest.mark.asyncio
async def test_empty_manual_fields_allowed(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
):
    """Test that manual_fields can be empty or minimal"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {},  # Empty manual fields
            "status": "draft",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert "rendered_html" in data
    # Template should render with empty placeholders or fallback values


@pytest.mark.asyncio
async def test_document_created_by_tracking(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    test_user,
    donation_contract_template: DocumentTemplate,
):
    """Test that document tracks which user created it"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
            },
            "status": "final",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["created_by_user_id"] == str(test_user.id)


@pytest.mark.asyncio
async def test_document_timestamps(
    client: AsyncClient,
    auth_headers: dict,
    test_dog: tuple,
    donation_contract_template: DocumentTemplate,
):
    """Test that document has proper created_at timestamp"""
    dog, org = test_dog
    headers = make_org_headers(auth_headers, org.id)

    response = await client.post(
        f"/animals/{dog['id']}/documents",
        headers=headers,
        json={
            "template_code": "donation_contract_dog",
            "manual_fields": {
                "place": "Praha",
                "date": str(date.today()),
            },
            "status": "final",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert "created_at" in data
    # Verify timestamp is in ISO format
    from datetime import datetime
    created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
    assert created_at.date() == date.today()
