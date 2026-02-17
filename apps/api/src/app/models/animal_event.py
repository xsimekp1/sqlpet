import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import UUID, Column, DateTime, Enum as SQLEnum, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from src.app.db.base import Base


class AnimalEventType(str, Enum):
    INTAKE = "INTAKE"
    KENNEL_MOVE = "KENNEL_MOVE"
    STATUS_CHANGE = "STATUS_CHANGE"
    NOTE = "NOTE"
    MEDICAL = "MEDICAL"
    OUTCOME = "OUTCOME"
    WALK = "WALK"


class AnimalEvent(Base):
    __tablename__ = "animal_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    animal_id = Column(
        UUID(as_uuid=True), ForeignKey("animals.id"), nullable=False, index=True
    )
    event_type = Column(
        SQLEnum(AnimalEventType, name="animal_event_type"), nullable=False, index=True
    )
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    title = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    payload = Column(JSON, nullable=True)
    related_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    related_kennel_id = Column(
        UUID(as_uuid=True), ForeignKey("kennels.id"), nullable=True
    )
    related_intake_id = Column(
        UUID(as_uuid=True), ForeignKey("intakes.id"), nullable=True
    )
    related_outcome_id = Column(
        UUID(as_uuid=True), ForeignKey("outcomes.id"), nullable=True
    )

    # Relationships
    related_user = relationship("User")
    related_kennel = relationship("Kennel")
    related_intake = relationship("Intake")
