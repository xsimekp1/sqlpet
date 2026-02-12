from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

print("🔍 Starting files.py imports...")

try:
    from src.app.api.dependencies.auth import get_current_user

    print("✅ Imported get_current_user")
except Exception as e:
    print(f"❌ Failed to import get_current_user: {e}")

try:
    from src.app.api.dependencies.db import get_db

    print("✅ Imported get_db")
except Exception as e:
    print(f"❌ Failed to import get_db: {e}")

try:
    from src.app.models.user import User

    print("✅ Imported User model")
except Exception as e:
    print(f"❌ Failed to import User: {e}")

try:
    from src.app.models.file import File, EntityFile

    print("✅ Imported File, EntityFile")
except Exception as e:
    print(f"❌ Failed to import File, EntityFile: {e}")

try:
    from src.app.models.animal import Animal

    print("✅ Imported Animal model")
except Exception as e:
    print(f"❌ Failed to import Animal: {e}")

try:
    from src.app.services.file_upload_service import file_upload_service

    print("✅ Imported file_upload_service")
except Exception as e:
    print(f"❌ Failed to import file_upload_service: {e}")

try:
    from src.app.services.supabase_storage_service import supabase_storage_service

    print("✅ Imported supabase_storage_service")
except Exception as e:
    print(f"❌ Failed to import supabase_storage_service: {e}")

try:
    from src.app.core.config import settings

    print("✅ Imported settings")
except Exception as e:
    print(f"❌ Failed to import settings: {e}")

print("🔍 All imports in files.py completed")
from pydantic import BaseModel
from uuid import UUID
import uuid

router = APIRouter(prefix="/files", tags=["files"])


class FileUploadResponse(BaseModel):
    id: str
    file_url: str
    storage_path: str
    original_filename: str
    mime_type: str
    size_bytes: int


class EntityFileLinkRequest(BaseModel):
    entity_type: str  # 'animal', 'kennel', 'document', etc.
    entity_id: str
    purpose: Optional[str] = None
    file_id: str


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    organization_id: str = Query(...),
    is_public: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file to Supabase Storage"""

    # Process file upload
    file_content, content_type = await file_upload_service.process_upload(
        file=file, organization_id=organization_id, is_public=is_public
    )

    # Upload to Supabase
    from io import BytesIO

    file_stream = BytesIO(file_content)

    file_url, storage_path = await supabase_storage_service.upload_file(
        file_content=file_stream,
        filename=file.filename or "unknown",
        content_type=content_type,
        organization_id=organization_id,
        is_public=is_public,
    )

    # Create file record
    db_file = File(
        organization_id=organization_id,
        storage_path=storage_path,
        original_filename=file.filename,
        mime_type=content_type,
        size_bytes=len(file_content),
        is_public=is_public,
        uploaded_by_user_id=current_user.id,
    )

    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)

    return FileUploadResponse(
        id=str(db_file.id),
        file_url=file_url,
        storage_path=storage_path,
        original_filename=file.filename,
        mime_type=content_type,
        size_bytes=len(file_content),
    )


@router.post("/link")
async def link_file_to_entity(
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    file_id: str = Query(...),
    purpose: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db_session),
):
    """Link a file to an entity (animal, kennel, etc.)"""

    # Verify file exists and belongs to user's org
    file_obj = await db.get(File, UUID(file_id))
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    # Verify entity exists based on type
    entity = None
    if entity_type == "animal":
        entity = await db.get(Animal, UUID(entity_id))
    # TODO: Add other entity types as needed

    if not entity:
        raise HTTPException(
            status_code=404,
            detail=f"Entity {entity_type} with ID {entity_id} not found",
        )

    # Create entity file link
    entity_file = EntityFile(
        organization_id=file_obj.organization_id,
        entity_type=entity_type,
        entity_id=UUID(entity_id),
        file_id=UUID(file_id),
        purpose=purpose,
    )

    db.add(entity_file)
    await db.commit()

    return {"message": "File linked successfully"}


@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db_session),
):
    """Generate presigned URL for file download"""

    file_obj = await db.get(File, UUID(file_id))
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    url = await supabase_storage_service.get_public_url(
        storage_path=file_obj.storage_path
    )

    return {"download_url": url}


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db_session),
):
    """Delete a file"""

    file_obj = await db.get(File, UUID(file_id))
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete from Supabase Storage
    await supabase_storage_service.delete_file(storage_path=file_obj.storage_path)

    # Delete from database (cascade will handle entity files)
    await db.delete(file_obj)
    await db.commit()

    return {"message": "File deleted successfully"}


@router.post("/animal/{animal_id}/upload-primary-photo")
async def upload_primary_animal_photo(
    animal_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db_session),
):
    """Upload primary photo for an animal"""

    # Verify animal exists
    animal = await db.get(Animal, UUID(animal_id))
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Process file upload
    file_content, content_type = await file_upload_service.process_upload(
        file=file,
        organization_id=str(animal.organization_id),
        is_public=True,  # Animal photos are public
    )

    # Upload to Supabase
    from io import BytesIO

    file_stream = BytesIO(file_content)

    file_url, storage_path = await supabase_storage_service.upload_file(
        file_content=file_stream,
        filename=file.filename or "unknown",
        content_type=content_type,
        organization_id=str(animal.organization_id),
        is_public=True,
    )

    # Create file record
    db_file = File(
        organization_id=animal.organization_id,
        storage_path=storage_path,
        original_filename=file.filename,
        mime_type=content_type,
        size_bytes=len(file_content),
        is_public=True,
        uploaded_by_user_id=current_user.id,
    )

    db.add(db_file)
    await db.flush()

    # Link as primary photo (clear existing primary first)
    from sqlalchemy import update

    await db.execute(
        update(EntityFile)
        .where(
            EntityFile.entity_type == "animal",
            EntityFile.entity_id == animal.id,
            EntityFile.purpose == "primary_photo",
        )
        .values(purpose="old_primary")  # Deprecate old primary
    )

    # Create new primary link
    entity_file = EntityFile(
        organization_id=animal.organization_id,
        entity_type="animal",
        entity_id=animal.id,
        file_id=db_file.id,
        purpose="primary_photo",
    )

    db.add(entity_file)

    # Update animal's primary_photo_url for backwards compatibility
    animal.primary_photo_url = file_url

    await db.commit()

    return {
        "message": "Primary photo uploaded successfully",
        "file_url": file_url,
        "storage_path": storage_path,
    }
