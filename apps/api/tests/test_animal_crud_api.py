import uuid

import pytest
from sqlalchemy import select, delete

from src.app.models.animal import Animal, Species, AnimalStatus
from src.app.models.animal_breed import AnimalBreed
from src.app.models.animal_identifier import AnimalIdentifier
from src.app.models.audit_log import AuditLog
from src.app.models.breed import Breed
from src.app.models.organization import Organization
from src.app.models.user import User
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus
from src.app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.anyio


# ---- CRUD: Create ----

async def test_create_animal_basic(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.post(
        "/animals",
        json={"name": "Rex", "species": "dog"},
        headers=headers,
    )
    if resp.status_code != 201:
        print(f"ERROR: {resp.status_code} - {resp.json()}")
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Rex"
    assert body["species"] == "dog"
    assert body["status"] == "intake"
    assert body["sex"] == "unknown"
    assert body["organization_id"] == str(org.id)


async def test_create_animal_full_fields(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.post(
        "/animals",
        json={
            "name": "Bella",
            "species": "cat",
            "sex": "female",
            "status": "available",
            "altered_status": "spayed",
            "birth_date_estimated": "2023-03-15",
            "age_group": "adult",
            "color": "tabby",
            "coat": "short",
            "size_estimated": "m",
            "weight_current_kg": 4.5,
            "weight_estimated_kg": 5.0,
            "description": "Friendly cat",
            "public_visibility": True,
            "featured": True,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Bella"
    assert body["species"] == "cat"
    assert body["sex"] == "female"
    assert body["altered_status"] == "spayed"
    assert body["age_group"] == "adult"
    assert body["color"] == "tabby"
    assert body["size_estimated"] == "m"
    assert body["public_visibility"] is True
    assert body["featured"] is True


async def test_create_animal_with_breeds(client, auth_headers, test_org_with_write_permission, db_session):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    # Get a breed from DB
    result = await db_session.execute(
        select(Breed).where(Breed.species == Species.DOG).limit(1)
    )
    breed = result.scalar_one_or_none()
    if breed is None:
        pytest.skip("No breeds seeded")

    resp = await client.post(
        "/animals",
        json={
            "name": "Buddy",
            "species": "dog",
            "breeds": [{"breed_id": str(breed.id), "percent": 100}],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["breeds"]) == 1
    assert body["breeds"][0]["breed_id"] == str(breed.id)
    assert body["breeds"][0]["percent"] == 100


async def test_create_animal_with_identifiers(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.post(
        "/animals",
        json={
            "name": "Chip",
            "species": "dog",
            "identifiers": [
                {"type": "microchip", "value": "123456789012345", "registry": "CZ National"},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["identifiers"]) == 1
    assert body["identifiers"][0]["type"] == "microchip"
    assert body["identifiers"][0]["value"] == "123456789012345"
    assert body["identifiers"][0]["registry"] == "CZ National"


async def test_create_animal_generates_public_code(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.post(
        "/animals",
        json={"name": "CodeTest", "species": "dog"},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    code = body["public_code"]
    assert code is not None
    # Format: A-YYYY-NNNNNN
    parts = code.split("-")
    assert parts[0] == "A"
    assert len(parts[1]) == 4  # year
    assert len(parts[2]) == 6  # zero-padded seq


async def test_create_animal_unauthorized(client):
    resp = await client.post(
        "/animals",
        json={"name": "Test", "species": "dog"},
    )
    assert resp.status_code == 401


async def test_create_animal_forbidden(client, auth_headers, test_org_with_membership):
    """Read-only user cannot create animals."""
    org, _, _ = test_org_with_membership
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.post(
        "/animals",
        json={"name": "Test", "species": "dog"},
        headers=headers,
    )
    assert resp.status_code == 403


# ---- List + Filters ----

async def test_list_animals_empty(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.get("/animals", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["items"] == []


async def test_list_animals_with_data(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    # Create 3 animals
    for name in ("A1", "A2", "A3"):
        await client.post(
            "/animals",
            json={"name": name, "species": "dog"},
            headers=headers,
        )
    resp = await client.get("/animals", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 3


async def test_list_animals_filter_species(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    await client.post("/animals", json={"name": "Dog1", "species": "dog"}, headers=headers)
    await client.post("/animals", json={"name": "Cat1", "species": "cat"}, headers=headers)

    resp = await client.get("/animals?species=cat", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["species"] == "cat"


async def test_list_animals_filter_status(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    await client.post(
        "/animals",
        json={"name": "Avail1", "species": "dog", "status": "available"},
        headers=headers,
    )
    await client.post(
        "/animals",
        json={"name": "Intake1", "species": "dog", "status": "intake"},
        headers=headers,
    )

    resp = await client.get("/animals?status=available", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Avail1"


async def test_list_animals_search(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    await client.post("/animals", json={"name": "Maxík", "species": "dog"}, headers=headers)
    await client.post("/animals", json={"name": "Bella", "species": "cat"}, headers=headers)

    resp = await client.get("/animals?search=max", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Maxík"


async def test_list_animals_pagination(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    for i in range(5):
        await client.post(
            "/animals",
            json={"name": f"Page{i}", "species": "dog"},
            headers=headers,
        )

    resp = await client.get("/animals?page=1&page_size=2", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["page"] == 1
    assert body["page_size"] == 2


async def test_list_animals_multi_tenant_isolation(client, db_session):
    """Animals from org1 are not visible to org2 user."""
    # Create two users + two orgs
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()
    org1_id = uuid.uuid4()
    org2_id = uuid.uuid4()

    from src.app.models.user import User as UserModel

    user1 = UserModel(id=user1_id, email=f"u1-{user1_id.hex[:8]}@test.com", password_hash=hash_password("Pass1234"), name="User1")
    user2 = UserModel(id=user2_id, email=f"u2-{user2_id.hex[:8]}@test.com", password_hash=hash_password("Pass1234"), name="User2")
    db_session.add_all([user1, user2])
    await db_session.flush()

    org1 = Organization(id=org1_id, name="Org1", slug=f"org1-{org1_id.hex[:8]}")
    org2 = Organization(id=org2_id, name="Org2", slug=f"org2-{org2_id.hex[:8]}")
    db_session.add_all([org1, org2])
    await db_session.flush()

    # Create roles with animals.read + animals.write
    role1_id = uuid.uuid4()
    role2_id = uuid.uuid4()
    role1 = Role(id=role1_id, organization_id=org1_id, name="r1", is_template=False)
    role2 = Role(id=role2_id, organization_id=org2_id, name="r2", is_template=False)
    db_session.add_all([role1, role2])
    await db_session.flush()

    for perm_key in ("animals.read", "animals.write"):
        perm_result = await db_session.execute(select(Permission).where(Permission.key == perm_key))
        perm = perm_result.scalar_one_or_none()
        if perm:
            db_session.add(RolePermission(role_id=role1_id, permission_id=perm.id, allowed=True))
            db_session.add(RolePermission(role_id=role2_id, permission_id=perm.id, allowed=True))
    await db_session.flush()

    m1_id = uuid.uuid4()
    m2_id = uuid.uuid4()
    db_session.add(Membership(id=m1_id, user_id=user1_id, organization_id=org1_id, role_id=role1_id, status=MembershipStatus.ACTIVE))
    db_session.add(Membership(id=m2_id, user_id=user2_id, organization_id=org2_id, role_id=role2_id, status=MembershipStatus.ACTIVE))
    await db_session.commit()

    headers1 = {"Authorization": f"Bearer {create_access_token({'sub': str(user1_id)})}", "x-organization-id": str(org1_id)}
    headers2 = {"Authorization": f"Bearer {create_access_token({'sub': str(user2_id)})}", "x-organization-id": str(org2_id)}

    # User1 creates animal in org1
    resp = await client.post(
        "/animals",
        json={"name": "Org1Dog", "species": "dog"},
        headers=headers1,
    )
    assert resp.status_code == 201

    # User2 should see 0 animals in org2
    resp = await client.get("/animals", headers=headers2)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    # User2 cannot access org1 animals (no membership)
    headers2_with_org1 = {"Authorization": f"Bearer {create_access_token({'sub': str(user2_id)})}", "x-organization-id": str(org1_id)}
    resp = await client.get("/animals", headers=headers2_with_org1)
    assert resp.status_code == 403

    # Cleanup
    await db_session.execute(delete(AnimalIdentifier).where(AnimalIdentifier.organization_id.in_([org1_id, org2_id])))
    await db_session.execute(delete(AnimalBreed).where(
        AnimalBreed.animal_id.in_(select(Animal.id).where(Animal.organization_id.in_([org1_id, org2_id])))
    ))
    await db_session.execute(delete(Animal).where(Animal.organization_id.in_([org1_id, org2_id])))
    await db_session.execute(delete(AuditLog).where(AuditLog.organization_id.in_([org1_id, org2_id])))
    await db_session.execute(delete(RolePermission).where(RolePermission.role_id.in_([role1_id, role2_id])))
    await db_session.execute(delete(Membership).where(Membership.id.in_([m1_id, m2_id])))
    await db_session.execute(delete(Role).where(Role.id.in_([role1_id, role2_id])))
    await db_session.execute(delete(Organization).where(Organization.id.in_([org1_id, org2_id])))
    await db_session.execute(delete(User).where(User.id.in_([user1_id, user2_id])))
    await db_session.commit()


# ---- Get / Update / Delete ----

async def test_get_animal(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    create_resp = await client.post(
        "/animals",
        json={"name": "GetMe", "species": "cat"},
        headers=headers,
    )
    animal_id = create_resp.json()["id"]

    resp = await client.get(f"/animals/{animal_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "GetMe"


async def test_get_animal_not_found(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    fake_id = uuid.uuid4()
    resp = await client.get(f"/animals/{fake_id}", headers=headers)
    assert resp.status_code == 404


async def test_update_animal(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    create_resp = await client.post(
        "/animals",
        json={"name": "OldName", "species": "dog"},
        headers=headers,
    )
    animal_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/animals/{animal_id}",
        json={"name": "NewName"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "NewName"


async def test_update_animal_partial(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    create_resp = await client.post(
        "/animals",
        json={"name": "Partial", "species": "dog", "color": "brown"},
        headers=headers,
    )
    animal_id = create_resp.json()["id"]

    # Update only description — color should remain unchanged
    resp = await client.patch(
        f"/animals/{animal_id}",
        json={"description": "Good boy"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["description"] == "Good boy"
    assert body["color"] == "brown"
    assert body["name"] == "Partial"


async def test_delete_animal(client, auth_headers, test_org_with_write_permission):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    create_resp = await client.post(
        "/animals",
        json={"name": "ToDelete", "species": "dog"},
        headers=headers,
    )
    animal_id = create_resp.json()["id"]

    resp = await client.delete(f"/animals/{animal_id}", headers=headers)
    assert resp.status_code == 204

    # GET should now return 404
    resp = await client.get(f"/animals/{animal_id}", headers=headers)
    assert resp.status_code == 404


async def test_delete_animal_soft(client, auth_headers, test_org_with_write_permission, db_session):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    create_resp = await client.post(
        "/animals",
        json={"name": "SoftDel", "species": "cat"},
        headers=headers,
    )
    animal_id = create_resp.json()["id"]

    await client.delete(f"/animals/{animal_id}", headers=headers)

    # Verify in DB: deleted_at is set, record still exists
    result = await db_session.execute(
        select(Animal).where(Animal.id == uuid.UUID(animal_id))
    )
    animal = result.scalar_one_or_none()
    assert animal is not None
    assert animal.deleted_at is not None


# ---- Audit log ----

async def test_create_animal_audit_log(client, auth_headers, test_org_with_write_permission, db_session):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    create_resp = await client.post(
        "/animals",
        json={"name": "AuditTest", "species": "dog"},
        headers=headers,
    )
    assert create_resp.status_code == 201
    animal_id = create_resp.json()["id"]

    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "animal",
            AuditLog.entity_id == uuid.UUID(animal_id),
            AuditLog.action == "create",
        )
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.after is not None
    assert audit.after["name"] == "AuditTest"


async def test_update_animal_audit_log(client, auth_headers, test_org_with_write_permission, db_session):
    org, _, _ = test_org_with_write_permission
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    create_resp = await client.post(
        "/animals",
        json={"name": "AuditBefore", "species": "dog"},
        headers=headers,
    )
    animal_id = create_resp.json()["id"]

    await client.patch(
        f"/animals/{animal_id}",
        json={"name": "AuditAfter"},
        headers=headers,
    )

    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "animal",
            AuditLog.entity_id == uuid.UUID(animal_id),
            AuditLog.action == "update",
        )
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.before["name"] == "AuditBefore"
    assert audit.after["name"] == "AuditAfter"


# ---- Breeds ----

async def test_list_breeds(client, auth_headers):
    resp = await client.get("/breeds", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) > 0
    assert "id" in body[0]
    assert "species" in body[0]
    assert "name" in body[0]


async def test_list_breeds_filter_species(client, auth_headers):
    resp = await client.get("/breeds?species=cat", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) > 0
    for breed in body:
        assert breed["species"] == "cat"
