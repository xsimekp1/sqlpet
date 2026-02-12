from sqlalchemy import ForeignKey, DateTime, text
from sqlalchemy.orm import Mapped, mapped_column
from src.app.db.base_class import Base
from uuid import UUID
from datetime import datetime


class AnimalTag(Base):
    __tablename__ = "animal_tags"

    animal_id: Mapped[UUID] = mapped_column(ForeignKey("animals.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[UUID] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), nullable=False)
