"""Legal deadline computation for found animals.

Czech law: 2 months from notice publication if finder claims ownership,
4 months from notice/shelter transfer if municipality irrevocably transfers,
4 months from notice if finder directly hands animal to shelter after notice.
"""

from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from src.app.schemas.org_settings import OrgSettingsLegal


@dataclass
class LegalDeadlineInfo:
    """Computed legal deadline information for a found animal intake."""

    deadline_at: Optional[date]
    deadline_type: str  # "2m_notice" | "4m_transfer" | "4m_notice" | "unknown"
    days_left: Optional[int]
    deadline_state: str  # "running" | "expired" | "missing_data"
    label: str
    missing_fields: list[str]


def compute_legal_deadline(
    notice_published_at: Optional[date],
    shelter_received_at: Optional[date],  # = intake_date
    finder_claims_ownership: Optional[bool],
    municipality_irrevocably_transferred: Optional[bool],
) -> LegalDeadlineInfo:
    """
    Compute legal deadline for found animal based on Czech law.

    Scenario A (2 months): finder_claims_ownership = True
        Deadline: 2 months from notice_published_at
        Requires: notice_published_at

    Scenario B (4 months, municipality): finder_claims_ownership = False AND
        municipality_irrevocably_transferred = True
        Deadline: 4 months from later of (notice_published_at, shelter_received_at)
        Requires: either notice_published_at OR shelter_received_at

    Scenario C (4 months, direct handover): finder_claims_ownership = False AND
        notice_published_at is set AND municipality_irrevocably_transferred != True
        Covers: finder originally kept animal (notice already published), then brought
        it directly to shelter. The total legal period is still 4 months from original
        publication — the shelter receives the animal mid-period.
        Deadline: 4 months from notice_published_at

    Returns:
        LegalDeadlineInfo with computed deadline and state
    """
    missing_fields = []

    # Check if this is a found animal intake
    # If finder_claims_ownership is None and municipality_irrevocably_transferred is None,
    # we can't compute anything
    if finder_claims_ownership is None and municipality_irrevocably_transferred is None:
        return LegalDeadlineInfo(
            deadline_at=None,
            deadline_type="unknown",
            days_left=None,
            deadline_state="missing_data",
            label="Není nálezové zvíře",
            missing_fields=[
                "finder_claims_ownership",
                "municipality_irrevocably_transferred",
            ],
        )

    # Scenario A: Finder wants to claim ownership (2 months from notice)
    if finder_claims_ownership is True:
        if notice_published_at is None:
            missing_fields.append("notice_published_at")
            return LegalDeadlineInfo(
                deadline_at=None,
                deadline_type="2m_notice",
                days_left=None,
                deadline_state="missing_data",
                label="Chybí datum vyhlášení",
                missing_fields=missing_fields,
            )

        deadline_at = _add_months(notice_published_at, 2)
        return _build_deadline_info(
            deadline_at=deadline_at,
            deadline_type="2m_notice",
            label_base="2 měsíce od vyhlášení",
        )

    # Scenario B: Finder doesn't want, municipality transferred irrevocably (4 months)
    if municipality_irrevocably_transferred is True:
        # Use later of notice_published_at or shelter_received_at
        reference_date = notice_published_at
        if shelter_received_at and (
            reference_date is None or shelter_received_at > reference_date
        ):
            reference_date = shelter_received_at

        if reference_date is None:
            missing_fields.append("notice_published_at")
            if shelter_received_at is None:
                missing_fields.append("shelter_received_at")
            return LegalDeadlineInfo(
                deadline_at=None,
                deadline_type="4m_transfer",
                days_left=None,
                deadline_state="missing_data",
                label="Chybí datum vyhlášení nebo převzetí",
                missing_fields=missing_fields,
            )

        deadline_at = _add_months(reference_date, 4)
        return _build_deadline_info(
            deadline_at=deadline_at,
            deadline_type="4m_transfer",
            label_base="4 měsíce od převzetí",
        )

    # Scenario C: Finder directly handed animal to shelter after notice was already published.
    # The finder originally kept the animal (notice published), then changed their mind.
    # Czech law: total adoption period = 4 months from original publication date.
    if finder_claims_ownership is False and notice_published_at is not None:
        deadline_at = _add_months(notice_published_at, 4)
        return _build_deadline_info(
            deadline_at=deadline_at,
            deadline_type="4m_notice",
            label_base="4 měsíce od vyhlášení (přímé předání)",
        )

    # Neither scenario applies - finder doesn't want, municipality hasn't transferred,
    # and no notice date is known
    return LegalDeadlineInfo(
        deadline_at=None,
        deadline_type="unknown",
        days_left=None,
        deadline_state="running",
        label="Bez lhůty (nálezce nechce, obec nepřevedla)",
        missing_fields=[],
    )


def compute_legal_deadline_from_settings(
    announced_at: Optional[date],
    received_at: Optional[date],
    found_at: Optional[date],
    finder_keeps: Optional[bool],
    org_legal: "OrgSettingsLegal",
) -> LegalDeadlineInfo:
    """Configurable version of compute_legal_deadline that reads rules from org settings.

    Falls back gracefully when required dates are missing.
    """
    from src.app.schemas.org_settings import OrgSettingsLegal  # local import to avoid circular

    rule_key = "finder_keeps" if finder_keeps else "custody"
    rule = org_legal.rules.get(rule_key)
    if not rule:
        return LegalDeadlineInfo(
            deadline_at=None,
            deadline_type="unknown",
            days_left=None,
            deadline_state="missing_data",
            label="Není nálezové zvíře",
            missing_fields=[rule_key],
        )

    start_date = _resolve_start_date(
        rule_start=rule.start,
        fallback_start=rule.fallback_start,
        announced_at=announced_at,
        received_at=received_at,
        found_at=found_at,
        cz_later_of=rule.cz_later_of_announced_received,
    )

    if start_date is None:
        missing = []
        if rule.start == "announced" and announced_at is None:
            missing.append("announced_at")
        if rule.start == "received" and received_at is None:
            missing.append("received_at")
        if not missing:
            missing.append(rule.fallback_start)
        return LegalDeadlineInfo(
            deadline_at=None,
            deadline_type=rule_key,
            days_left=None,
            deadline_state="missing_data",
            label="Chybí startovní datum",
            missing_fields=missing,
        )

    deadline_at = _add_months(start_date, rule.days // 30) if rule.days % 30 == 0 else _add_days(start_date, rule.days)
    label_base = f"{rule.days} dní od " + ("vyhlášení" if rule.start == "announced" else "přijetí")
    return _build_deadline_info(
        deadline_at=deadline_at,
        deadline_type=rule_key,
        label_base=label_base,
    )


def _resolve_start_date(
    rule_start: str,
    fallback_start: str,
    announced_at: Optional[date],
    received_at: Optional[date],
    found_at: Optional[date],
    cz_later_of: bool,
) -> Optional[date]:
    """Resolve which date to use as the start for the deadline calculation."""
    _date_map = {
        "announced": announced_at,
        "received": received_at,
        "found": found_at,
    }

    primary = _date_map.get(rule_start)
    fallback = _date_map.get(fallback_start)

    if cz_later_of and announced_at and received_at:
        # CZ rule: start from the LATER of announced_at and received_at
        return max(announced_at, received_at)

    if primary is not None:
        return primary
    return fallback


def _add_days(d: date, days: int) -> date:
    """Add N days to a date."""
    from datetime import timedelta
    return d + timedelta(days=days)


def _add_months(d: date, months: int) -> date:
    """Add N calendar months to a date, clamping to last day of target month if needed."""
    # Shift month index to 0-based for arithmetic, then convert back
    zero_based = d.month - 1 + months
    target_year = d.year + zero_based // 12
    target_month = zero_based % 12 + 1
    last_day = monthrange(target_year, target_month)[1]
    return date(target_year, target_month, min(d.day, last_day))


def _build_deadline_info(
    deadline_at: date,
    deadline_type: str,
    label_base: str,
) -> LegalDeadlineInfo:
    """Build deadline info from computed deadline date."""
    today = date.today()
    days_left = (deadline_at - today).days

    if days_left < 0:
        state = "expired"
        label = f"Vypršelo {abs(days_left)} dní zpět"
    elif days_left == 0:
        state = "running"
        label = "Lhůta dnes končí"
    elif days_left <= 14:
        state = "running"
        label = f"Zbývá {days_left} dní"
    else:
        state = "running"
        label = f"Deadline: {deadline_at.strftime('%d.%m.%Y')}"

    return LegalDeadlineInfo(
        deadline_at=deadline_at,
        deadline_type=deadline_type,
        days_left=days_left,
        deadline_state=state,
        label=label,
        missing_fields=[],
    )
