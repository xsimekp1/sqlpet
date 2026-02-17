import enum
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class ChatMessage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "chat_messages"

    organization_id: str = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    sender_id: str = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    recipient_id: str = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    content: str = Column(Text, nullable=False)
    is_read: bool = Column(Boolean, default=False, nullable=False)
    read_at: datetime = Column(DateTime, nullable=True)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    organization = relationship("Organization")

    __table_args__ = ({"schema": None},)
