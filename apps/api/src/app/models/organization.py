from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Organization(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Prague")
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    tags = relationship("Tag", back_populates="organization", lazy="selectin")
    files = relationship("File", back_populates="organization")
    animal_events = relationship(
        "AnimalEvent", back_populates="organization", lazy="selectin"
    )
