"""
Fast timezone loading for animal shelter management.
Avoids slow pg_timezone_names queries with hardcoded relevant timezones.
"""

from typing import List, Tuple

# MVP: Fast timezone list focused on common shelter locations
SHELTER_TIMEZONES: List[Tuple[str, str]] = [
    # Czech/Slovak (primary market)
    ("Europe/Prague", "Praha (Brno, Ostrava)"),
    ("Europe/Bratislava", "Bratislava"),
    # Major European countries (shelters from these countries)
    ("Europe/London", "Londýn (UK)"),
    ("Europe/Berlin", "Berlín (Německo)"),
    ("Europe/Paris", "Paříž (Francie)"),
    ("Europe/Madrid", "Madrid (Španělsko)"),
    ("Europe/Rome", "Řím (Itálie)"),
    ("Europe/Warsaw", "Varšava (Polsko)"),
    ("Europe/Vienna", "Vídeň (Rakousko)"),
    ("Europe/Amsterdam", "Amsterdam (Nizozemsko)"),
    # North America (large shelters market)
    ("America/New_York", "New York (USA)"),
    ("America/Los_Angeles", "Los Angeles (USA)"),
    ("America/Chicago", "Chicago (USA)"),
    ("America/Denver", "Denver (USA)"),
    ("America/Toronto", "Toronto (Kanada)"),
    # Australia/New Zealand
    ("Australia/Sydney", "Sydney (Austrálie)"),
    ("Pacific/Auckland", "Auckland (Nový Zéland)"),
    # Asia (emerging markets)
    ("Asia/Tokyo", "Tokio (Japonsko)"),
    ("Asia/Singapore", "Singapur"),
    # UTC/GMT fallback
    ("UTC", "UTC (GMT)"),
]

# Legacy compatibility - simple string list
TIMEZONE_NAMES = [tz for tz, _ in SHELTER_TIMEZONES]


def get_timezone_display(timezone: str) -> str:
    """Get human-readable display name for timezone"""
    for tz_key, tz_display in SHELTER_TIMEZONES:
        if tz_key == timezone:
            return tz_display
    return timezone  # Fallback to original value


def get_timezone_by_country(country_code: str) -> List[str]:
    """Get timezones by country (simple mapping)"""
    country_map = {
        "CZ": ["Europe/Prague"],
        "SK": ["Europe/Bratislava"],
        "GB": ["Europe/London"],
        "DE": ["Europe/Berlin"],
        "FR": ["Europe/Paris"],
        "ES": ["Europe/Madrid"],
        "IT": ["Europe/Rome"],
        "PL": ["Europe/Warsaw"],
        "AT": ["Europe/Vienna"],
        "NL": ["Europe/Amsterdam"],
        "US": ["America/New_York", "America/Los_Angeles", "America/Chicago"],
        "CA": ["America/Toronto"],
        "AU": ["Australia/Sydney"],
        "NZ": ["Pacific/Auckland"],
        "JP": ["Asia/Tokyo"],
        "SG": ["Asia/Singapore"],
    }
    return country_map.get(country_code, ["Europe/Prague"])  # Default to Prague


def get_recommended_timezones() -> List[str]:
    """Get top 10 most relevant timezones for animal shelters"""
    return [
        "Europe/Prague",  # Primary market
        "Europe/Bratislava",  # Secondary market
        "Europe/London",  # UK
        "Europe/Berlin",  # Germany
        "America/New_York",  # USA East
        "Europe/Paris",  # France
        "Europe/Warsaw",  # Poland
        "America/Los_Angeles",  # USA West
        "Australia/Sydney",  # Australia
    ]
