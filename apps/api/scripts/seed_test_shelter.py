import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.db.session import AsyncSessionLocal
from src.app.models.organization import Organization
from src.app.models.user import User
from src.app.models.membership import Membership, MembershipStatus
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.core.security import hash_password


async def create_test_shelter_data(
    db: AsyncSession,
    admin_email: str = "admin@testshelter.cz",
    admin_password: str = "test123",
    admin_name: str = "Admin Test Shelter",
):
    # 1. Create or get organization "Test Shelter"
    result = await db.execute(
        select(Organization).where(Organization.slug == "test-shelter")
    )
    org = result.scalar_one_or_none()

    if org:
        print(f"Organization 'Test Shelter' already exists: {org.id}")
    else:
        org = Organization(
            id=uuid.uuid4(),
            name="Test Shelter",
            slug="test-shelter",
            timezone="Europe/Prague",
        )
        db.add(org)
        await db.flush()
        print(f"Created organization: {org.id}")

    # 2. Get admin role template
    result = await db.execute(
        select(Role).where(Role.name == "admin", Role.is_template.is_(True))
    )
    admin_template = result.scalar_one_or_none()
    if not admin_template:
        raise Exception("Admin role template not found. Run seed_data.py first.")

    # 3. Create or update organization-specific admin role (copy from template)
    result = await db.execute(
        select(Role).where(Role.name == "admin", Role.organization_id == org.id)
    )
    org_role = result.scalar_one_or_none()

    if org_role:
        print(
            f"Admin role for org already exists: {org_role.id}, updating permissions..."
        )
        # Delete existing permissions and copy from template
        await db.execute(
            RolePermission.__table__.delete().where(
                RolePermission.role_id == org_role.id
            )
        )
    else:
        org_role = Role(
            id=uuid.uuid4(),
            organization_id=org.id,
            name="admin",
            description="Admin role for Test Shelter",
            is_template=False,
        )
        db.add(org_role)
        await db.flush()

    # Copy permissions from template
    result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == admin_template.id)
    )
    template_perms = result.scalars().all()

    for tp in template_perms:
        rp = RolePermission(
            role_id=org_role.id,
            permission_id=tp.permission_id,
            allowed=tp.allowed,
        )
        db.add(rp)

    await db.flush()
    print(f"Updated admin role with {len(template_perms)} permissions")

    # 4. Create or get admin user
    result = await db.execute(select(User).where(User.email == admin_email))
    user = result.scalar_one_or_none()

    if user:
        print(f"User already exists: {user.id}")
    else:
        user = User(
            id=uuid.uuid4(),
            email=admin_email,
            password_hash=hash_password(admin_password),
            name=admin_name,
            is_superadmin=False,
        )
        db.add(user)
        await db.flush()
        print(f"Created user: {user.id}")

    # 5. Create membership
    result = await db.execute(
        select(Membership).where(
            Membership.user_id == user.id, Membership.organization_id == org.id
        )
    )
    membership = result.scalar_one_or_none()

    if membership:
        print(f"Membership already exists: {membership.id}")
    else:
        membership = Membership(
            id=uuid.uuid4(),
            user_id=user.id,
            organization_id=org.id,
            role_id=org_role.id,
            status=MembershipStatus.ACTIVE,
        )
        db.add(membership)
        await db.flush()
        print(f"Created membership")

    await db.commit()

    print("\n" + "=" * 50)
    print("DATA CREATED SUCCESSFULLY")
    print("=" * 50)
    print(f"Organization: Test Shelter (slug: test-shelter)")
    print(f"Login email: {admin_email}")
    print(f"Login password: {admin_password}")
    print(f"Role: admin (full permissions)")
    print("\nHow to login:")
    print("1. POST /auth/login with email/password")
    print("2. POST /auth/select-organization with organization_id")
    print(f"   Organization ID: {org.id}")
    print("=" * 50)

    return org.id


async def main():
    async with AsyncSessionLocal() as db:
        org_id = await create_test_shelter_data(db)
        print(f"\nOrganization ID for select-organization: {org_id}")


if __name__ == "__main__":
    asyncio.run(main())
