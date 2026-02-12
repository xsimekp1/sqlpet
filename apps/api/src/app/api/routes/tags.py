from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.tag import Tag
from src.app.models.animal_tag import AnimalTag
from src.app.models.animal import Animal
from src.app.models.user import User
from src.app.schemas.tag import TagCreate, TagUpdate, TagResponse

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=List[TagResponse])
async def list_tags(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List all tags for the current organization."""
    result = await session.execute(
        select(Tag)
        .where(Tag.organization_id == organization_id)
        .order_by(Tag.name)
    )
    tags = result.scalars().all()
    return tags


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag_data: TagCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new tag."""
    # Check if tag with same name already exists
    result = await session.execute(
        select(Tag)
        .where(Tag.organization_id == organization_id)
        .where(Tag.name == tag_data.name)
    )
    existing_tag = result.scalar_one_or_none()
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag with this name already exists",
        )

    # Create new tag
    tag = Tag(
        organization_id=organization_id,
        name=tag_data.name,
        color=tag_data.color,
    )
    session.add(tag)
    await session.commit()
    await session.refresh(tag)
    return tag


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(
    tag_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get a single tag by ID."""
    result = await session.execute(
        select(Tag)
        .where(Tag.id == tag_id)
        .where(Tag.organization_id == organization_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: uuid.UUID,
    tag_data: TagUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Update a tag."""
    # Get existing tag
    result = await session.execute(
        select(Tag)
        .where(Tag.id == tag_id)
        .where(Tag.organization_id == organization_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    # Check for duplicate name if name is being changed
    if tag_data.name and tag_data.name != tag.name:
        result = await session.execute(
            select(Tag)
            .where(Tag.organization_id == organization_id)
            .where(Tag.name == tag_data.name)
        )
        existing_tag = result.scalar_one_or_none()
        if existing_tag:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tag with this name already exists",
            )

    # Update fields
    if tag_data.name is not None:
        tag.name = tag_data.name
    if tag_data.color is not None:
        tag.color = tag_data.color

    await session.commit()
    await session.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Delete a tag (will cascade delete from animal_tags)."""
    # Get existing tag
    result = await session.execute(
        select(Tag)
        .where(Tag.id == tag_id)
        .where(Tag.organization_id == organization_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    await session.delete(tag)
    await session.commit()


@router.post("/animals/{animal_id}/tags/{tag_id}", status_code=status.HTTP_201_CREATED)
async def add_tag_to_animal(
    animal_id: uuid.UUID,
    tag_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Add a tag to an animal."""
    # Verify animal exists and belongs to organization
    result = await session.execute(
        select(Animal)
        .where(Animal.id == animal_id)
        .where(Animal.organization_id == organization_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Animal not found",
        )

    # Verify tag exists and belongs to organization
    result = await session.execute(
        select(Tag)
        .where(Tag.id == tag_id)
        .where(Tag.organization_id == organization_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    # Check if tag is already assigned
    result = await session.execute(
        select(AnimalTag)
        .where(AnimalTag.animal_id == animal_id)
        .where(AnimalTag.tag_id == tag_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag already assigned to this animal",
        )

    # Create association
    animal_tag = AnimalTag(animal_id=animal_id, tag_id=tag_id)
    session.add(animal_tag)
    await session.commit()

    return {"message": "Tag added successfully"}


@router.delete("/animals/{animal_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag_from_animal(
    animal_id: uuid.UUID,
    tag_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Remove a tag from an animal."""
    # Verify animal exists and belongs to organization
    result = await session.execute(
        select(Animal)
        .where(Animal.id == animal_id)
        .where(Animal.organization_id == organization_id)
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Animal not found",
        )

    # Delete association
    await session.execute(
        delete(AnimalTag)
        .where(AnimalTag.animal_id == animal_id)
        .where(AnimalTag.tag_id == tag_id)
    )
    await session.commit()
