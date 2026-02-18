from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    HTTPException,
    Query,
    File as FastAPIFile,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.file import File as FileModel, EntityFile, StorageProvider
from src.app.models.animal import Animal
from src.app.models.contact import Contact
from src.app.models.organization import Organization
from src.app.services.file_upload_service import file_upload_service
from src.app.services.supabase_storage_service import supabase_storage_service
from src.app.core.config import settings
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
    file: UploadFile = FastAPIFile(...),
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
    file_url, storage_path = await supabase_storage_service.upload_file(
        file_content=file_content,
        filename=file.filename or "unknown",
        content_type=content_type,
        organization_id=organization_id,
    )

    # Create file record
    db_file = FileModel(
        organization_id=organization_id,
        storage_provider=StorageProvider.SUPABASE,
        storage_path=storage_path,
        original_filename=file.filename or "unknown",
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
    db: AsyncSession = Depends(get_db),
):
    """Link a file to an entity (animal, kennel, etc.)"""

    # Verify file exists and belongs to user's org
    file_obj = await db.get(FileModel, UUID(file_id))
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
    db: AsyncSession = Depends(get_db),
):
    """Generate presigned URL for file download"""

    file_obj = await db.get(FileModel, UUID(file_id))
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
    db: AsyncSession = Depends(get_db),
):
    """Delete a file"""

    file_obj = await db.get(FileModel, UUID(file_id))
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
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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

    # Upload to Supabase with thumbnail
    (
        file_url,
        storage_path,
        thumbnail_url,
    ) = await supabase_storage_service.upload_file_with_thumbnail(
        file_content=file_content,
        filename=file.filename or "unknown",
        content_type=content_type,
        organization_id=str(animal.organization_id),
    )

    # Create file record
    db_file = FileModel(
        organization_id=animal.organization_id,
        storage_provider=StorageProvider.SUPABASE,
        storage_path=storage_path,
        original_filename=file.filename or "unknown",
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
    # Use thumbnail for better performance, fall back to full image
    animal.primary_photo_url = thumbnail_url or file_url

    # Clear default_image_url since we now have a real photo
    animal.default_image_url = None

    await db.commit()

    return {
        "message": "Primary photo uploaded successfully",
        "file_url": file_url,
        "thumbnail_url": thumbnail_url,
        "storage_path": storage_path,
    }


@router.post("/contact/{contact_id}/upload-avatar")
async def upload_contact_avatar(
    contact_id: str,
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload avatar photo for a contact."""
    contact = await db.get(Contact, UUID(contact_id))
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    file_content, content_type = await file_upload_service.process_upload(
        file=file,
        organization_id=str(contact.organization_id),
        is_public=True,
    )

    file_url, storage_path = await supabase_storage_service.upload_file(
        file_content=file_content,
        filename=file.filename or "unknown",
        content_type=content_type,
        organization_id=str(contact.organization_id),
    )

    # Update contact's avatar_url
    contact.avatar_url = file_url
    await db.commit()

    return {"file_url": file_url}


@router.post("/organization/logo")
async def upload_organization_logo(
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload logo for the current organization."""
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    file_content, content_type = await file_upload_service.process_upload(
        file=file,
        organization_id=str(organization_id),
        is_public=True,
    )

    file_url, storage_path = await supabase_storage_service.upload_file(
        file_content=file_content,
        filename=file.filename or "logo",
        content_type=content_type,
        organization_id=str(organization_id),
    )

    org.logo_url = file_url
    await db.commit()

    return {"file_url": file_url}


class AnimalDocumentResponse(BaseModel):
    id: str
    file_url: str
    thumbnail_url: Optional[str] = None
    original_filename: str
    mime_type: str
    size_bytes: int
    purpose: Optional[str] = None
    uploaded_by_user_id: Optional[str] = None
    uploaded_by_user_name: Optional[str] = None
    created_at: str


@router.get(
    "/animal/{animal_id}/documents", response_model=List[AnimalDocumentResponse]
)
async def get_animal_documents(
    animal_id: str,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all documents for an animal"""
    from sqlalchemy import select
    from src.app.models.file import EntityFile, File as FileModel
    from src.app.models.user import User

    animal = await db.get(Animal, UUID(animal_id))
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    q = (
        select(EntityFile, FileModel, User)
        .join(FileModel, FileModel.id == EntityFile.file_id)
        .outerjoin(User, User.id == FileModel.uploaded_by_user_id)
        .where(
            EntityFile.entity_type == "animal",
            EntityFile.entity_id == UUID(animal_id),
            EntityFile.purpose == "document",
        )
        .order_by(EntityFile.created_at.desc())
    )

    result = await db.execute(q)
    rows = result.all()

    return [
        AnimalDocumentResponse(
            id=str(ef.file_id),
            file_url=await supabase_storage_service.get_public_url(f.storage_path),
            thumbnail_url=await supabase_storage_service.get_public_url(
                f.storage_path, bucket=supabase_storage_service.thumbnails_bucket
            )
            if f.mime_type and f.mime_type.startswith("image/")
            else None,
            original_filename=f.original_filename,
            mime_type=f.mime_type,
            size_bytes=f.size_bytes,
            purpose=ef.purpose,
            uploaded_by_user_id=str(f.uploaded_by_user_id)
            if f.uploaded_by_user_id
            else None,
            uploaded_by_user_name=u.full_name if u else None,
            created_at=ef.created_at.isoformat() if ef.created_at else "",
        )
        for ef, f, u in rows
    ]


@router.post(
    "/animal/{animal_id}/upload-document", response_model=AnimalDocumentResponse
)
async def upload_animal_document(
    animal_id: str,
    file: UploadFile = FastAPIFile(...),
    purpose: Optional[str] = Query(default="document"),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document for an animal"""
    from src.app.models.file import EntityFile, File as FileModel

    animal = await db.get(Animal, UUID(animal_id))
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    file_content, content_type = await file_upload_service.process_upload(
        file=file,
        organization_id=str(organization_id),
        is_public=True,
    )

    (
        file_url,
        storage_path,
        thumbnail_url,
    ) = await supabase_storage_service.upload_file_with_thumbnail(
        file_content=file_content,
        filename=file.filename or "document",
        content_type=content_type,
        organization_id=str(organization_id),
    )

    db_file = FileModel(
        organization_id=organization_id,
        storage_provider=StorageProvider.SUPABASE,
        storage_path=storage_path,
        original_filename=file.filename or "document",
        mime_type=content_type,
        size_bytes=len(file_content),
        is_public=True,
        uploaded_by_user_id=current_user.id,
    )

    db.add(db_file)
    await db.flush()

    entity_file = EntityFile(
        organization_id=organization_id,
        entity_type="animal",
        entity_id=animal.id,
        file_id=db_file.id,
        purpose=purpose,
    )

    db.add(entity_file)
    await db.commit()
    await db.refresh(db_file)

    return AnimalDocumentResponse(
        id=str(db_file.id),
        file_url=file_url,
        thumbnail_url=thumbnail_url,
        original_filename=db_file.original_filename,
        mime_type=db_file.mime_type,
        size_bytes=db_file.size_bytes,
        purpose=purpose,
        uploaded_by_user_id=str(current_user.id),
        uploaded_by_user_name=current_user.full_name,
        created_at=db_file.created_at.isoformat() if db_file.created_at else "",
    )
