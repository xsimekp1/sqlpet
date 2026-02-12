from sqlalchemy import String, ForeignKey, DateTime, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base
from uuid import UUID
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.animal import Animal


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("uuid_generate_v4()"))
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="tags")
    animals: Mapped[list["Animal"]] = relationship(secondary="animal_tags", back_populates="tags")
