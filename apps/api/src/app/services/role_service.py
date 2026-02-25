import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.role import Role
from src.app.models.role_permission import RolePermission


async def init_org_roles(db: AsyncSession, organization_id: uuid.UUID) -> None:
    """Copy all global template roles into org-specific roles (idempotent)."""
    templates = (
        await db.execute(select(Role).where(Role.is_template == True))  # noqa: E712
    ).scalars().all()

    for template in templates:
        existing = (
            await db.execute(
                select(Role).where(
                    Role.organization_id == organization_id,
                    Role.name == template.name,
                )
            )
        ).scalar_one_or_none()
        if existing:
            continue

        new_role = Role(
            id=uuid.uuid4(),
            organization_id=organization_id,
            name=template.name,
            description=template.description,
            is_template=False,
        )
        db.add(new_role)
        await db.flush()

        for tp in (
            await db.execute(
                select(RolePermission).where(RolePermission.role_id == template.id)
            )
        ).scalars().all():
            db.add(
                RolePermission(
                    role_id=new_role.id,
                    permission_id=tp.permission_id,
                    allowed=tp.allowed,
                )
            )

    await db.flush()
