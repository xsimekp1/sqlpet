import secrets
import base64
import pyotp
import qrcode
import io
import uuid
from typing import Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.user import User


class TwoFactorService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def generate_secret(self) -> str:
        return pyotp.random_base32()

    def get_provisioning_uri(self, secret: str, email: str) -> str:
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name="Petslog")

    def generate_qr_code(self, provisioning_uri: str) -> str:
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    def verify_code(self, secret: str, code: str) -> bool:
        totp = pyotp.TOTP(secret)
        return totp.verify(code)

    async def initiate_setup(self, user: User) -> Tuple[str, str, str]:
        if user.totp_enabled:
            raise ValueError("2FA is already enabled")

        secret = self.generate_secret()
        provisioning_uri = self.get_provisioning_uri(secret, user.email)
        qr_code = self.generate_qr_code(provisioning_uri)

        user.totp_secret = secret
        await self.db.flush()

        return secret, qr_code, provisioning_uri

    async def verify_and_enable(self, user: User, code: str) -> bool:
        if user.totp_enabled:
            raise ValueError("2FA is already enabled")

        if not user.totp_secret:
            raise ValueError("2FA setup not initiated")

        if not self.verify_code(user.totp_secret, code):
            return False

        user.totp_enabled = True
        await self.db.flush()

        backup_codes = self.generate_backup_codes()
        user.backup_codes = ",".join(backup_codes)
        await self.db.flush()

        return True

    async def disable(self, user: User, code: str | None = None) -> bool:
        if not user.totp_enabled:
            raise ValueError("2FA is not enabled")

        if code:
            if not self.verify_code(user.totp_secret or "", code):
                return False

        user.totp_enabled = False
        user.totp_secret = None
        user.backup_codes = None
        await self.db.flush()

        return True

    def generate_backup_codes(self) -> list[str]:
        return [secrets.token_hex(4) for _ in range(8)]

    async def verify_backup_code(self, user: User, code: str) -> bool:
        if not user.backup_codes:
            return False

        codes = user.backup_codes.split(",")
        if code in codes:
            codes.remove(code)
            user.backup_codes = ",".join(codes)
            await self.db.flush()
            return True

        return False

    async def regenerate_backup_codes(self, user: User) -> list[str]:
        if not user.totp_enabled:
            raise ValueError("2FA is not enabled")

        codes = self.generate_backup_codes()
        user.backup_codes = ",".join(codes)
        await self.db.flush()

        return codes

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
