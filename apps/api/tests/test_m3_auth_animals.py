"""
M3: Test auth flow with select-organization + animals CRUD with JWT org_id
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.user import User
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus
from src.app.core.security import hash_password

pytestmark = pytest.mark.anyio


@pytest.fixture
async def test_user_with_org(db_session: AsyncSession):
    """Create user with organization and admin role"""
    # Create organization with unique slug
    org_uuid = uuid.uuid4()
    org = Organization(
        id=org_uuid,
        name="Test Shelter",
        slug=f"test-shelter-{str(org_uuid)[:8]}",  # Unique slug
        timezone="Europe/Prague",
    )
    db_session.add(org)
    await db_session.flush()  # Flush org before creating role/membership

    # Create user with unique email
    user_uuid = uuid.uuid4()
    user = User(
        id=user_uuid,
        email=f"test-{str(user_uuid)[:8]}@example.com",
        password_hash=hash_password("password123"),
        name="Test User",
    )
    db_session.add(user)
    await db_session.flush()  # Flush user before membership

    # Create admin role
    role = Role(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="admin",
        description="Administrator",
    )
    db_session.add(role)
    await db_session.flush()  # Flush role before permissions

    # Get existing permissions (from seed data)
    from sqlalchemy import select
    result = await db_session.execute(
        select(Permission).where(
            Permission.key.in_([
                "animals.read",
                "animals.create",
                "animals.update",
                "animals.delete",
            ])
        )
    )
    permissions = result.scalars().all()

    # If permissions don't exist, create them
    if not permissions:
        permissions = [
            Permission(id=uuid.uuid4(), key="animals.read", description="Read animals"),
            Permission(id=uuid.uuid4(), key="animals.create", description="Create animals"),
            Permission(id=uuid.uuid4(), key="animals.update", description="Update animals"),
            Permission(id=uuid.uuid4(), key="animals.delete", description="Delete animals"),
        ]
        for perm in permissions:
            db_session.add(perm)
        await db_session.flush()

    # Assign permissions to role
    for perm in permissions:
        db_session.add(
            RolePermission(
                role_id=role.id,
                permission_id=perm.id,
            )
        )

    # Create membership
    membership = Membership(
        id=uuid.uuid4(),
        user_id=user.id,
        organization_id=org.id,
        role_id=role.id,
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(membership)

    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(org)

    return user, org


async def test_login_and_select_organization(client: AsyncClient, test_user_with_org):
    """Test full auth flow: login → select org → get token with org_id"""
    user, org = test_user_with_org

    # Step 1: Login
    login_resp = await client.post(
        "/auth/login",
        json={"email": user.email, "password": "password123"},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    initial_token = login_data["access_token"]

    # Step 2: Get user profile (should have memberships)
    me_resp = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {initial_token}"},
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert len(me_data["memberships"]) == 1
    assert me_data["memberships"][0]["organization_name"] == "Test Shelter"

    # Step 3: Select organization
    select_resp = await client.post(
        "/auth/select-organization",
        params={"organization_id": str(org.id)},
        headers={"Authorization": f"Bearer {initial_token}"},
    )
    assert select_resp.status_code == 200
    select_data = select_resp.json()
    assert "access_token" in select_data
    org_token = select_data["access_token"]
    assert org_token != initial_token  # New token should be different

    return org_token


async def test_create_animal_with_org_token(client: AsyncClient, test_user_with_org):
    """Test creating animal with JWT token containing org_id"""
    user, org = test_user_with_org

    # Get token with org_id
    login_resp = await client.post(
        "/auth/login",
        json={"email": user.email, "password": "password123"},
    )
    initial_token = login_resp.json()["access_token"]

    select_resp = await client.post(
        "/auth/select-organization",
        params={"organization_id": str(org.id)},
        headers={"Authorization": f"Bearer {initial_token}"},
    )
    org_token = select_resp.json()["access_token"]

    # Create animal
    create_resp = await client.post(
        "/animals",  # Note: /animals not /orgs/{id}/animals
        json={
            "name": "Max",
            "species": "DOG",
            "sex": "MALE",
            "intake_date": "2024-01-15",
        },
        headers={"Authorization": f"Bearer {org_token}"},
    )
    assert create_resp.status_code == 201
    animal_data = create_resp.json()
    assert animal_data["name"] == "Max"
    assert animal_data["species"] == "DOG"
    assert animal_data["organization_id"] == str(org.id)

    return animal_data["id"]


async def test_list_animals_with_org_token(client: AsyncClient, test_user_with_org):
    """Test listing animals with JWT org_id"""
    user, org = test_user_with_org

    # Get org token
    login_resp = await client.post(
        "/auth/login",
        json={"email": user.email, "password": "password123"},
    )
    initial_token = login_resp.json()["access_token"]

    select_resp = await client.post(
        "/auth/select-organization",
        params={"organization_id": str(org.id)},
        headers={"Authorization": f"Bearer {initial_token}"},
    )
    org_token = select_resp.json()["access_token"]

    # Create test animal first
    await client.post(
        "/animals",
        json={
            "name": "Luna",
            "species": "CAT",
            "sex": "FEMALE",
            "intake_date": "2024-02-01",
        },
        headers={"Authorization": f"Bearer {org_token}"},
    )

    # List animals
    list_resp = await client.get(
        "/animals",
        headers={"Authorization": f"Bearer {org_token}"},
    )
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert "items" in list_data
    assert len(list_data["items"]) >= 1
    assert list_data["items"][0]["name"] == "Luna"


async def test_create_animal_without_org_token_fails(client: AsyncClient, test_user_with_org):
    """Test that creating animal without org_id in token fails"""
    user, org = test_user_with_org

    # Login but DON'T select organization
    login_resp = await client.post(
        "/auth/login",
        json={"email": user.email, "password": "password123"},
    )
    token_without_org = login_resp.json()["access_token"]

    # Try to create animal - should fail with 400
    create_resp = await client.post(
        "/animals",
        json={
            "name": "Max",
            "species": "DOG",
            "sex": "MALE",
            "intake_date": "2024-01-15",
        },
        headers={"Authorization": f"Bearer {token_without_org}"},
    )
    assert create_resp.status_code == 400
    assert "No organization selected" in create_resp.json()["detail"]


async def test_list_animals_without_auth_fails(client: AsyncClient):
    """Test that listing animals without auth fails"""
    list_resp = await client.get("/animals")
    assert list_resp.status_code == 401
    assert "Not authenticated" in list_resp.json()["detail"]
