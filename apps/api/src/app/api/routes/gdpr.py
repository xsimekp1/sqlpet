"""
GDPR compliance endpoints:
- GET /admin/gdpr/export         — ZIP export of org data (org.manage)
- GET /admin/gdpr/login-logs     — Paginated login logs (org.manage)
- GET /superadmin/gdpr/organizations — List all orgs (superadmin)
- GET /superadmin/gdpr/dpa/{org_id}  — Generate DPA for org (superadmin)
"""

import csv
import io
import logging
import uuid
import zipfile
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_organization_id,
    get_current_user,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.audit_log import AuditLog
from src.app.models.contact import Contact
from src.app.models.login_log import LoginLog
from src.app.models.membership import Membership, MembershipStatus
from src.app.models.organization import Organization
from src.app.models.user import User
from src.app.templates.dpa_cs import render_dpa

logger = logging.getLogger(__name__)

router = APIRouter(tags=["gdpr"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _csv_bytes(headers: list[str], rows: list[list]) -> bytes:
    """Serialize rows to UTF-8 CSV bytes with BOM for Excel compatibility."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8-sig")


async def _require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required",
        )
    return current_user


# ---------------------------------------------------------------------------
# Admin endpoints (org.manage)
# ---------------------------------------------------------------------------

@router.get("/admin/gdpr/export")
async def gdpr_export(
    _: User = Depends(require_permission("org.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Export all personal data for the organization as a ZIP file with 4 CSV files.
    Requires org.manage permission.
    """
    twelve_months_ago = datetime.now(timezone.utc) - timedelta(days=365)

    # --- contacts.csv ---
    contacts_result = await db.execute(
        select(Contact).where(Contact.organization_id == organization_id)
    )
    contacts = contacts_result.scalars().all()
    contacts_csv = _csv_bytes(
        ["id", "name", "type", "email", "phone", "address", "bank_account", "tax_id", "notes", "created_at"],
        [
            [
                str(c.id), c.name, c.type, c.email or "", c.phone or "",
                c.address or "", c.bank_account or "", c.tax_id or "",
                (c.notes or "").replace("\n", " "), str(c.created_at),
            ]
            for c in contacts
        ],
    )

    # --- users.csv (members of this org) ---
    members_result = await db.execute(
        select(Membership, User)
        .join(User, User.id == Membership.user_id)
        .where(
            Membership.organization_id == organization_id,
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    members = members_result.all()
    users_csv = _csv_bytes(
        ["user_id", "name", "email", "phone", "membership_status", "joined_at"],
        [
            [
                str(m.user_id), u.name, u.email, u.phone or "",
                m.status.value, str(m.created_at),
            ]
            for m, u in members
        ],
    )

    # --- audit_logs.csv (last 12 months) ---
    audit_result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at >= twelve_months_ago,
        )
        .order_by(AuditLog.created_at.desc())
    )
    audit_logs = audit_result.scalars().all()
    audit_csv = _csv_bytes(
        ["id", "actor_user_id", "action", "entity_type", "entity_id", "ip", "user_agent", "created_at"],
        [
            [
                str(a.id), str(a.actor_user_id) if a.actor_user_id else "",
                a.action, a.entity_type, str(a.entity_id) if a.entity_id else "",
                a.ip or "", a.user_agent or "", str(a.created_at),
            ]
            for a in audit_logs
        ],
    )

    # --- login_logs.csv (last 12 months, for org members only) ---
    member_user_ids = [m.user_id for m, _ in members]
    if member_user_ids:
        login_result = await db.execute(
            select(LoginLog)
            .where(
                LoginLog.user_id.in_(member_user_ids),
                LoginLog.created_at >= twelve_months_ago,
            )
            .order_by(LoginLog.created_at.desc())
        )
        login_logs = login_result.scalars().all()
    else:
        login_logs = []

    login_csv = _csv_bytes(
        ["id", "user_id", "email", "ip", "success", "failure_reason", "created_at"],
        [
            [
                str(ll.id), str(ll.user_id) if ll.user_id else "",
                ll.email, ll.ip or "", str(ll.success),
                ll.failure_reason or "", str(ll.created_at),
            ]
            for ll in login_logs
        ],
    )

    # Build ZIP in memory
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("contacts.csv", contacts_csv)
        zf.writestr("users.csv", users_csv)
        zf.writestr("audit_logs.csv", audit_csv)
        zf.writestr("login_logs.csv", login_csv)
    zip_buf.seek(0)

    filename = f"gdpr_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/admin/gdpr/login-logs")
async def list_login_logs(
    _: User = Depends(require_permission("org.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    user_id: uuid.UUID | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    success: bool | None = Query(None),
):
    """
    Paginated login logs for users who are members of this organization.
    Requires org.manage permission.
    """
    # Get all member user IDs
    members_result = await db.execute(
        select(Membership.user_id).where(
            Membership.organization_id == organization_id,
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    member_user_ids = list(members_result.scalars().all())

    if not member_user_ids:
        return {"items": [], "total": 0, "page": page, "size": size}

    query = select(LoginLog).where(LoginLog.user_id.in_(member_user_ids))

    if user_id is not None:
        query = query.where(LoginLog.user_id == user_id)
    if from_date is not None:
        query = query.where(LoginLog.created_at >= from_date)
    if to_date is not None:
        query = query.where(LoginLog.created_at <= to_date)
    if success is not None:
        query = query.where(LoginLog.success == success)

    # Total count
    from sqlalchemy import func as sqlfunc
    count_result = await db.execute(
        select(sqlfunc.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    # Paginated items
    items_result = await db.execute(
        query.order_by(LoginLog.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = items_result.scalars().all()

    return {
        "items": [
            {
                "id": str(ll.id),
                "user_id": str(ll.user_id) if ll.user_id else None,
                "email": ll.email,
                "ip": ll.ip,
                "success": ll.success,
                "failure_reason": ll.failure_reason,
                "created_at": ll.created_at.isoformat(),
            }
            for ll in items
        ],
        "total": total,
        "page": page,
        "size": size,
    }


# ---------------------------------------------------------------------------
# Superadmin endpoints
# ---------------------------------------------------------------------------

@router.get("/superadmin/gdpr/organizations")
async def superadmin_list_organizations(
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """List all organizations for DPA generation. Superadmin only."""
    result = await db.execute(
        select(Organization).order_by(Organization.name)
    )
    orgs = result.scalars().all()
    return [
        {
            "id": str(o.id),
            "name": o.name,
            "slug": o.slug,
            "registration_number": o.registration_number,
            "address": o.address,
        }
        for o in orgs
    ]


@router.get("/superadmin/gdpr/dpa/{org_id}")
async def superadmin_generate_dpa(
    org_id: uuid.UUID,
    _: User = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a pre-filled Czech GDPR Data Processing Agreement for an organization.
    Superadmin only.
    """
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    generated_at = datetime.now(timezone.utc)
    dpa_html = render_dpa(
        org_name=org.name,
        org_address=org.address or "",
        org_registration_number=org.registration_number or "",
        generated_date=generated_at.strftime("%d. %m. %Y"),
    )

    return {
        "org": {
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "address": org.address,
            "registration_number": org.registration_number,
        },
        "dpa_html": dpa_html,
        "generated_at": generated_at.isoformat(),
    }
