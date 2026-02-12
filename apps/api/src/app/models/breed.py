from decimal import Decimal
from sqlalchemy import Enum, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from src.app.models.animal import Species


class Breed(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "breeds"
    __table_args__ = (
        UniqueConstraint("species", "name", name="uq_breeds_species_name"),
    )

    species: Mapped[Species] = mapped_column(
        Enum(Species, name="species_enum", create_constraint=False, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Weight ranges (in kg)
    weight_male_min: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    weight_male_max: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    weight_female_min: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    weight_female_max: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)

    # Relationships
    translations = relationship("BreedI18n", back_populates="breed", cascade="all, delete-orphan")
