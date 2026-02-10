import uuid

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base


class AnimalBreed(Base):
    __tablename__ = "animal_breeds"

    animal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="CASCADE"),
        primary_key=True,
    )
    breed_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("breeds.id", ondelete="CASCADE"),
        primary_key=True,
    )
    percent: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    animal = relationship("Animal", back_populates="animal_breeds")
    breed = relationship("Breed", lazy="joined")
