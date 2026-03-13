"""Superadmin outreach routes — manage email campaigns to Czech shelters."""

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.app.api.dependencies.auth import get_current_user, oauth2_scheme, decode_token
from src.app.api.dependencies.db import get_db
from src.app.models.outreach import OutreachCampaign, OutreachEmail
from src.app.models.registered_shelter import RegisteredShelter
from src.app.models.user import User

router = APIRouter(prefix="/superadmin/outreach", tags=["outreach"])


# ─── helpers ────────────────────────────────────────────────────────────────


def _require_superadmin(current_user: User, token: str) -> None:
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass
    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )


# ─── schemas ─────────────────────────────────────────────────────────────────


class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    subject_template: str
    body_template: Optional[str] = None
    from_email: str = "info@pets-log.com"
    reply_to: Optional[str] = None


class CampaignResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    subject_template: str
    body_template: Optional[str]
    from_email: str
    reply_to: Optional[str]
    status: str
    total_targets: int
    sent_count: int
    replied_count: int
    draft_count: int = 0
    approved_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShelterInfo(BaseModel):
    id: uuid.UUID
    name: str
    email: Optional[str] = None
    website: Optional[str] = None
    region: Optional[str] = None

    class Config:
        from_attributes = True


class EmailDraftResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    shelter_id: uuid.UUID
    shelter: ShelterInfo
    status: str
    generated_subject: Optional[str]
    generated_body: Optional[str]
    sent_at: Optional[datetime]
    replied_at: Optional[datetime]
    reply_subject: Optional[str]
    reply_content: Optional[str]
    reply_from: Optional[str]
    approved_at: Optional[datetime]
    error_message: Optional[str]
    generation_attempts: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BulkApproveRequest(BaseModel):
    email_ids: List[uuid.UUID]


class EditDraftRequest(BaseModel):
    generated_subject: Optional[str] = None
    generated_body: Optional[str] = None


# ─── campaigns ───────────────────────────────────────────────────────────────


@router.post("/campaigns", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    body: CampaignCreate,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Create a new outreach campaign."""
    _require_superadmin(current_user, token)

    campaign = OutreachCampaign(
        name=body.name,
        description=body.description,
        subject_template=body.subject_template,
        body_template=body.body_template,
        from_email=body.from_email,
        reply_to=body.reply_to,
        created_by_user_id=current_user.id,
        status="draft",
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)

    result = CampaignResponse.model_validate(campaign)
    result.draft_count = 0
    result.approved_count = 0
    return result


@router.get("/campaigns", response_model=List[CampaignResponse])
async def list_campaigns(
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """List all outreach campaigns."""
    _require_superadmin(current_user, token)

    campaigns = (
        (
            await db.execute(
                select(OutreachCampaign).order_by(OutreachCampaign.created_at.desc())
            )
        )
        .scalars()
        .all()
    )

    # Batch-load status counts
    counts_q = await db.execute(
        select(
            OutreachEmail.campaign_id,
            OutreachEmail.status,
            func.count().label("cnt"),
        ).group_by(OutreachEmail.campaign_id, OutreachEmail.status)
    )
    counts: dict[uuid.UUID, dict[str, int]] = {}
    for row in counts_q:
        counts.setdefault(row.campaign_id, {})[row.status] = row.cnt

    result = []
    for c in campaigns:
        r = CampaignResponse.model_validate(c)
        r.draft_count = counts.get(c.id, {}).get("draft", 0)
        r.approved_count = counts.get(c.id, {}).get("approved", 0)
        result.append(r)
    return result


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    _require_superadmin(current_user, token)

    campaign = await db.get(OutreachCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    counts_q = await db.execute(
        select(OutreachEmail.status, func.count().label("cnt"))
        .where(OutreachEmail.campaign_id == campaign_id)
        .group_by(OutreachEmail.status)
    )
    counts = {row.status: row.cnt for row in counts_q}

    r = CampaignResponse.model_validate(campaign)
    r.draft_count = counts.get("draft", 0)
    r.approved_count = counts.get("approved", 0)
    return r


@router.patch("/campaigns/{campaign_id}/status")
async def update_campaign_status(
    campaign_id: uuid.UUID,
    new_status: str = Query(...),
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Set campaign status (draft/active/paused/completed)."""
    _require_superadmin(current_user, token)

    valid = {"draft", "active", "paused", "completed"}
    if new_status not in valid:
        raise HTTPException(
            status_code=400, detail=f"Invalid status. Must be one of: {valid}"
        )

    campaign = await db.get(OutreachCampaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = new_status
    return {"id": str(campaign_id), "status": new_status}


# ─── email drafts ─────────────────────────────────────────────────────────────


@router.get("/campaigns/{campaign_id}/emails", response_model=dict)
async def list_emails(
    campaign_id: uuid.UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """List email drafts for a campaign, with optional status filter."""
    _require_superadmin(current_user, token)

    q = (
        select(OutreachEmail)
        .where(OutreachEmail.campaign_id == campaign_id)
        .options(selectinload(OutreachEmail.shelter))
    )
    if status_filter:
        q = q.where(OutreachEmail.status == status_filter)

    total = (
        await db.execute(select(func.count()).select_from(q.subquery()))
    ).scalar_one()
    emails = (
        (
            await db.execute(
                q.order_by(OutreachEmail.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )

    items = []
    for e in emails:
        shelter_info = ShelterInfo(
            id=e.shelter.id,
            name=e.shelter.name,
            email=getattr(e.shelter, "email", None),
            website=e.shelter.website,
            region=e.shelter.region,
        )
        d = EmailDraftResponse(
            id=e.id,
            campaign_id=e.campaign_id,
            shelter_id=e.shelter_id,
            shelter=shelter_info,
            status=e.status,
            generated_subject=e.generated_subject,
            generated_body=e.generated_body,
            sent_at=e.sent_at,
            replied_at=e.replied_at,
            reply_subject=e.reply_subject,
            reply_content=e.reply_content,
            reply_from=e.reply_from,
            approved_at=e.approved_at,
            error_message=e.error_message,
            generation_attempts=e.generation_attempts,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        items.append(d)

    return {
        "items": [i.model_dump() for i in items],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.patch("/emails/{email_id}/approve")
async def approve_email(
    email_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Approve a draft email for sending."""
    _require_superadmin(current_user, token)

    email = await db.get(OutreachEmail, email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    if email.status not in ("draft", "pending"):
        raise HTTPException(
            status_code=400, detail=f"Cannot approve email with status '{email.status}'"
        )
    if not email.generated_body or not email.generated_subject:
        raise HTTPException(
            status_code=400, detail="Email has no generated content yet"
        )

    email.status = "approved"
    email.approved_by_user_id = current_user.id
    email.approved_at = datetime.now(timezone.utc)
    return {"id": str(email_id), "status": "approved"}


@router.post("/emails/bulk-approve")
async def bulk_approve_emails(
    body: BulkApproveRequest,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Approve multiple draft emails at once."""
    _require_superadmin(current_user, token)

    now = datetime.now(timezone.utc)
    await db.execute(
        update(OutreachEmail)
        .where(
            OutreachEmail.id.in_(body.email_ids),
            OutreachEmail.status.in_(("draft", "pending")),
            OutreachEmail.generated_body.isnot(None),
        )
        .values(
            status="approved",
            approved_by_user_id=current_user.id,
            approved_at=now,
        )
    )
    return {"approved": len(body.email_ids)}


@router.patch("/emails/{email_id}/edit")
async def edit_email_draft(
    email_id: uuid.UUID,
    body: EditDraftRequest,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Edit the generated content of a draft email before approving."""
    _require_superadmin(current_user, token)

    email = await db.get(OutreachEmail, email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    if email.status not in ("draft", "pending"):
        raise HTTPException(
            status_code=400, detail=f"Cannot edit email with status '{email.status}'"
        )

    if body.generated_subject is not None:
        email.generated_subject = body.generated_subject
    if body.generated_body is not None:
        email.generated_body = body.generated_body

    return {"id": str(email_id), "status": email.status}


@router.patch("/emails/{email_id}/skip")
async def skip_email(
    email_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Skip an email (will not be sent)."""
    _require_superadmin(current_user, token)

    email = await db.get(OutreachEmail, email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    email.status = "skipped"
    return {"id": str(email_id), "status": "skipped"}


# ─── Resend inbound webhook ───────────────────────────────────────────────────


class ResendInboundPayload(BaseModel):
    from_: Optional[str] = None
    subject: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None
    headers: Optional[dict] = None
    message_id: Optional[str] = None

    class Config:
        populate_by_name = True
        extra = "allow"


@router.post("/webhook/inbound", include_in_schema=False)
async def inbound_email_webhook(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Resend inbound webhook — records replies from shelters.
    No auth (called by Resend), validated by matching resend_message_id
    from In-Reply-To header or from email address.
    """
    from_email = payload.get("from", "")
    subject = payload.get("subject", "")
    text_body = payload.get("text", "") or payload.get("html", "")
    in_reply_to = payload.get("inReplyTo") or payload.get("in_reply_to", "")

    # Try to match by In-Reply-To header (original message ID)
    matched_email = None
    if in_reply_to:
        result = await db.execute(
            select(OutreachEmail).where(
                OutreachEmail.resend_message_id == in_reply_to.strip("<>")
            )
        )
        matched_email = result.scalar_one_or_none()

    # Fallback: match by sender email against shelter emails
    if not matched_email and from_email:
        # Find shelter with this email
        shelter_result = await db.execute(
            select(RegisteredShelter).where(
                func.lower(RegisteredShelter.email)
                == from_email.lower().split("<")[-1].strip(">").strip()
                if "<" in from_email
                else func.lower(RegisteredShelter.email) == from_email.lower()
            )
        )
        shelter = shelter_result.scalar_one_or_none()
        if shelter:
            email_result = await db.execute(
                select(OutreachEmail)
                .where(
                    OutreachEmail.shelter_id == shelter.id,
                    OutreachEmail.status == "sent",
                )
                .order_by(OutreachEmail.sent_at.desc())
                .limit(1)
            )
            matched_email = email_result.scalar_one_or_none()

    if matched_email:
        matched_email.status = "replied"
        matched_email.replied_at = datetime.now(timezone.utc)
        matched_email.reply_subject = subject[:500] if subject else None
        matched_email.reply_content = text_body[:5000] if text_body else None
        matched_email.reply_from = from_email[:255] if from_email else None

        # Update campaign replied_count
        campaign = await db.get(OutreachCampaign, matched_email.campaign_id)
        if campaign:
            campaign.replied_count = (campaign.replied_count or 0) + 1

    return {"ok": True}
