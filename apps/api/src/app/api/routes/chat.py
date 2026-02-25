"""API routes for chat/messaging between users."""

import uuid
import logging
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload

from src.app.api.dependencies.auth import (
    get_current_user,
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.chat import ChatMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


class UserResponse(BaseModel):
    id: str
    name: str
    full_name: str | None
    avatar_url: str | None


@router.get("/users", response_model=List[UserResponse])
async def get_organization_users(
    current_user: User = Depends(require_permission("chat.use")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all users in the current organization (for starting new conversations).
    Superadmins see all users across all organizations.
    Regular users don't see superadmins in the list.
    """
    # If current user is superadmin, return all users across all organizations
    if current_user.is_superadmin:
        q = select(User).order_by(User.full_name, User.name)
    else:
        # Regular users only see users in their organization, excluding superadmins
        q = select(User).where(
            User.organization_id == organization_id, User.is_superadmin == False
        )

    result = await db.execute(q)
    users = result.scalars().all()

    return [
        UserResponse(
            id=str(u.id),
            name=u.name,
            full_name=u.full_name,
            avatar_url=getattr(u, "avatar_url", None),
        )
        for u in users
        if str(u.id) != str(current_user.id)
    ]


class ChatMessageCreate(BaseModel):
    recipient_id: str
    content: str


class ChatMessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    recipient_id: str
    recipient_name: str
    content: str
    is_read: bool
    created_at: str
    read_at: str | None


class ConversationResponse(BaseModel):
    partner_id: str
    partner_name: str
    partner_avatar: str | None
    last_message: str | None
    last_message_at: str | None
    unread_count: int


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: User = Depends(require_permission("chat.use")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get list of conversations (users the current user has chatted with)."""

    # If superadmin, get conversations across all organizations
    if current_user.is_superadmin:
        q = (
            select(ChatMessage)
            .where(
                or_(
                    ChatMessage.sender_id == current_user.id,
                    ChatMessage.recipient_id == current_user.id,
                ),
            )
            .order_by(ChatMessage.created_at.desc())
        )
    else:
        # Regular users only see conversations in their current organization
        q = (
            select(ChatMessage)
            .where(
                ChatMessage.organization_id == organization_id,
                or_(
                    ChatMessage.sender_id == current_user.id,
                    ChatMessage.recipient_id == current_user.id,
                ),
            )
            .order_by(ChatMessage.created_at.desc())
        )

    result = await db.execute(q)
    messages = result.scalars().all()

    # Group by partner
    partners = {}
    for msg in messages:
        partner_id = str(
            msg.recipient_id if msg.sender_id == str(current_user.id) else msg.sender_id
        )

        if partner_id not in partners:
            # Get partner user
            partner_q = await db.execute(
                select(User).where(User.id == uuid.UUID(partner_id))
            )
            partner = partner_q.scalar_one_or_none()
            if not partner:
                continue

            partners[partner_id] = {
                "partner_id": partner_id,
                "partner_name": partner.full_name or partner.name,
                "partner_avatar": getattr(partner, "avatar_url", None),
                "last_message": msg.content,
                "last_message_at": msg.created_at.isoformat()
                if msg.created_at
                else None,
                "unread_count": 0,
            }

        # Count unread
        if msg.recipient_id == str(current_user.id) and not msg.is_read:
            partners[partner_id]["unread_count"] += 1

    return list(partners.values())


@router.get("/messages/{partner_id}", response_model=List[ChatMessageResponse])
async def get_messages(
    partner_id: str,
    current_user: User = Depends(require_permission("chat.use")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get chat messages with a specific user (partner)."""

    try:
        partner_uuid = uuid.UUID(partner_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid partner ID")

    # If superadmin, get messages across all organizations
    if current_user.is_superadmin:
        q = (
            select(ChatMessage)
            .where(
                or_(
                    and_(
                        ChatMessage.sender_id == str(current_user.id),
                        ChatMessage.recipient_id == partner_id,
                    ),
                    and_(
                        ChatMessage.sender_id == partner_id,
                        ChatMessage.recipient_id == str(current_user.id),
                    ),
                ),
            )
            .order_by(ChatMessage.created_at.asc())
        )
    else:
        # Regular users only see messages in their current organization
        q = (
            select(ChatMessage)
            .where(
                ChatMessage.organization_id == organization_id,
                or_(
                    and_(
                        ChatMessage.sender_id == str(current_user.id),
                        ChatMessage.recipient_id == partner_id,
                    ),
                    and_(
                        ChatMessage.sender_id == partner_id,
                        ChatMessage.recipient_id == str(current_user.id),
                    ),
                ),
            )
            .order_by(ChatMessage.created_at.asc())
        )

    # Mark messages as read
    await db.execute(
        ChatMessage.__table__.update()
        .where(
            and_(
                ChatMessage.recipient_id == str(current_user.id),
                ChatMessage.sender_id == partner_id,
                ChatMessage.is_read == False,
            )
        )
        .values(is_read=True, read_at=datetime.utcnow())
    )
    await db.commit()

    result = await db.execute(q)
    messages = result.scalars().all()

    # Get user names
    user_ids = set(
        [str(m.sender_id) for m in messages] + [str(m.recipient_id) for m in messages]
    )
    users = {}
    for uid in user_ids:
        uq = await db.execute(select(User).where(User.id == uuid.UUID(uid)))
        u = uq.scalar_one_or_none()
        if u:
            users[uid] = u.full_name or u.name

    return [
        ChatMessageResponse(
            id=str(m.id),
            sender_id=str(m.sender_id),
            sender_name=users.get(str(m.sender_id), "Unknown"),
            recipient_id=str(m.recipient_id),
            recipient_name=users.get(str(m.recipient_id), "Unknown"),
            content=m.content,
            is_read=m.is_read,
            created_at=m.created_at.isoformat() if m.created_at else "",
            read_at=m.read_at.isoformat() if m.read_at else None,
        )
        for m in messages
    ]


@router.post(
    "/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED
)
async def send_message(
    data: ChatMessageCreate,
    current_user: User = Depends(require_permission("chat.use")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to another user."""

    try:
        recipient_uuid = uuid.UUID(data.recipient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid recipient ID")

    # Verify recipient exists
    recipient_q = await db.execute(select(User).where(User.id == recipient_uuid))
    recipient = recipient_q.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    # Check if recipient is superadmin
    is_recipient_superadmin = recipient.is_superadmin

    # If recipient is superadmin and sender is not, check if conversation already exists
    # (i.e., superadmin started the conversation first)
    if is_recipient_superadmin and not current_user.is_superadmin:
        existing_conv = await db.execute(
            select(ChatMessage)
            .where(
                ChatMessage.organization_id == organization_id,
                or_(
                    and_(
                        ChatMessage.sender_id == str(recipient.id),
                        ChatMessage.recipient_id == str(current_user.id),
                    ),
                    and_(
                        ChatMessage.sender_id == str(current_user.id),
                        ChatMessage.recipient_id == str(recipient.id),
                    ),
                ),
            )
            .limit(1)
        )
        if not existing_conv.scalar_one_or_none():
            raise HTTPException(
                status_code=403,
                detail="Cannot message superadmin. They must start the conversation first.",
            )

    # Determine organization_id for the message
    # Superadmins can message users in any organization (use recipient's org)
    # Regular users use their current organization
    if current_user.is_superadmin:
        msg_organization_id = recipient.organization_id
    else:
        msg_organization_id = organization_id

    # Create message
    message = ChatMessage(
        id=uuid.uuid4(),
        organization_id=msg_organization_id,
        sender_id=str(current_user.id),
        recipient_id=data.recipient_id,
        content=data.content,
    )

    db.add(message)
    await db.commit()
    await db.refresh(message)

    logger.info(f"Message sent from {current_user.id} to {data.recipient_id}")

    return ChatMessageResponse(
        id=str(message.id),
        sender_id=str(message.sender_id),
        sender_name=current_user.full_name or current_user.name,
        recipient_id=str(message.recipient_id),
        recipient_name=recipient.full_name or recipient.name,
        content=message.content,
        is_read=message.is_read,
        created_at=message.created_at.isoformat() if message.created_at else "",
        read_at=None,
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(require_permission("chat.use")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get total unread message count."""

    q = select(ChatMessage).where(
        ChatMessage.organization_id == organization_id,
        ChatMessage.recipient_id == str(current_user.id),
        ChatMessage.is_read == False,
    )
    result = await db.execute(q)
    messages = result.scalars().all()

    return {"unread_count": len(messages)}


# Cleanup old messages (can be called via cron)
@router.delete("/cleanup", status_code=status.HTTP_204_NO_CONTENT)
async def cleanup_old_messages(
    days: int = Query(
        default=365, description="Delete messages older than this many days"
    ),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete messages older than specified days (default: 365)."""

    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only admins can run cleanup")

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        ChatMessage.__table__.delete().where(
            and_(
                ChatMessage.organization_id == organization_id,
                ChatMessage.created_at < cutoff_date,
            )
        )
    )
    await db.commit()

    logger.info(f"Deleted {result.rowcount} messages older than {days} days")
