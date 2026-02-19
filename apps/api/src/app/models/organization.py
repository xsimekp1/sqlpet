from typing import Optional

from sqlalchemy import Float, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Organization(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Prague")
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hotel_price_per_day: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    # Organization details
    registration_number: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Capacities by species
    capacity_dogs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    capacity_cats: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    capacity_rabbits: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    capacity_small: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    capacity_birds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    tags = relationship("Tag", back_populates="organization", lazy="selectin")
    files = relationship("File", back_populates="organization")
