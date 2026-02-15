"""Global search endpoint."""

import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.animal import Animal
from src.app.models.kennel import Kennel, Zone
from src.app.models.contact import Contact
from src.app.models.inventory_item import InventoryItem

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Search across animals, kennels, contacts, and inventory items."""
    pattern = f"%{q}%"

    # Animals
    animals_result = await db.execute(
        select(
            Animal.id,
            Animal.name,
            Animal.public_code,
            Animal.status,
            Animal.species,
            Animal.primary_photo_url,
        )
        .where(
            Animal.organization_id == organization_id,
            Animal.deleted_at.is_(None),
            or_(
                Animal.name.ilike(pattern),
                Animal.public_code.ilike(pattern),
            ),
        )
        .limit(limit)
    )
    animals = [
        {
            "id": str(row.id),
            "name": row.name,
            "public_code": row.public_code,
            "status": row.status,
            "species": row.species,
            "primary_photo_url": row.primary_photo_url,
        }
        for row in animals_result.all()
    ]

    # Kennels
    kennels_result = await db.execute(
        select(
            Kennel.id,
            Kennel.code,
            Kennel.name,
            Kennel.status,
            Zone.name.label("zone_name"),
        )
        .join(Zone, Kennel.zone_id == Zone.id, isouter=True)
        .where(
            Kennel.organization_id == organization_id,
            Kennel.deleted_at.is_(None),
            or_(
                Kennel.code.ilike(pattern),
                Kennel.name.ilike(pattern),
            ),
        )
        .limit(limit)
    )
    kennels = [
        {
            "id": str(row.id),
            "code": row.code,
            "name": row.name,
            "status": row.status,
            "zone_name": row.zone_name,
        }
        for row in kennels_result.all()
    ]

    # Contacts
    contacts_result = await db.execute(
        select(
            Contact.id,
            Contact.name,
            Contact.email,
        )
        .where(
            Contact.organization_id == organization_id,
            or_(
                Contact.name.ilike(pattern),
                Contact.email.ilike(pattern),
            ),
        )
        .limit(limit)
    )
    contacts = [
        {
            "id": str(row.id),
            "name": row.name,
            "email": row.email,
        }
        for row in contacts_result.all()
    ]

    # Inventory items
    inventory_result = await db.execute(
        select(
            InventoryItem.id,
            InventoryItem.name,
            InventoryItem.category,
            InventoryItem.unit,
        )
        .where(
            InventoryItem.organization_id == organization_id,
            InventoryItem.name.ilike(pattern),
        )
        .limit(limit)
    )
    inventory = [
        {
            "id": str(row.id),
            "name": row.name,
            "category": row.category.value if hasattr(row.category, 'value') else row.category,
            "unit": row.unit,
        }
        for row in inventory_result.all()
    ]

    return {
        "animals": animals,
        "kennels": kennels,
        "contacts": contacts,
        "inventory": inventory,
    }
