import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Float, String, Text, ARRAY, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY as PG_ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class WalkLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "walk_logs"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    animal_ids: Mapped[list[uuid.UUID]] = mapped_column(
        PG_ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )

    walk_type: Mapped[str] = mapped_column(String(20), nullable=False, default="walk")

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    started_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    ended_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="in_progress"
    )

    # Enrichment fields (for dogs only)
    enrichment_types: Mapped[list[str] | None] = mapped_column(
        PG_ARRAY(String(50)), nullable=True
    )
    intensity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    reaction: Mapped[str | None] = mapped_column(String(20), nullable=True)

    organization = relationship("Organization")
    started_by = relationship("User", foreign_keys=[started_by_id])
    ended_by = relationship("User", foreign_keys=[ended_by_id])
