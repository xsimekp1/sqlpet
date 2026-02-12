from fastapi import APIRouter, HTTPException
from typing import List, Dict
from src.app.utils.timezones import (
    SHELTER_TIMEZONES,
    get_timezone_display,
    get_recommended_timezones,
)

router = APIRouter(prefix="/timezones", tags=["timezones"])


@router.get("", response_model=List[Dict[str, str]])
async def get_timezones():
    """Get all available timezones for animal shelters"""
    return [
        {"value": tz_key, "display": tz_display}
        for tz_key, tz_display in SHELTER_TIMEZONES
    ]


@router.get("/recommended", response_model=List[Dict[str, str]])
async def get_recommended():
    """Get top 10 most relevant timezones"""
    recommended = get_recommended_timezones()
    return [{"value": tz, "display": get_timezone_display(tz)} for tz in recommended]


@router.get("/by-country/{country_code}", response_model=List[Dict[str, str]])
async def get_by_country(country_code: str):
    """Get timezones by country code"""
    from src.app.utils.timezones import get_timezone_by_country

    timezones = get_timezone_by_country(country_code.upper())
    return [{"value": tz, "display": get_timezone_display(tz)} for tz in timezones]
