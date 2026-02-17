"""
Add chat.use permission to all organization roles.
Run: cd apps/api && railway run python -c "
import asyncio
from sqlalchemy import select
from src.app.db.session import AsyncSessionLocal
from src.app.models.role_permission import RolePermission
from src.app.models.permission import Permission
from src.app.models.role import Role

async def fix_chat_perms():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Permission).where(Permission.key == 'chat.use'))
        chat_perm = result.scalar_one_or_none()
        if not chat_perm:
            print('chat.use permission not found - running seed first')
            return

        result = await db.execute(select(Role).where(Role.is_template == False))
        roles = result.scalars().all()

        for role in roles:
            result = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == chat_perm.id
                )
            )
            if not result.scalar_one_or_none():
                db.add(RolePermission(role_id=role.id, permission_id=chat_perm.id, allowed=True))
                print(f'Added chat.use to role {role.name}')

        await db.commit()
        print('Done!')

asyncio.run(fix_chat_perms())
"
"""
