import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.app.core.security import hash_password, verify_password
from src.app.models.user import User
from src.app.models.membership import Membership


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_user(
        self, email: str, password: str, name: str, phone: str | None = None
    ) -> User:
        existing = await self.db.execute(
            select(User).where(User.email == email)
        )
        if existing.scalar_one_or_none() is not None:
            raise ValueError("Email already registered")

        user = User(
            id=uuid.uuid4(),
            email=email,
            password_hash=hash_password(password),
            name=name,
            phone=phone,
            is_superadmin=False,
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def authenticate_user(self, email: str, password: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        if user is None or not verify_password(password, user.password_hash):
            return None
        return user

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_user_memberships(self, user_id: uuid.UUID) -> list[Membership]:
        result = await self.db.execute(
            select(Membership).where(Membership.user_id == user_id)
        )
        return list(result.scalars().all())
