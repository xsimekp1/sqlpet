"""
Fix existing organization roles by copying permissions from templates.
Run this once to fix roles created before permissions were seeded.
"""
import asyncio
from sqlalchemy import select
from src.app.db.session import AsyncSessionLocal
from src.app.models.role import Role
from src.app.models.role_permission import RolePermission


async def fix_org_roles():
    async with AsyncSessionLocal() as db:
        # Get all template roles
        result = await db.execute(
            select(Role).where(Role.is_template.is_(True))
        )
        templates = result.scalars().all()

        if not templates:
            print("No template roles found!")
            return

        print(f"Found {len(templates)} template roles")

        # Get all organization-specific roles
        result = await db.execute(
            select(Role).where(Role.is_template.is_(False))
        )
        org_roles = result.scalars().all()

        print(f"Found {len(org_roles)} organization roles")

        for org_role in org_roles:
            # Find matching template by name
            template = next(
                (t for t in templates if t.name == org_role.name),
                None
            )

            if not template:
                print(f"  No template found for role '{org_role.name}'")
                continue

            # Get template permissions
            result = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == template.id
                )
            )
            template_perms = result.scalars().all()

            # Get existing org role permissions
            result = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == org_role.id
                )
            )
            existing_perms = {rp.permission_id for rp in result.scalars().all()}

            # Copy missing permissions
            added_count = 0
            for template_perm in template_perms:
                if template_perm.permission_id not in existing_perms:
                    db.add(RolePermission(
                        role_id=org_role.id,
                        permission_id=template_perm.permission_id,
                        allowed=template_perm.allowed
                    ))
                    added_count += 1

            if added_count > 0:
                print(f"  Added {added_count} permissions to role '{org_role.name}' (org: {org_role.organization_id})")
            else:
                print(f"  Role '{org_role.name}' already has all permissions")

        await db.commit()
        print("\nDone! All organization roles updated.")


if __name__ == "__main__":
    asyncio.run(fix_org_roles())
