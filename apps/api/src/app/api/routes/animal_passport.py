"""Animal Passport API routes."""

import uuid
from datetime import date, timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File as FastAPIFile,
    Query,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.app.api.dependencies.auth import (
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.animal import Animal
from src.app.models.animal_passport import AnimalPassport, AnimalPassportDocument
from src.app.models.animal_vaccination import AnimalVaccination
from src.app.models.file import File as FileModel, StorageProvider
from src.app.models.user import User
from src.app.schemas.animal_passport import (
    PassportCreate,
    PassportUpdate,
    PassportResponse,
    PassportDocumentResponse,
    VaccinationExpirationSummary,
    VaccinationExpiring,
)
from src.app.services.file_upload_service import file_upload_service
from src.app.services.supabase_storage_service import supabase_storage_service


router = APIRouter(prefix="/animals", tags=["passports"])


@router.get("/{animal_id}/passport", response_model=PassportResponse)
async def get_animal_passport(
    animal_id: uuid.UUID,
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get passport for an animal (creates empty one if doesn't exist)"""
    # Verify animal exists and belongs to org
    animal_result = await db.execute(
        select(Animal).where(
            Animal.id == animal_id, Animal.organization_id == organization_id
        )
    )
    animal = animal_result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Get or create passport
    passport_result = await db.execute(
        select(AnimalPassport).where(AnimalPassport.animal_id == animal_id)
    )
    passport = passport_result.scalar_one_or_none()

    if not passport:
        # Create empty passport
        passport = AnimalPassport(
            id=uuid.uuid4(), animal_id=animal_id, organization_id=organization_id
        )
        db.add(passport)
        await db.commit()
        await db.refresh(passport)

    # Load documents with file info
    documents_result = await db.execute(
        select(AnimalPassportDocument, FileModel)
        .join(FileModel, AnimalPassportDocument.file_id == FileModel.id)
        .where(AnimalPassportDocument.passport_id == passport.id)
    )
    documents_with_files = documents_result.all()

    # Build response manually to avoid lazy loading issues
    passport_data = PassportResponse(
        id=passport.id,
        animal_id=passport.animal_id,
        passport_number=passport.passport_number,
        issued_at=passport.issued_at,
        issuer_name=passport.issuer_name,
        notes=passport.notes,
        created_at=passport.created_at,
        updated_at=passport.updated_at,
        documents=[],
    )

    for doc, file in documents_with_files:
        # Generate file URL using supabase storage service
        file_url = await supabase_storage_service.get_public_url(file.storage_path)

        passport_data.documents.append(
            PassportDocumentResponse(
                id=doc.id,
                file_id=doc.file_id,
                document_type=doc.document_type,
                created_at=doc.created_at,
                file_url=file_url,
                file_name=file.original_filename,
            )
        )

    return passport_data


@router.post("/{animal_id}/passport", response_model=PassportResponse)
async def create_or_update_passport(
    animal_id: uuid.UUID,
    data: PassportCreate,
    current_user: User = Depends(require_permission("medical.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Create or update passport metadata"""
    # Verify animal
    animal_result = await db.execute(
        select(Animal).where(
            Animal.id == animal_id, Animal.organization_id == organization_id
        )
    )
    animal = animal_result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Get existing or create new
    passport_result = await db.execute(
        select(AnimalPassport).where(AnimalPassport.animal_id == animal_id)
    )
    passport = passport_result.scalar_one_or_none()

    if passport:
        # Update existing
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(passport, field, value)
    else:
        # Create new
        passport = AnimalPassport(
            id=uuid.uuid4(),
            animal_id=animal_id,
            organization_id=organization_id,
            **data.model_dump(),
        )
        db.add(passport)

    await db.commit()
    await db.refresh(passport)

    # Return passport with empty documents list - build manually to avoid lazy loading
    passport_data = PassportResponse(
        id=passport.id,
        animal_id=passport.animal_id,
        passport_number=passport.passport_number,
        issued_at=passport.issued_at,
        issuer_name=passport.issuer_name,
        notes=passport.notes,
        created_at=passport.created_at,
        updated_at=passport.updated_at,
        documents=[],
    )

    return passport_data


@router.post("/{animal_id}/passport/documents", response_model=PassportDocumentResponse)
async def upload_passport_document(
    animal_id: uuid.UUID,
    file: UploadFile = FastAPIFile(...),
    document_type: str = Query(default="scan"),
    current_user: User = Depends(require_permission("medical.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload a passport document (scan or photo)"""
    # Verify animal and get/create passport
    animal_result = await db.execute(
        select(Animal).where(
            Animal.id == animal_id, Animal.organization_id == organization_id
        )
    )
    animal = animal_result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    passport_result = await db.execute(
        select(AnimalPassport).where(AnimalPassport.animal_id == animal_id)
    )
    passport = passport_result.scalar_one_or_none()

    if not passport:
        passport = AnimalPassport(
            id=uuid.uuid4(), animal_id=animal_id, organization_id=organization_id
        )
        db.add(passport)
        await db.flush()

    # Process file upload
    file_content, content_type = await file_upload_service.process_upload(
        file=file, organization_id=str(organization_id), is_public=False
    )

    # Upload to Supabase
    file_url, storage_path = await supabase_storage_service.upload_file(
        file_content=file_content,
        filename=file.filename or "passport_document",
        content_type=content_type,
        organization_id=str(organization_id),
    )

    # Create file record
    db_file = FileModel(
        organization_id=organization_id,
        storage_provider=StorageProvider.SUPABASE.value,
        storage_path=storage_path,
        original_filename=file.filename or "passport_document",
        mime_type=content_type,
        size_bytes=len(file_content),
        is_public=False,
        uploaded_by_user_id=current_user.id,
    )
    db.add(db_file)
    await db.flush()

    # Create document record
    passport_document = AnimalPassportDocument(
        id=uuid.uuid4(),
        passport_id=passport.id,
        file_id=db_file.id,
        document_type=document_type,
    )
    db.add(passport_document)
    await db.commit()
    await db.refresh(passport_document)

    return PassportDocumentResponse(
        id=passport_document.id,
        file_id=passport_document.file_id,
        document_type=passport_document.document_type,
        created_at=passport_document.created_at,
        file_url=file_url,
        file_name=file.filename,
    )


@router.get("/vaccinations/expiring", response_model=VaccinationExpirationSummary)
async def get_expiring_vaccinations(
    days: int = Query(default=14, ge=1, le=365),
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get summary of vaccinations expiring within N days"""
    today = date.today()
    cutoff_date = today + timedelta(days=days)

    # Get all vaccinations with valid_until for this org
    query = (
        select(AnimalVaccination, Animal.name, Animal.public_code)
        .join(Animal, AnimalVaccination.animal_id == Animal.id)
        .where(
            Animal.organization_id == organization_id,
            AnimalVaccination.valid_until.isnot(None),
        )
        .order_by(AnimalVaccination.valid_until.asc())
    )

    result = await db.execute(query)
    rows = result.all()

    expired = []
    expiring_soon = []
    expiring_later = []

    for vacc, animal_name, animal_public_code in rows:
        days_until = (vacc.valid_until - today).days

        status = (
            "expired"
            if days_until < 0
            else ("expiring_soon" if days_until <= days else "expiring_later")
        )

        item = VaccinationExpiring(
            id=vacc.id,
            animal_id=vacc.animal_id,
            animal_name=animal_name,
            animal_public_code=animal_public_code,
            vaccine_type=vacc.vaccination_type,
            administered_at=vacc.administered_at.date()
            if hasattr(vacc.administered_at, "date")
            else vacc.administered_at,
            valid_until=vacc.valid_until,
            days_until_expiration=days_until,
            status=status,
        )

        if status == "expired":
            expired.append(item)
        elif status == "expiring_soon":
            expiring_soon.append(item)
        else:
            expiring_later.append(item)

    return VaccinationExpirationSummary(
        total_vaccinations=len(rows),
        expiring_within_14_days=len(
            [v for v in rows if 0 <= (v[0].valid_until - today).days <= 14]
        ),
        expiring_within_30_days=len(
            [v for v in rows if 0 <= (v[0].valid_until - today).days <= 30]
        ),
        expired=len(expired),
        upcoming=expiring_soon + expired[:5],  # Show 5 most urgent expired
    )
