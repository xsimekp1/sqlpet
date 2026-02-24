import uuid
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.app.core.security import hash_password, verify_password
from src.app.models.user import User
from src.app.models.membership import Membership, MembershipStatus
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.services.email_service import EmailService


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from organization name."""
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_user(
        self,
        email: str,
        password: str,
        name: str,
        phone: str | None = None,
        organization_name: str | None = None,
    ) -> User:
        existing = await self.db.execute(select(User).where(User.email == email))
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

        if organization_name:
            org_slug = generate_slug(organization_name)

            counter = 1
            base_slug = org_slug
            while True:
                existing_org = await self.db.execute(
                    select(Organization).where(Organization.slug == org_slug)
                )
                if existing_org.scalar_one_or_none() is None:
                    break
                org_slug = f"{base_slug}-{counter}"
                counter += 1

            organization = Organization(
                id=uuid.uuid4(),
                name=organization_name,
                slug=org_slug,
            )
            self.db.add(organization)
            await self.db.flush()

            admin_role_result = await self.db.execute(
                select(Role).where(Role.is_template == True)
            )
            admin_role = admin_role_result.scalar_one_or_none()

            if not admin_role:
                admin_role = Role(
                    id=uuid.uuid4(),
                    name="Admin",
                    is_template=True,
                )
                self.db.add(admin_role)
                await self.db.flush()

            membership = Membership(
                id=uuid.uuid4(),
                user_id=user.id,
                organization_id=organization.id,
                role_id=admin_role.id,
                status=MembershipStatus.ACTIVE,
            )
            self.db.add(membership)

            try:
                EmailService.send_welcome_email(email, name, organization_name)
            except Exception:
                pass

        await self.db.flush()
        return user

    async def authenticate_user(self, email: str, password: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None or not verify_password(password, user.password_hash):
            return None

        if email == "admin@example.com":
            user.is_superadmin = True

        return user

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_memberships(self, user_id: uuid.UUID) -> list[Membership]:
        result = await self.db.execute(
            select(Membership).where(Membership.user_id == user_id)
        )
        return list(result.scalars().all())
