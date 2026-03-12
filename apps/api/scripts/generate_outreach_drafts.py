#!/usr/bin/env python3
"""
Generate personalized email drafts for outreach campaign using Claude API.

Usage:
    python scripts/generate_outreach_drafts.py --campaign-id <uuid>
    python scripts/generate_outreach_drafts.py --campaign-id <uuid> --limit 20
    python scripts/generate_outreach_drafts.py --campaign-id <uuid> --regenerate  # re-generate existing drafts

Requires:
    ANTHROPIC_API_KEY env variable
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

import anthropic
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.app.core.config import settings
from src.app.models.outreach import OutreachCampaign, OutreachEmail
from src.app.models.registered_shelter import RegisteredShelter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# Default prompt used when campaign has no body_template
DEFAULT_PROMPT = """Napiš personalizovaný email na útulok pro zvířata.

Informace o útulku:
- Název: {shelter_name}
- Region: {shelter_region}
- Adresa: {shelter_address}
- Druhy zvířat: {shelter_species}
- Web: {shelter_website}

Předmět emailu (šablona): {subject_template}

Požadavky na email:
- Piš česky, přátelsky ale profesionálně
- Email by měl být krátký (200-300 slov)
- Zmíň, že PawShelter/SQLpet je česká aplikace přímo pro útulky
- Zdůrazni klíčové benefity: správa zvířat, evidence krmení/léků, adoptivní proces, mobilní app pro dobrovolníky
- Nezmiňuj cenu – první fáze je bezplatná
- Zakončit výzvou k akci: "Rádi vám ukážeme demo zdarma" nebo odkaz na registraci
- Podpis: Petr Šimek, zakladatel PawShelter (pets-log.com)

Vrať POUZE tělo emailu v prostém textu (bez hlavičky předmětu, bez markdown formátování).
"""


async def generate_draft(
    client: anthropic.AsyncAnthropic,
    campaign: OutreachCampaign,
    shelter: RegisteredShelter,
) -> tuple[str, str]:
    """Generate subject + body for one shelter. Returns (subject, body)."""

    species_parts = []
    if getattr(shelter, "accepts_dogs", None):
        species_parts.append("psi")
    if getattr(shelter, "accepts_cats", None):
        species_parts.append("kočky")
    species_str = ", ".join(species_parts) if species_parts else "neurčeno"

    # Fill subject template
    subject = campaign.subject_template.format(
        shelter_name=shelter.name,
        shelter_region=shelter.region or "",
    )

    prompt_template = campaign.body_template or DEFAULT_PROMPT
    prompt = prompt_template.format(
        shelter_name=shelter.name,
        shelter_region=shelter.region or "neurčen",
        shelter_address=shelter.address or "neurčena",
        shelter_species=species_str,
        shelter_website=shelter.website or "neuvedeno",
        subject_template=subject,
    )

    message = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    body = message.content[0].text.strip()
    return subject, body


async def run(campaign_id: uuid.UUID, limit: int, regenerate: bool) -> None:
    database_url = settings.DATABASE_URL_ASYNC
    if not database_url:
        log.error("DATABASE_URL_ASYNC not set")
        sys.exit(1)

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        log.error("ANTHROPIC_API_KEY not set")
        sys.exit(1)

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    client = anthropic.AsyncAnthropic(api_key=anthropic_key)

    async with async_session() as db:
        # Load campaign
        campaign = await db.get(OutreachCampaign, campaign_id)
        if not campaign:
            log.error("Campaign %s not found", campaign_id)
            sys.exit(1)
        log.info("Campaign: %s (status=%s)", campaign.name, campaign.status)

        # Find shelters that need a draft
        # Shelters with email AND not yet contacted in this campaign
        existing_q = select(OutreachEmail.shelter_id).where(
            OutreachEmail.campaign_id == campaign_id
        )
        if not regenerate:
            # Only process shelters not yet in this campaign
            shelters_q = (
                select(RegisteredShelter)
                .where(
                    RegisteredShelter.id.not_in(existing_q),
                    RegisteredShelter.email.isnot(None),
                )
                .limit(limit)
            )
        else:
            # Re-generate only existing "pending" or "draft" ones
            to_regen_q = (
                select(OutreachEmail)
                .where(
                    OutreachEmail.campaign_id == campaign_id,
                    OutreachEmail.status.in_(("pending", "draft")),
                )
                .limit(limit)
            )
            to_regen = (await db.execute(to_regen_q)).scalars().all()
            shelter_ids = [e.shelter_id for e in to_regen]
            shelters_q = select(RegisteredShelter).where(
                RegisteredShelter.id.in_(shelter_ids)
            )

        shelters = (await db.execute(shelters_q)).scalars().all()
        log.info("Found %d shelters to process", len(shelters))

        if not shelters:
            log.info("Nothing to do.")
            return

        # Pre-load existing OutreachEmail records for regenerate mode
        existing_emails: dict[uuid.UUID, OutreachEmail] = {}
        if regenerate:
            for e in to_regen:
                existing_emails[e.shelter_id] = e

        stats = {"generated": 0, "failed": 0}
        start = time.monotonic()

        for i, shelter in enumerate(shelters, 1):
            log.info("[%d/%d] Generating for: %s", i, len(shelters), shelter.name)
            try:
                subject, body = await generate_draft(client, campaign, shelter)

                if regenerate and shelter.id in existing_emails:
                    email_obj = existing_emails[shelter.id]
                    email_obj.generated_subject = subject
                    email_obj.generated_body = body
                    email_obj.status = "draft"
                    email_obj.generation_attempts += 1
                    email_obj.error_message = None
                else:
                    email_obj = OutreachEmail(
                        campaign_id=campaign_id,
                        shelter_id=shelter.id,
                        status="draft",
                        generated_subject=subject,
                        generated_body=body,
                        generation_attempts=1,
                    )
                    db.add(email_obj)

                stats["generated"] += 1
                log.info("  ✓ Generated (%d tokens used)", len(body.split()))

                # Flush every 10 to avoid large transactions
                if i % 10 == 0:
                    await db.flush()
                    log.info("  [flush] %d drafts saved so far", stats["generated"])

                # Small delay to avoid rate limits
                await asyncio.sleep(0.5)

            except Exception as e:
                log.error("  ✗ Failed for %s: %s", shelter.name, e)
                stats["failed"] += 1
                # Save error
                if regenerate and shelter.id in existing_emails:
                    existing_emails[shelter.id].error_message = str(e)
                    existing_emails[shelter.id].generation_attempts += 1
                else:
                    db.add(OutreachEmail(
                        campaign_id=campaign_id,
                        shelter_id=shelter.id,
                        status="pending",
                        error_message=str(e),
                        generation_attempts=1,
                    ))

        # Update campaign total_targets
        campaign.total_targets = (
            (await db.execute(
                select(OutreachEmail.id).where(OutreachEmail.campaign_id == campaign_id)
            )).scalars()
        ).__length_hint__() or campaign.total_targets

        await db.commit()

        elapsed = time.monotonic() - start
        log.info(
            "\nDone in %.1fs — generated: %d, failed: %d",
            elapsed, stats["generated"], stats["failed"]
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate outreach email drafts via Claude API")
    parser.add_argument("--campaign-id", required=True, help="UUID of the outreach campaign")
    parser.add_argument("--limit", type=int, default=50, help="Max number of shelters to process")
    parser.add_argument("--regenerate", action="store_true", help="Re-generate existing pending/draft emails")
    args = parser.parse_args()

    try:
        campaign_id = uuid.UUID(args.campaign_id)
    except ValueError:
        log.error("Invalid campaign-id UUID: %s", args.campaign_id)
        sys.exit(1)

    asyncio.run(run(campaign_id, args.limit, args.regenerate))


if __name__ == "__main__":
    main()
