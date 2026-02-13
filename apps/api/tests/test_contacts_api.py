import uuid

import pytest
from sqlalchemy import delete, select

from src.app.models.contact import Contact
from src.app.models.organization import Organization
from src.app.models.user import User
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus
from src.app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.anyio


# ─── helpers ──────────────────────────────────────────────────────────────────

async def _make_org_with_permissions(db_session, test_user, perm_keys):
    """Create an org + role with the given permission keys for test_user."""
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    membership_id = uuid.uuid4()

    org = Organization(id=org_id, name="Contacts Test Org", slug=f"contacts-org-{org_id.hex[:8]}")
    db_session.add(org)
    await db_session.flush()

    role = Role(id=role_id, organization_id=org_id, name="contacts_role", is_template=False)
    db_session.add(role)
    await db_session.flush()

    for perm_key in perm_keys:
        perm_result = await db_session.execute(
            select(Permission).where(Permission.key == perm_key)
        )
        perm = perm_result.scalar_one_or_none()
        if perm:
            db_session.add(RolePermission(role_id=role_id, permission_id=perm.id, allowed=True))
    await db_session.flush()

    membership = Membership(
        id=membership_id,
        user_id=test_user.id,
        organization_id=org_id,
        role_id=role_id,
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(membership)
    await db_session.commit()

    return org, role, membership


async def _cleanup_org(db_session, org_id, role_id, membership_id):
    await db_session.execute(delete(Contact).where(Contact.organization_id == org_id))
    await db_session.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
    await db_session.execute(delete(Membership).where(Membership.id == membership_id))
    await db_session.execute(delete(Role).where(Role.id == role_id))
    await db_session.execute(delete(Organization).where(Organization.id == org_id))
    await db_session.commit()


# ─── fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
async def contacts_org(db_session, test_user):
    org, role, membership = await _make_org_with_permissions(
        db_session, test_user, ["people.read", "people.write"]
    )
    yield org, role, membership
    await _cleanup_org(db_session, org.id, role.id, membership.id)


@pytest.fixture()
async def contacts_read_only_org(db_session, test_user):
    org, role, membership = await _make_org_with_permissions(
        db_session, test_user, ["people.read"]
    )
    yield org, role, membership
    await _cleanup_org(db_session, org.id, role.id, membership.id)


# ─── CREATE ───────────────────────────────────────────────────────────────────

async def test_create_contact_basic(client, auth_headers, contacts_org):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.post(
        "/contacts",
        json={"name": "Jan Novák", "type": "donor"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["name"] == "Jan Novák"
    assert body["type"] == "donor"
    assert body["organization_id"] == str(org.id)
    assert body["is_active"] is True


async def test_create_contact_full_fields(client, auth_headers, contacts_org):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.post(
        "/contacts",
        json={
            "name": "MVDr. Petra Svobodová",
            "type": "veterinarian",
            "email": "petra@vet.cz",
            "phone": "+420 777 123 456",
            "profession": "Veterinarian",
            "organization_name": "Veterinární klinika Brno",
            "address": "Náměstí Svobody 1, 602 00 Brno",
            "bank_account": "CZ65 0800 0000 1920 0014 5399",
            "tax_id": "12345678",
            "notes": "Specializace na malá zvířata",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["name"] == "MVDr. Petra Svobodová"
    assert body["type"] == "veterinarian"
    assert body["email"] == "petra@vet.cz"
    assert body["profession"] == "Veterinarian"
    assert body["organization_name"] == "Veterinární klinika Brno"
    assert body["tax_id"] == "12345678"


async def test_create_contact_no_auth(client, contacts_org):
    org, _, _ = contacts_org
    resp = await client.post(
        "/contacts",
        json={"name": "Test", "type": "donor"},
        headers={"x-organization-id": str(org.id)},
    )
    assert resp.status_code == 401


async def test_create_contact_missing_name(client, auth_headers, contacts_org):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.post(
        "/contacts",
        json={"type": "donor"},
        headers=headers,
    )
    assert resp.status_code == 422


# ─── LIST ─────────────────────────────────────────────────────────────────────

async def test_list_contacts(client, auth_headers, contacts_org, db_session):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    # Create two contacts
    for name in ["Alice", "Bob"]:
        await client.post(
            "/contacts",
            json={"name": name, "type": "volunteer"},
            headers=headers,
        )

    resp = await client.get("/contacts", headers=headers)
    assert resp.status_code == 200, resp.json()
    body = resp.json()
    assert "items" in body
    assert body["total"] >= 2


async def test_list_contacts_filter_type(client, auth_headers, contacts_org):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    await client.post("/contacts", json={"name": "Donor1", "type": "donor"}, headers=headers)
    await client.post("/contacts", json={"name": "Vol1", "type": "volunteer"}, headers=headers)

    resp = await client.get("/contacts?type=donor", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert all(c["type"] == "donor" for c in body["items"])


# ─── GET BY ID ────────────────────────────────────────────────────────────────

async def test_get_contact_by_id(client, auth_headers, contacts_org):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    create_resp = await client.post(
        "/contacts",
        json={"name": "Detail Test", "type": "foster"},
        headers=headers,
    )
    contact_id = create_resp.json()["id"]

    resp = await client.get(f"/contacts/{contact_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == contact_id
    assert resp.json()["name"] == "Detail Test"


async def test_get_contact_not_found(client, auth_headers, contacts_org):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}
    resp = await client.get(f"/contacts/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


# ─── UPDATE ───────────────────────────────────────────────────────────────────

async def test_update_contact(client, auth_headers, contacts_org):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    create_resp = await client.post(
        "/contacts",
        json={"name": "Old Name", "type": "donor"},
        headers=headers,
    )
    contact_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/contacts/{contact_id}",
        json={"name": "New Name", "email": "new@email.cz"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "New Name"
    assert body["email"] == "new@email.cz"
    assert body["type"] == "donor"  # unchanged


# ─── DELETE ───────────────────────────────────────────────────────────────────

async def test_delete_contact(client, auth_headers, contacts_org):
    org, _, _ = contacts_org
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    create_resp = await client.post(
        "/contacts",
        json={"name": "To Delete", "type": "other"},
        headers=headers,
    )
    contact_id = create_resp.json()["id"]

    resp = await client.delete(f"/contacts/{contact_id}", headers=headers)
    assert resp.status_code == 204

    get_resp = await client.get(f"/contacts/{contact_id}", headers=headers)
    assert get_resp.status_code == 404


# ─── ORG ISOLATION ────────────────────────────────────────────────────────────

async def test_contacts_org_isolation(client, auth_headers, contacts_org, db_session, test_user):
    """Contact of org A must not be visible to org B."""
    org_a, _, _ = contacts_org
    headers_a = {**auth_headers, "x-organization-id": str(org_a.id)}

    create_resp = await client.post(
        "/contacts",
        json={"name": "Org A Contact", "type": "donor"},
        headers=headers_a,
    )
    contact_id = create_resp.json()["id"]

    # Create a second org with access
    org_b, role_b, membership_b = await _make_org_with_permissions(
        db_session, test_user, ["people.read", "people.write"]
    )
    headers_b = {**auth_headers, "x-organization-id": str(org_b.id)}

    resp = await client.get(f"/contacts/{contact_id}", headers=headers_b)
    assert resp.status_code == 404

    await _cleanup_org(db_session, org_b.id, role_b.id, membership_b.id)
