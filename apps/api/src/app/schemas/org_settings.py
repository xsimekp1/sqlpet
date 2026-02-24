"""Org settings Pydantic schemas and helpers."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

from src.app.models.organization import Organization


class LegalRuleConfig(BaseModel):
    start: Literal["announced", "received", "found"]
    fallback_start: Literal["found", "received"] = "found"
    days: int
    cz_later_of_announced_received: bool = False


class OrgSettingsLegal(BaseModel):
    profile: Literal["CZ", "SK", "OTHER"] = "CZ"
    rules: dict[str, LegalRuleConfig] = Field(
        default_factory=lambda: {
            "finder_keeps": LegalRuleConfig(
                start="announced",
                fallback_start="found",
                days=60,
            ),
            "custody": LegalRuleConfig(
                start="received",
                fallback_start="found",
                days=120,
                cz_later_of_announced_received=True,
            ),
        }
    )


_LEGAL_DEFAULTS: dict[str, dict] = {
    "CZ": {
        "finder_keeps": {
            "start": "announced",
            "fallback_start": "found",
            "days": 60,
            "cz_later_of_announced_received": False,
        },
        "custody": {
            "start": "received",
            "fallback_start": "found",
            "days": 120,
            "cz_later_of_announced_received": True,
        },
    },
    "SK": {
        "finder_keeps": {
            "start": "announced",
            "fallback_start": "found",
            "days": 60,
            "cz_later_of_announced_received": False,
        },
        "custody": {
            "start": "received",
            "fallback_start": "found",
            "days": 90,
            "cz_later_of_announced_received": False,
        },
    },
    "OTHER": {
        "finder_keeps": {
            "start": "announced",
            "fallback_start": "found",
            "days": 60,
            "cz_later_of_announced_received": False,
        },
        "custody": {
            "start": "received",
            "fallback_start": "found",
            "days": 90,
            "cz_later_of_announced_received": False,
        },
    },
}


def default_legal_rules_for_profile(profile: str) -> dict[str, LegalRuleConfig]:
    """Return default legal rules for a given profile (CZ/SK/OTHER)."""
    raw = _LEGAL_DEFAULTS.get(profile, _LEGAL_DEFAULTS["OTHER"])
    return {k: LegalRuleConfig(**v) for k, v in raw.items()}


class OrgSettingsUnits(BaseModel):
    system: Literal["metric", "imperial"] = "metric"
    inventory_decimal_places: int = 2


class OrgSettings(BaseModel):
    locale_default: str = "cs"
    timezone: str = "Europe/Prague"
    time_format: Literal["24h", "12h"] = "24h"
    date_format: str = "dd.MM.yyyy"
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_web: Optional[str] = None
    org_address: Optional[dict] = None  # {street, city, zip, country}
    units: OrgSettingsUnits = Field(default_factory=OrgSettingsUnits)
    legal: OrgSettingsLegal = Field(default_factory=OrgSettingsLegal)


def get_org_settings(org: Organization) -> OrgSettings:
    """Parse org.settings JSONB into OrgSettings, filling defaults for missing keys."""
    if not org.settings:
        return OrgSettings()
    return OrgSettings.model_validate(org.settings)
