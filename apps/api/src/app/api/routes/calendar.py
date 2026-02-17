"""API routes for calendar - optimized event fetching."""

import uuid
from datetime import date
from calendar import monthrange

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.models.user import User


router = APIRouter(prefix="/calendar", tags=["calendar"])


class CalendarIntakeEvent(BaseModel):
    date: str
    animal_id: str
    animal_name: str
    animal_photo_url: Optional[str] = None


class CalendarLitterEvent(BaseModel):
    date: str
    animal_id: str
    animal_name: str
    animal_photo_url: Optional[str] = None


class CalendarEscapeEvent(BaseModel):
    date: str
    animal_id: str
    animal_name: str
    animal_photo_url: Optional[str] = None


class CalendarOutcomeEvent(BaseModel):
    date: str
    animal_id: str
    animal_name: str
    animal_photo_url: Optional[str] = None
    outcome_type: str  # 'adopted', 'returned_to_owner', etc.


class CalendarEventsResponse(BaseModel):
    intakes: List[CalendarIntakeEvent]
    litters: List[CalendarLitterEvent]
    escapes: List[CalendarEscapeEvent]
    outcomes: List[CalendarOutcomeEvent]


@router.get("/events", response_model=CalendarEventsResponse)
async def get_calendar_events(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all calendar events for a given month in a single optimized request.

    Returns:
        - intakes: Animals with intake_date in the month
        - litters: Pregnant animals with expected_litter_date in the month
        - escapes: Escape incidents in the month
        - outcomes: Planned/actual outcomes in the month

    This replaces 3 separate API calls (animals, incidents, intakes).
    """
    # Calculate month date range
    start_date = date(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = date(year, month, last_day)

    org_id_str = str(organization_id)

    # 1. Get intakes for the month (intake_date)
    intakes_result = await db.execute(
        text("""
            SELECT 
                i.intake_date::text,
                a.id::text,
                a.name,
                a.primary_photo_url
            FROM intakes i
            JOIN animals a ON a.id = i.animal_id
            WHERE i.organization_id = :org_id
              AND i.deleted_at IS NULL
              AND i.intake_date >= :start_date
              AND i.intake_date <= :end_date
            ORDER BY i.intake_date ASC
        """),
        {"org_id": org_id_str, "start_date": start_date, "end_date": end_date},
    )
    intakes = [
        CalendarIntakeEvent(
            date=row[0],
            animal_id=row[1],
            animal_name=row[2],
            animal_photo_url=row[3],
        )
        for row in intakes_result.fetchall()
    ]

    # 2. Get expected litters for the month
    litters_result = await db.execute(
        text("""
            SELECT 
                a.expected_litter_date::text,
                a.id::text,
                a.name,
                a.primary_photo_url
            FROM animals a
            WHERE a.organization_id = :org_id
              AND a.deleted_at IS NULL
              AND a.is_pregnant = true
              AND a.sex = 'female'
              AND a.expected_litter_date >= :start_date
              AND a.expected_litter_date <= :end_date
            ORDER BY a.expected_litter_date ASC
        """),
        {"org_id": org_id_str, "start_date": start_date, "end_date": end_date},
    )
    litters = [
        CalendarLitterEvent(
            date=row[0],
            animal_id=row[1],
            animal_name=row[2],
            animal_photo_url=row[3],
        )
        for row in litters_result.fetchall()
    ]

    # 3. Get escape incidents for the month
    escapes_result = await db.execute(
        text("""
            SELECT 
                i.incident_date::text,
                i.animal_id::text,
                a.name,
                a.primary_photo_url
            FROM incidents i
            JOIN animals a ON a.id = i.animal_id
            WHERE i.organization_id = :org_id
              AND i.incident_type = 'escape'
              AND i.incident_date >= :start_date
              AND i.incident_date <= :end_date
            ORDER BY i.incident_date ASC
        """),
        {"org_id": org_id_str, "start_date": start_date, "end_date": end_date},
    )
    escapes = [
        CalendarEscapeEvent(
            date=row[0],
            animal_id=row[1],
            animal_name=row[2],
            animal_photo_url=row[3],
        )
        for row in escapes_result.fetchall()
    ]

    # 4. Get planned and actual outcomes for the month
    outcomes_result = await db.execute(
        text("""
            SELECT 
                COALESCE(i.planned_outcome_date, i.actual_outcome_date)::text,
                a.id::text,
                a.name,
                a.primary_photo_url,
                CASE 
                    WHEN i.actual_outcome_date IS NOT NULL THEN 'actual'
                    ELSE 'planned'
                END as outcome_type
            FROM intakes i
            JOIN animals a ON a.id = i.animal_id
            WHERE i.organization_id = :org_id
              AND i.deleted_at IS NULL
              AND (
                (i.planned_outcome_date >= :start_date AND i.planned_outcome_date <= :end_date)
                OR
                (i.actual_outcome_date >= :start_date AND i.actual_outcome_date <= :end_date)
              )
            ORDER BY COALESCE(i.planned_outcome_date, i.actual_outcome_date) ASC
        """),
        {"org_id": org_id_str, "start_date": start_date, "end_date": end_date},
    )
    outcomes = [
        CalendarOutcomeEvent(
            date=row[0],
            animal_id=row[1],
            animal_name=row[2],
            animal_photo_url=row[3],
            outcome_type=row[4],
        )
        for row in outcomes_result.fetchall()
    ]

    return CalendarEventsResponse(
        intakes=intakes,
        litters=litters,
        escapes=escapes,
        outcomes=outcomes,
    )
