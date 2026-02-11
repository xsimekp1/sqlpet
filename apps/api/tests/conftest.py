import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.db.session import AsyncSessionLocal, async_engine
from src.app.core.security import hash_password, create_access_token
from src.app.models.user import User
from src.app.models.organization import Organization
from src.app.models.animal import Animal
from src.app.models.animal_breed import AnimalBreed
from src.app.models.animal_identifier import AnimalIdentifier
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus
from src.app.main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture()
async def db_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="session", autouse=True)
async def dispose_engine():
    yield
    await async_engine.dispose()


@pytest.fixture()
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture()
async def test_user(db_session: AsyncSession):
    uid = uuid.uuid4()
    user = User(
        id=uid,
        email=f"test-{uid.hex[:8]}@example.com",
        password_hash=hash_password("TestPass123"),
        name="Test User",
        is_superadmin=False,
    )
    db_session.add(user)
    await db_session.commit()
    yield user
    await db_session.execute(delete(User).where(User.id == uid))
    await db_session.commit()


@pytest.fixture()
async def auth_headers(test_user: User) -> dict[str, str]:
    token = create_access_token({"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


def make_org_headers(auth_headers: dict[str, str], org_id: uuid.UUID) -> dict[str, str]:
    """Helper to add x-organization-id to auth headers"""
    return {**auth_headers, "x-organization-id": str(org_id)}


@pytest.fixture()
async def test_org_with_membership(db_session: AsyncSession, test_user: User):
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    membership_id = uuid.uuid4()

    org = Organization(id=org_id, name="Test Org", slug=f"test-org-{org_id.hex[:8]}")
    db_session.add(org)
    await db_session.flush()

    role = Role(id=role_id, organization_id=org_id, name="test_role", is_template=False)
    db_session.add(role)
    await db_session.flush()

    # Add animals.read permission to the role
    perm_result = await db_session.execute(
        select(Permission).where(Permission.key == "animals.read")
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

    yield org, membership, role

    # Cleanup
    await db_session.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
    await db_session.execute(delete(Membership).where(Membership.id == membership_id))
    await db_session.execute(delete(Role).where(Role.id == role_id))
    await db_session.execute(delete(Organization).where(Organization.id == org_id))
    await db_session.commit()


@pytest.fixture()
async def test_org_with_write_permission(db_session: AsyncSession, test_user: User):
    """Org + membership with animals.read + animals.write permissions."""
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    membership_id = uuid.uuid4()

    org = Organization(id=org_id, name="Write Test Org", slug=f"write-org-{org_id.hex[:8]}")
    db_session.add(org)
    await db_session.flush()

    role = Role(id=role_id, organization_id=org_id, name="test_writer_role", is_template=False)
    db_session.add(role)
    await db_session.flush()

    # Add animals.read and animals.write permissions
    for perm_key in ("animals.read", "animals.write"):
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

    yield org, membership, role

    # Cleanup — delete animals and related data first
    # Get all animal ids for this org
    animal_result = await db_session.execute(
        select(Animal.id).where(Animal.organization_id == org_id)
    )
    animal_ids = [row[0] for row in animal_result.all()]
    if animal_ids:
        await db_session.execute(delete(AnimalIdentifier).where(AnimalIdentifier.animal_id.in_(animal_ids)))
        await db_session.execute(delete(AnimalBreed).where(AnimalBreed.animal_id.in_(animal_ids)))
        await db_session.execute(delete(Animal).where(Animal.organization_id == org_id))

    await db_session.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
    await db_session.execute(delete(Membership).where(Membership.id == membership_id))
    await db_session.execute(delete(Role).where(Role.id == role_id))
    await db_session.execute(delete(Organization).where(Organization.id == org_id))
    await db_session.commit()
