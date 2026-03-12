#!/usr/bin/env python3
"""
Send approved outreach emails via Resend.

Usage:
    python scripts/send_outreach_emails.py --campaign-id <uuid>
    python scripts/send_outreach_emails.py --campaign-id <uuid> --dry-run   # preview only
    python scripts/send_outreach_emails.py --campaign-id <uuid> --limit 10

Requires:
    RESEND_API_KEY env variable
    DATABASE_URL_ASYNC env variable
"""

import argparse
import asyncio
import io
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone

# Force UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload

from src.app.core.config import settings
from src.app.models.outreach import OutreachCampaign, OutreachEmail
from src.app.models.registered_shelter import RegisteredShelter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_via_resend(
    http: httpx.AsyncClient,
    api_key: str,
    to_email: str,
    from_email: str,
    reply_to: str | None,
    subject: str,
    body_text: str,
) -> str:
    """Send email via Resend API. Returns message_id."""
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "text": body_text,
    }
    if reply_to:
        payload["reply_to"] = reply_to

    resp = await http.post(
        RESEND_API_URL,
        json=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("id", "")


async def run(campaign_id: uuid.UUID, limit: int, dry_run: bool) -> None:
    database_url = settings.DATABASE_URL_ASYNC
    if not database_url:
        log.error("DATABASE_URL_ASYNC not set")
        sys.exit(1)

    resend_key = os.environ.get("RESEND_API_KEY")
    if not resend_key:
        log.error("RESEND_API_KEY not set")
        sys.exit(1)

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        campaign = await db.get(OutreachCampaign, campaign_id)
        if not campaign:
            log.error("Campaign %s not found", campaign_id)
            sys.exit(1)

        if campaign.status != "active" and not dry_run:
            log.error("Campaign is not active (status=%s). Use --dry-run or set campaign active.", campaign.status)
            sys.exit(1)

        log.info("Campaign: %s (from=%s)", campaign.name, campaign.from_email)

        # Load approved emails
        emails_q = (
            select(OutreachEmail)
            .where(
                OutreachEmail.campaign_id == campaign_id,
                OutreachEmail.status == "approved",
            )
            .options(selectinload(OutreachEmail.shelter))
            .limit(limit)
        )
        emails = (await db.execute(emails_q)).scalars().all()
        log.info("Found %d approved emails to send", len(emails))

        if not emails:
            log.info("Nothing to send.")
            return

        stats = {"sent": 0, "failed": 0, "skipped_no_email": 0}
        start = time.monotonic()

        async with httpx.AsyncClient() as http:
            for i, email_obj in enumerate(emails, 1):
                shelter = email_obj.shelter
                shelter_email = getattr(shelter, "email", None)

                if not shelter_email:
                    log.warning("[%d/%d] Skipping %s — no email address", i, len(emails), shelter.name)
                    email_obj.status = "skipped"
                    email_obj.error_message = "No email address"
                    stats["skipped_no_email"] += 1
                    continue

                log.info("[%d/%d] %s → %s", i, len(emails), shelter.name, shelter_email)
                log.info("  Subject: %s", email_obj.generated_subject)

                if dry_run:
                    log.info("  [DRY RUN] Would send — skipping actual delivery")
                    stats["sent"] += 1
                    continue

                try:
                    msg_id = await send_via_resend(
                        http=http,
                        api_key=resend_key,
                        to_email=shelter_email,
                        from_email=campaign.from_email,
                        reply_to=campaign.reply_to,
                        subject=email_obj.generated_subject,
                        body_text=email_obj.generated_body,
                    )
                    email_obj.status = "sent"
                    email_obj.sent_at = datetime.now(timezone.utc)
                    email_obj.resend_message_id = msg_id
                    campaign.sent_count = (campaign.sent_count or 0) + 1
                    stats["sent"] += 1
                    log.info("  ✓ Sent (msg_id=%s)", msg_id)

                except Exception as e:
                    log.error("  ✗ Failed: %s", e)
                    email_obj.error_message = str(e)
                    stats["failed"] += 1

                # Flush every 5
                if i % 5 == 0:
                    await db.flush()

                # Rate limit: Resend free tier = 100 emails/day, 2/sec
                await asyncio.sleep(0.6)

        if not dry_run:
            await db.commit()

        elapsed = time.monotonic() - start
        log.info(
            "\n%sDone in %.1fs — sent: %d, failed: %d, skipped: %d",
            "[DRY RUN] " if dry_run else "",
            elapsed, stats["sent"], stats["failed"], stats["skipped_no_email"]
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Send approved outreach emails via Resend")
    parser.add_argument("--campaign-id", required=True, help="UUID of the outreach campaign")
    parser.add_argument("--limit", type=int, default=100, help="Max emails to send per run")
    parser.add_argument("--dry-run", action="store_true", help="Preview only — do not send")
    args = parser.parse_args()

    try:
        campaign_id = uuid.UUID(args.campaign_id)
    except ValueError:
        log.error("Invalid campaign-id UUID: %s", args.campaign_id)
        sys.exit(1)

    asyncio.run(run(campaign_id, args.limit, args.dry_run))


if __name__ == "__main__":
    main()
