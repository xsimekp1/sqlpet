"""
Script to clean up test organizations created by tests.
Run with: railway run python scripts/cleanup_test_orgs.py
"""
import asyncio
from sqlalchemy import select, delete

from src.app.db.session import AsyncSessionLocal
from src.app.models.organization import Organization
from src.app.models.membership import Membership
from src.app.models.role import Role
from src.app.models.role_permission import RolePermission


async def cleanup_test_orgs():
    """Delete all test organizations and their related data."""
    async with AsyncSessionLocal() as db:
        # Find test organizations by name pattern
        result = await db.execute(
            select(Organization).where(
                Organization.name.in_([
                    "Findings Test Org",
                    "Test Shelter",
                    "Test Organization",
                ])
                | Organization.name.like("Test %")
                | Organization.slug.like("findings-org-%")
                | Organization.slug.like("test-%")
            )
        )
        test_orgs = result.scalars().all()

        if not test_orgs:
            print("No test organizations found.")
            return

        print(f"Found {len(test_orgs)} test organization(s) to delete:")
        for org in test_orgs:
            print(f"  - {org.name} ({org.slug}) [id: {org.id}]")

        confirm = input("\nDelete these organizations? (y/N): ")
        if confirm.lower() != 'y':
            print("Cancelled.")
            return

        deleted_count = 0
        for org in test_orgs:
            try:
                # Delete role permissions for org roles
                await db.execute(
                    delete(RolePermission).where(
                        RolePermission.role_id.in_(
                            select(Role.id).where(Role.organization_id == org.id)
                        )
                    )
                )

                # Delete memberships
                await db.execute(
                    delete(Membership).where(Membership.organization_id == org.id)
                )

                # Delete roles
                await db.execute(
                    delete(Role).where(Role.organization_id == org.id)
                )

                # Delete organization
                await db.execute(
                    delete(Organization).where(Organization.id == org.id)
                )

                deleted_count += 1
                print(f"  ✓ Deleted: {org.name}")
            except Exception as e:
                print(f"  ✗ Failed to delete {org.name}: {e}")
                await db.rollback()
                continue

        await db.commit()
        print(f"\nDeleted {deleted_count} test organization(s).")


if __name__ == "__main__":
    asyncio.run(cleanup_test_orgs())
