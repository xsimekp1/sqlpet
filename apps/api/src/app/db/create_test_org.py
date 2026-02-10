"""
Quick script to create a test organization and add user as admin.
"""
import asyncio
import uuid
from sqlalchemy import select

from src.app.db.session import AsyncSessionLocal
from src.app.models.organization import Organization
from src.app.models.user import User
from src.app.models.membership import Membership
from src.app.models.role import Role


async def create_test_org():
    async with AsyncSessionLocal() as db:
        # Find the user we just created
        result = await db.execute(
            select(User).where(User.email == "admin@example.com")
        )
        user = result.scalar_one_or_none()

        if not user:
            print("ERROR: User admin@example.com not found!")
            return

        print(f"✓ Found user: {user.email}")

        # Check if organization already exists
        result = await db.execute(
            select(Organization).where(Organization.name == "Test Shelter")
        )
        org = result.scalar_one_or_none()

        if org:
            print(f"✓ Organization '{org.name}' already exists")
        else:
            # Create organization
            org = Organization(
                id=uuid.uuid4(),
                name="Test Shelter",
                slug="test-shelter",
                email="info@test-shelter.cz",
                phone="+420123456789",
                address="Test Street 123, Prague",
                country="CZ",
                timezone="Europe/Prague",
                default_locale="cs",
                is_active=True,
            )
            db.add(org)
            await db.flush()
            print(f"✓ Created organization: {org.name}")

        # Find admin role template
        result = await db.execute(
            select(Role).where(
                Role.name == "admin",
                Role.is_template == True
            )
        )
        admin_role_template = result.scalar_one_or_none()

        if not admin_role_template:
            print("ERROR: Admin role template not found! Run seed_data.py first.")
            return

        # Create organization-specific admin role (copy from template)
        result = await db.execute(
            select(Role).where(
                Role.organization_id == org.id,
                Role.name == "admin"
            )
        )
        org_admin_role = result.scalar_one_or_none()

        if not org_admin_role:
            org_admin_role = Role(
                id=uuid.uuid4(),
                organization_id=org.id,
                name="admin",
                description="Administrator role for Test Shelter",
                is_template=False,
            )
            db.add(org_admin_role)
            await db.flush()

            # Copy permissions from template
            from src.app.models.role_permission import RolePermission
            result = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == admin_role_template.id
                )
            )
            template_perms = result.scalars().all()

            for tp in template_perms:
                db.add(RolePermission(
                    role_id=org_admin_role.id,
                    permission_id=tp.permission_id,
                    allowed=True
                ))

            print(f"✓ Created admin role for organization")

        # Check if membership already exists
        result = await db.execute(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.organization_id == org.id
            )
        )
        membership = result.scalar_one_or_none()

        if membership:
            print(f"✓ User is already member of {org.name}")
        else:
            # Create membership
            membership = Membership(
                id=uuid.uuid4(),
                user_id=user.id,
                organization_id=org.id,
                role_id=org_admin_role.id,
                status="active",
            )
            db.add(membership)
            print(f"✓ Added user to organization as admin")

        await db.commit()
        print("\n🎉 Done! User can now login and select organization.")
        print(f"   Organization: {org.name} ({org.id})")
        print(f"   User: {user.email}")
        print(f"   Role: {org_admin_role.name}")


if __name__ == "__main__":
    asyncio.run(create_test_org())
