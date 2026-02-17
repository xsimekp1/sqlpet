import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.db.session import AsyncSessionLocal
from src.app.models.permission import Permission
from src.app.models.role import Role
from src.app.models.role_permission import RolePermission

PERMISSIONS = [
    ("org.manage", "Manage organization settings"),
    ("users.manage", "Manage users and roles"),
    ("animals.read", "View animal records"),
    ("animals.write", "Create and edit animal records"),
    ("intakes.write", "Record animal intakes"),
    ("outcomes.write", "Record animal outcomes"),
    ("kennels.manage", "Manage kennels and zones"),
    ("medical.read", "View medical records"),
    ("medical.write", "Create and edit medical records"),
    ("inventory.read", "View inventory"),
    ("inventory.write", "Manage inventory"),
    ("people.read", "View people/CRM records"),
    ("people.write", "Manage people/CRM records"),
    ("forms.manage", "Manage custom forms"),
    ("contracts.manage", "Manage contracts"),
    ("reports.run", "Run reports"),
    ("reports.schedule", "Schedule automated reports"),
    ("public.manage", "Manage public listings"),
    ("ai.use", "Use AI features"),
    ("payments.write", "Record payments"),
    ("audits.read", "View audit logs"),
    ("tasks.read", "View tasks"),
    ("tasks.write", "Create and manage tasks"),
    ("feeding.read", "View feeding plans and logs"),
    ("feeding.write", "Create and manage feeding plans"),
    ("chat.use", "Use chat/messaging"),
]

# Role templates: name -> list of permission keys
ROLE_TEMPLATES = {
    "admin": [p[0] for p in PERMISSIONS],  # all permissions
    "manager": [
        "org.manage",
        "users.manage",
        "animals.read",
        "animals.write",
        "intakes.write",
        "outcomes.write",
        "kennels.manage",
        "medical.read",
        "medical.write",
        "inventory.read",
        "inventory.write",
        "people.read",
        "people.write",
        "forms.manage",
        "contracts.manage",
        "reports.run",
        "reports.schedule",
        "public.manage",
        "payments.write",
        "audits.read",
        "tasks.read",
        "tasks.write",
        "feeding.read",
        "feeding.write",
        "chat.use",
    ],
    "vet_staff": [
        "animals.read",
        "medical.read",
        "medical.write",
        "tasks.read",
        "tasks.write",
        "feeding.read",
        "chat.use",
    ],
    "caretaker": [
        "animals.read",
        "animals.write",
        "kennels.manage",
        "medical.read",
        "inventory.read",
        "inventory.write",
        "tasks.read",
        "tasks.write",
        "feeding.read",
        "feeding.write",
        "chat.use",
    ],
    "volunteer": [
        "animals.read",
        "tasks.read",
        "tasks.write",
        "chat.use",
    ],
    "foster": [
        "animals.read",
        "tasks.read",
        "chat.use",
    ],
    "readonly": [
        "animals.read",
        "medical.read",
        "inventory.read",
        "people.read",
        "reports.run",
        "audits.read",
        "tasks.read",
    ],
}


async def seed_permissions(db: AsyncSession) -> dict[str, uuid.UUID]:
    perm_map: dict[str, uuid.UUID] = {}
    for key, description in PERMISSIONS:
        result = await db.execute(select(Permission).where(Permission.key == key))
        existing = result.scalar_one_or_none()
        if existing:
            perm_map[key] = existing.id
        else:
            perm = Permission(id=uuid.uuid4(), key=key, description=description)
            db.add(perm)
            perm_map[key] = perm.id
    await db.flush()
    return perm_map


async def seed_role_templates(db: AsyncSession, perm_map: dict[str, uuid.UUID]) -> None:
    for role_name, perm_keys in ROLE_TEMPLATES.items():
        result = await db.execute(
            select(Role).where(Role.name == role_name, Role.is_template.is_(True))
        )
        existing = result.scalar_one_or_none()
        if existing:
            role_id = existing.id
        else:
            role_id = uuid.uuid4()
            role = Role(
                id=role_id,
                organization_id=None,
                name=role_name,
                description=f"Template role: {role_name}",
                is_template=True,
            )
            db.add(role)
            await db.flush()

        # Add permissions for this role
        for perm_key in perm_keys:
            perm_id = perm_map.get(perm_key)
            if perm_id is None:
                continue
            result = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role_id,
                    RolePermission.permission_id == perm_id,
                )
            )
            if result.scalar_one_or_none() is None:
                db.add(
                    RolePermission(role_id=role_id, permission_id=perm_id, allowed=True)
                )

    await db.flush()


async def main():
    from src.app.db.seed_breeds import seed_breeds

    async with AsyncSessionLocal() as db:
        print("Seeding permissions...")
        perm_map = await seed_permissions(db)
        print(f"  {len(perm_map)} permissions ready.")

        print("Seeding role templates...")
        await seed_role_templates(db, perm_map)
        print(f"  {len(ROLE_TEMPLATES)} role templates ready.")

        print("Seeding breeds...")
        breed_count = await seed_breeds(db)
        print(f"  {breed_count} new breeds inserted.")

        await db.commit()
        print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
