from sqlalchemy import Column, String, Text, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from src.app.db.base import Base


class BreedI18n(Base):
    __tablename__ = "breeds_i18n"

    breed_id = Column(
        UUID(as_uuid=True),
        ForeignKey("breeds.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
        index=True,
    )
    locale = Column(String(5), primary_key=True, nullable=False, index=True)  # 'cs', 'en'
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=text('now()'), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text('now()'), nullable=False)

    # Relationships
    breed = relationship("Breed", back_populates="translations")
