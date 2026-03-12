"""Outreach campaign models for sending emails to Czech shelters."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class EmailStatus(str, enum.Enum):
    PENDING = "pending"       # not yet generated
    DRAFT = "draft"           # generated, waiting for superadmin approval
    APPROVED = "approved"     # approved, ready to send
    SENT = "sent"             # sent via Resend
    BOUNCED = "bounced"       # delivery failed
    REPLIED = "replied"       # shelter replied
    SKIPPED = "skipped"       # manually skipped
    UNSUBSCRIBED = "unsubscribed"


class OutreachCampaign(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "outreach_campaigns"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject_template: Mapped[str] = mapped_column(Text, nullable=False)
    body_template: Mapped[str | None] = mapped_column(Text, nullable=True)  # base prompt for Claude
    from_email: Mapped[str] = mapped_column(String(255), nullable=False, default="info@pets-log.com")
    reply_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    total_targets: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    replied_count: Mapped[int] = mapped_column(Integer, default=0)

    emails: Mapped[list["OutreachEmail"]] = relationship(
        "OutreachEmail", back_populates="campaign", cascade="all, delete-orphan"
    )


class OutreachEmail(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "outreach_emails"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("outreach_campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shelter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registered_shelters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)

    # Generated content
    generated_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Sending tracking
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resend_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Reply tracking
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reply_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_from: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Approval
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_attempts: Mapped[int] = mapped_column(Integer, default=0)

    # Bounced/error
    bounced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    campaign: Mapped["OutreachCampaign"] = relationship("OutreachCampaign", back_populates="emails")
    shelter: Mapped["RegisteredShelter"] = relationship("RegisteredShelter")


# Import at module level for type checking (relationship uses string ref so no circular import)
from src.app.models.registered_shelter import RegisteredShelter  # noqa: F401, E402
