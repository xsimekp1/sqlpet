import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin


class TaskType(str, enum.Enum):
    GENERAL = "general"
    FEEDING = "feeding"
    MEDICAL = "medical"
    CLEANING = "cleaning"
    MAINTENANCE = "maintenance"
    ADMINISTRATIVE = "administrative"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        Index(
            "ix_tasks_org_deleted_created",
            "organization_id",
            "deleted_at",
            "created_at",
        ),
        Index("ix_tasks_status", "status"),
        Index("ix_tasks_assigned_to", "assigned_to_id"),
        Index("ix_tasks_type", "type"),
        Index("ix_tasks_related_entity", "related_entity_type", "related_entity_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[TaskType] = mapped_column(
        Enum(
            TaskType,
            name="task_type_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=TaskType.GENERAL,
        nullable=False,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(
            TaskPriority,
            name="task_priority_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=TaskPriority.MEDIUM,
        nullable=False,
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(
            TaskStatus,
            name="task_status_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=TaskStatus.PENDING,
        nullable=False,
    )
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    task_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    linked_inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by.name if self.created_by else None
