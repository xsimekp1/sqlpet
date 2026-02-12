from sqlalchemy import Enum, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from src.app.models.animal import Species


class Breed(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "breeds"
    __table_args__ = (
        UniqueConstraint("species", "name", name="uq_breeds_species_name"),
    )

    species: Mapped[Species] = mapped_column(
        Enum(Species, name="species_enum", create_constraint=False, native_enum=True),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    translations = relationship("BreedI18n", back_populates="breed", cascade="all, delete-orphan")
