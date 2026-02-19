"""API routes for hotel reservations."""

import enum
import uuid
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.hotel_reservation import HotelReservation, HotelReservationStatus
from src.app.models.intake import Intake, IntakeReason
from src.app.models.user import User
from src.app.models.animal import Animal, AnimalStatus
from src.app.models.kennel import Kennel

router = APIRouter(prefix="/hotel/reservations", tags=["hotel_reservations"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class HotelReservationCreate(BaseModel):
    kennel_id: str
    contact_id: Optional[str] = None
    animal_name: str
    animal_species: str
    animal_breed: Optional[str] = None
    animal_notes: Optional[str] = None
    reserved_from: date
    reserved_to: date
    price_per_day: Optional[float] = None
    requires_single_cage: bool = False
    own_food: bool = False
    notes: Optional[str] = None

    @field_validator("reserved_to")
    @classmethod
    def validate_dates(cls, v, info):
        if "reserved_from" in info.data and v < info.data["reserved_from"]:
            raise ValueError("reserved_to must be after reserved_from")
        return v


class HotelReservationUpdate(BaseModel):
    kennel_id: Optional[str] = None
    contact_id: Optional[str] = None
    animal_name: Optional[str] = None
    animal_species: Optional[str] = None
    animal_breed: Optional[str] = None
    animal_notes: Optional[str] = None
    reserved_from: Optional[date] = None
    reserved_to: Optional[date] = None
    price_per_day: Optional[float] = None
    total_price: Optional[float] = None
    is_paid: Optional[bool] = None
    requires_single_cage: Optional[bool] = None
    own_food: Optional[bool] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class HotelReservationResponse(BaseModel):
    id: str
    organization_id: str
    kennel_id: str
    kennel_name: Optional[str] = None
    contact_id: Optional[str]
    animal_name: str
    animal_species: str
    animal_breed: Optional[str]
    animal_notes: Optional[str]
    reserved_from: date
    reserved_to: date
    price_per_day: Optional[float]
    total_price: Optional[float]
    is_paid: bool
    requires_single_cage: bool
    own_food: bool
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KennelAvailabilityResponse(BaseModel):
    kennel_id: str
    from_date: date
    to_date: date
    is_available: bool
    blocking_reservations: list[dict] = []
    blocking_intakes: list[dict] = []


# ── Helpers ──────────────────────────────────────────────────────────────────


def _to_response(r: HotelReservation, kennel_name: str = None) -> dict:
    return {
        "id": str(r.id),
        "organization_id": str(r.organization_id),
        "kennel_id": str(r.kennel_id),
        "kennel_name": kennel_name,
        "contact_id": str(r.contact_id) if r.contact_id else None,
        "animal_name": r.animal_name,
        "animal_species": r.animal_species,
        "animal_breed": r.animal_breed,
        "animal_notes": r.animal_notes,
        "reserved_from": r.reserved_from,
        "reserved_to": r.reserved_to,
        "price_per_day": float(r.price_per_day) if r.price_per_day else None,
        "total_price": float(r.total_price) if r.total_price else None,
        "is_paid": r.is_paid,
        "requires_single_cage": r.requires_single_cage,
        "own_food": r.own_food,
        "status": r.status,
        "notes": r.notes,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


@router.get("", response_model=list[HotelReservationResponse])
async def list_reservations(
    status_filter: Optional[str] = Query(None, alias="status"),
    kennel_id: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List hotel reservations for the organization."""
    from src.app.models.kennel import Kennel

    q = select(HotelReservation).where(
        HotelReservation.organization_id == organization_id
    )

    if status_filter:
        q = q.where(HotelReservation.status == status_filter)
    if kennel_id:
        q = q.where(HotelReservation.kennel_id == uuid.UUID(kennel_id))
    if from_date:
        q = q.where(HotelReservation.reserved_to >= from_date)
    if to_date:
        q = q.where(HotelReservation.reserved_from <= to_date)

    q = q.order_by(HotelReservation.reserved_from.desc())
    result = await db.execute(q)
    reservations = result.scalars().all()

    # Get kennel names
    kennel_ids = [r.kennel_id for r in reservations]
    kennel_names = {}
    if kennel_ids:
        kennel_result = await db.execute(
            select(Kennel.id, Kennel.name).where(Kennel.id.in_(kennel_ids))
        )
        for row in kennel_result.all():
            kennel_names[str(row[0])] = row[1]

    return [_to_response(r, kennel_names.get(str(r.kennel_id))) for r in reservations]


# Timeline endpoint - must be defined BEFORE /{reservation_id} routes
class TimelineEntry(BaseModel):
    date: date
    kennel_id: str
    kennel_name: str
    reservation_id: Optional[str] = None
    animal_name: Optional[str] = None
    species: Optional[str] = None
    status: Optional[str] = None
    entry_type: str  # 'reservation' or 'empty'


class HotelTimelineResponse(BaseModel):
    start_date: date
    end_date: date
    kennels: list[dict]
    timeline: list[TimelineEntry]


@router.get("/timeline", response_model=HotelTimelineResponse)
async def get_hotel_timeline(
    start_date_str: Optional[str] = Query(None, alias="start_date"),
    end_date_str: Optional[str] = Query(None, alias="end_date"),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get hotel timeline view - reservations organized by date and kennel."""
    from src.app.models.kennel import Kennel

    # Parse dates from strings
    try:
        start_date = date.fromisoformat(start_date_str) if start_date_str else None
        end_date = date.fromisoformat(end_date_str) if end_date_str else None
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use YYYY-MM-DD"
        )

    # Default to current month
    if not start_date:
        today = date.today()
        start_date = today.replace(day=1)
    if not end_date:
        end_date = start_date.replace(
            month=start_date.month % 12 + 1, day=1
        ) - timedelta(days=1)

    # Get all kennels for the organization (using SoftDeleteMixin - deleted_at is null)
    kennel_result = await db.execute(
        select(Kennel)
        .where(
            Kennel.organization_id == organization_id,
            Kennel.deleted_at.is_(None),
        )
        .order_by(Kennel.name)
    )
    kennels = kennel_result.scalars().all()

    # Get all reservations in date range
    reservations_result = await db.execute(
        select(HotelReservation).where(
            HotelReservation.organization_id == organization_id,
            HotelReservation.reserved_from <= end_date,
            HotelReservation.reserved_to >= start_date,
        )
    )
    reservations = reservations_result.scalars().all()

    # Generate timeline entries for each day
    timeline = []
    current = start_date
    while current <= end_date:
        for kennel in kennels:
            res = next(
                (
                    r
                    for r in reservations
                    if str(r.kennel_id) == str(kennel.id)
                    and r.reserved_from <= current <= r.reserved_to
                ),
                None,
            )

            if res:
                timeline.append(
                    TimelineEntry(
                        date=current,
                        kennel_id=str(kennel.id),
                        kennel_name=kennel.name,
                        reservation_id=str(res.id),
                        animal_name=res.animal_name,
                        species=res.animal_species,
                        status=res.status,
                        entry_type="reservation",
                    )
                )
            else:
                timeline.append(
                    TimelineEntry(
                        date=current,
                        kennel_id=str(kennel.id),
                        kennel_name=kennel.name,
                        entry_type="empty",
                    )
                )
        current += timedelta(days=1)

    kennels_list = [{"id": str(k.id), "name": k.name} for k in kennels]

    return {
        "start_date": start_date,
        "end_date": end_date,
        "kennels": kennels_list,
        "timeline": timeline,
    }


@router.post(
    "", response_model=HotelReservationResponse, status_code=status.HTTP_201_CREATED
)
async def create_reservation(
    data: HotelReservationCreate,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new hotel reservation."""
    try:
        kennel_uuid = uuid.UUID(data.kennel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid kennel_id")

    # Check kennel exists and belongs to org
    from src.app.models.kennel import Kennel

    kennel_result = await db.execute(
        select(Kennel).where(
            Kennel.id == kennel_uuid,
            Kennel.organization_id == organization_id,
        )
    )
    kennel = kennel_result.scalar_one_or_none()
    if not kennel:
        raise HTTPException(status_code=404, detail="Kennel not found")

    # Check availability
    conflict_result = await db.execute(
        select(HotelReservation).where(
            HotelReservation.kennel_id == kennel_uuid,
            HotelReservation.status.in_(
                [
                    HotelReservationStatus.PENDING.value,
                    HotelReservationStatus.CONFIRMED.value,
                ]
            ),
            HotelReservation.reserved_from <= data.reserved_to,
            HotelReservation.reserved_to >= data.reserved_from,
        )
    )
    if conflict_result.scalars().first():
        raise HTTPException(
            status_code=409, detail="Kennel is not available for selected dates"
        )

    # Calculate total price
    days = (data.reserved_to - data.reserved_from).days + 1
    total_price = data.price_per_day * days if data.price_per_day else None

    reservation = HotelReservation(
        organization_id=organization_id,
        kennel_id=kennel_uuid,
        contact_id=uuid.UUID(data.contact_id) if data.contact_id else None,
        animal_name=data.animal_name,
        animal_species=data.animal_species,
        animal_breed=data.animal_breed,
        animal_notes=data.animal_notes,
        reserved_from=data.reserved_from,
        reserved_to=data.reserved_to,
        price_per_day=data.price_per_day,
        total_price=total_price,
        requires_single_cage=data.requires_single_cage,
        notes=data.notes,
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return _to_response(reservation)


@router.get("/{reservation_id}", response_model=HotelReservationResponse)
async def get_reservation(
    reservation_id: str,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a hotel reservation by ID."""
    try:
        reservation_uuid = uuid.UUID(reservation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reservation_id")

    result = await db.execute(
        select(HotelReservation).where(
            HotelReservation.id == reservation_uuid,
            HotelReservation.organization_id == organization_id,
        )
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    return _to_response(reservation)


@router.put("/{reservation_id}", response_model=HotelReservationResponse)
async def update_reservation(
    reservation_id: str,
    data: HotelReservationUpdate,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a hotel reservation."""
    try:
        reservation_uuid = uuid.UUID(reservation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reservation_id")

    result = await db.execute(
        select(HotelReservation).where(
            HotelReservation.id == reservation_uuid,
            HotelReservation.organization_id == organization_id,
        )
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if data.kennel_id:
        reservation.kennel_id = uuid.UUID(data.kennel_id)
    if data.contact_id is not None:
        reservation.contact_id = uuid.UUID(data.contact_id) if data.contact_id else None
    if data.animal_name:
        reservation.animal_name = data.animal_name
    if data.animal_species:
        reservation.animal_species = data.animal_species
    if data.animal_breed is not None:
        reservation.animal_breed = data.animal_breed
    if data.animal_notes is not None:
        reservation.animal_notes = data.animal_notes
    if data.reserved_from:
        reservation.reserved_from = data.reserved_from
    if data.reserved_to:
        reservation.reserved_to = data.reserved_to
    if data.price_per_day is not None:
        reservation.price_per_day = data.price_per_day
        if reservation.reserved_from and reservation.reserved_to:
            days = (reservation.reserved_to - reservation.reserved_from).days + 1
            reservation.total_price = data.price_per_day * days
    if data.total_price is not None:
        reservation.total_price = data.total_price
    if data.is_paid is not None:
        reservation.is_paid = data.is_paid
    if data.requires_single_cage is not None:
        reservation.requires_single_cage = data.requires_single_cage
    if data.status:
        reservation.status = data.status
    if data.notes is not None:
        reservation.notes = data.notes

    await db.commit()
    await db.refresh(reservation)
    return _to_response(reservation)


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reservation(
    reservation_id: str,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a hotel reservation."""
    try:
        reservation_uuid = uuid.UUID(reservation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reservation_id")

    result = await db.execute(
        select(HotelReservation).where(
            HotelReservation.id == reservation_uuid,
            HotelReservation.organization_id == organization_id,
        )
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    reservation.status = HotelReservationStatus.CANCELLED.value
    await db.commit()


@router.post("/{reservation_id}/checkin", response_model=HotelReservationResponse)
async def checkin_reservation(
    reservation_id: str,
    intake_date: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Check in a hotel reservation - creates an intake record."""
    try:
        reservation_uuid = uuid.UUID(reservation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reservation_id")

    # Get reservation
    result = await db.execute(
        select(HotelReservation).where(
            HotelReservation.id == reservation_uuid,
            HotelReservation.organization_id == organization_id,
        )
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if reservation.status in [
        HotelReservationStatus.CANCELLED.value,
        HotelReservationStatus.CHECKED_OUT.value,
    ]:
        raise HTTPException(status_code=400, detail="Reservation is not active")

    # Create intake
    checkin_date = intake_date or date.today()
    intake = Intake(
        organization_id=organization_id,
        kennel_id=reservation.kennel_id,
        animal_id=None,  # Hotel animal - not from shelter
        reason=IntakeReason.HOTEL,
        intake_date=checkin_date,
        notes=f"Hotel reservation: {reservation.animal_name} ({reservation.animal_species}). {reservation.notes or ''}",
        created_by_id=current_user.id,
    )
    db.add(intake)

    # Update reservation status to checked_in
    reservation.status = HotelReservationStatus.CHECKED_IN.value

    await db.commit()
    await db.refresh(reservation)
    return _to_response(reservation)


@router.post("/{reservation_id}/checkout")
async def checkout_reservation(
    reservation_id: str,
    checkout_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Check out from a hotel reservation - marks it as completed."""
    try:
        reservation_uuid = uuid.UUID(reservation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reservation_id")

    # Get reservation
    result = await db.execute(
        select(HotelReservation).where(
            HotelReservation.id == reservation_uuid,
            HotelReservation.organization_id == organization_id,
        )
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if reservation.status != HotelReservationStatus.CHECKED_IN.value:
        raise HTTPException(status_code=400, detail="Reservation is not checked in")

    # Find and close the intake record
    intake_result = await db.execute(
        select(Intake).where(
            Intake.organization_id == organization_id,
            Intake.animal_id == reservation.animal_id,
            Intake.reason == IntakeReason.HOTEL,
            Intake.end_date == None,  # noqa: E711
        )
    )
    intake = intake_result.scalar_one_or_none()
    if intake:
        intake.end_date = checkout_date or date.today()

    # Update reservation status to checked_out
    reservation.status = HotelReservationStatus.CHECKED_OUT.value

    await db.commit()
    await db.refresh(reservation)
    return _to_response(reservation)


@router.get(
    "/kennels/{kennel_id}/availability", response_model=KennelAvailabilityResponse
)
async def check_kennel_availability(
    kennel_id: str,
    from_date: date = Query(...),
    to_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Check if a kennel is available for given dates."""
    try:
        kennel_uuid = uuid.UUID(kennel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid kennel_id")

    # Get kennel to check maintenance status
    kennel_result = await db.execute(
        select(Kennel).where(Kennel.id == kennel_uuid, Kennel.deleted_at.is_(None))
    )
    kennel = kennel_result.scalar_one_or_none()
    if not kennel:
        raise HTTPException(status_code=404, detail="Kennel not found")

    # Check if kennel is in maintenance during the requested period
    from datetime import datetime

    maintenance_blocking = None
    if kennel.maintenance_start_at:
        maint_start = kennel.maintenance_start_at
        maint_end = kennel.maintenance_end_at
        # Maintenance blocks if:
        # - Start date is within maintenance period, OR
        # - End date is within maintenance period, OR
        # - Requested period completely contains maintenance period
        if maint_end:
            if from_date <= maint_end.date() and to_date >= maint_start.date():
                maintenance_blocking = {
                    "from": maint_start.date(),
                    "to": maint_end.date(),
                    "reason": kennel.maintenance_reason,
                }
        else:
            # No end date = indefinite maintenance
            if to_date >= maint_start.date():
                maintenance_blocking = {
                    "from": maint_start.date(),
                    "to": None,
                    "reason": kennel.maintenance_reason,
                }

    # Check reservations
    reservations_result = await db.execute(
        select(HotelReservation).where(
            HotelReservation.kennel_id == kennel_uuid,
            HotelReservation.status.in_(
                [
                    HotelReservationStatus.PENDING.value,
                    HotelReservationStatus.CONFIRMED.value,
                ]
            ),
            HotelReservation.reserved_from <= to_date,
            HotelReservation.reserved_to >= from_date,
        )
    )
    blocking_reservations = [
        {
            "id": str(r.id),
            "from": r.reserved_from,
            "to": r.reserved_to,
            "animal": r.animal_name,
        }
        for r in reservations_result.scalars().all()
    ]

    # Check intakes (hotel intakes)
    intakes_result = await db.execute(
        select(Intake).where(
            Intake.kennel_id == kennel_uuid,
            Intake.reason == IntakeReason.HOTEL,
            Intake.intake_date <= to_date,
            Intake.deleted_at.is_(None),
            or_(
                Intake.actual_outcome_date.is_(None),
                Intake.actual_outcome_date >= from_date,
            ),
        )
    )
    blocking_intakes = [
        {"id": str(i.id), "from": i.intake_date, "to": i.actual_outcome_date}
        for i in intakes_result.scalars().all()
    ]

    is_available = (
        len(blocking_reservations) == 0
        and len(blocking_intakes) == 0
        and maintenance_blocking is None
    )

    return {
        "kennel_id": kennel_id,
        "from_date": from_date,
        "to_date": to_date,
        "is_available": is_available,
        "blocking_reservations": blocking_reservations,
        "blocking_intakes": blocking_intakes,
        "maintenance_blocking": maintenance_blocking,
    }
