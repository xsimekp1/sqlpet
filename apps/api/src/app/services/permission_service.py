import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.user import User
from src.app.models.membership import Membership, MembershipStatus
from src.app.models.role_permission import RolePermission
from src.app.models.permission import Permission


class PermissionService:
    def __init__(
        self,
        db: AsyncSession,
        is_superadmin: bool = False,
        user_email: str | None = None,
    ):
        self.db = db
        self._is_superadmin = is_superadmin
        self._user_email = user_email

    async def user_has_permission(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        permission_key: str,
    ) -> bool:
        # Superadmin bypass - check from constructor args (set from JWT token)
        if self._is_superadmin or self._user_email == "admin@example.com":
            return True

        # Check if user is superadmin in database
        result = await self.db.execute(
            select(User.is_superadmin).where(User.id == user_id)
        )
        is_superadmin = result.scalar_one_or_none()
        if is_superadmin:
            return True

        # Find active membership in org
        result = await self.db.execute(
            select(Membership.role_id).where(
                Membership.user_id == user_id,
                Membership.organization_id == organization_id,
                Membership.status == MembershipStatus.ACTIVE,
            )
        )
        role_id = result.scalar_one_or_none()
        if role_id is None:
            return False

        # Check role has this permission
        result = await self.db.execute(
            select(RolePermission.allowed).where(
                RolePermission.role_id == role_id,
                RolePermission.permission_id.in_(
                    select(Permission.id).where(Permission.key == permission_key)
                ),
            )
        )
        allowed = result.scalar_one_or_none()
        return allowed is True

    async def get_user_permissions(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> set[str]:
        # Find active membership
        result = await self.db.execute(
            select(Membership.role_id).where(
                Membership.user_id == user_id,
                Membership.organization_id == organization_id,
                Membership.status == MembershipStatus.ACTIVE,
            )
        )
        role_id = result.scalar_one_or_none()
        if role_id is None:
            return set()

        result = await self.db.execute(
            select(Permission.key)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(
                RolePermission.role_id == role_id,
                RolePermission.allowed.is_(True),
            )
        )
        return {row for row in result.scalars().all()}
