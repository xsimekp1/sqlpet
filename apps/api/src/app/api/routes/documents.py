"""API routes for document templates and instances."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.app.api.dependencies.auth import get_current_user
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.document_template import DocumentTemplate, DocumentInstance
from src.app.models.animal import Animal
from src.app.services.document_service import DocumentService
from src.app.schemas.document import (
    DocumentTemplateCreate,
    DocumentTemplateUpdate,
    DocumentTemplateResponse,
    DocumentTemplateListResponse,
    DocumentInstanceCreate,
    DocumentInstanceResponse,
    DocumentInstanceListResponse,
    DocumentPreviewResponse,
    OrgDocumentPreviewRequest,
)

router = APIRouter()


# --- Document Templates (Admin only) ---


@router.get("/document-templates", response_model=DocumentTemplateListResponse)
async def list_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
    skip: int = 0,
    limit: int = 100,
):
    """
    List document templates for organization.

    Admin only. Returns both global templates (organization_id=NULL)
    and organization-specific templates.
    """
    org_id = UUID(x_organization_id)

    # Get total count
    count_query = select(func.count(DocumentTemplate.id)).where(
        (DocumentTemplate.organization_id == org_id) | (DocumentTemplate.organization_id == None)  # noqa: E711
    )
    total = await db.scalar(count_query) or 0

    # Get templates
    query = (
        select(DocumentTemplate)
        .where(
            (DocumentTemplate.organization_id == org_id) | (DocumentTemplate.organization_id == None)  # noqa: E711
        )
        .order_by(DocumentTemplate.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    templates = result.scalars().all()

    return DocumentTemplateListResponse(
        items=[DocumentTemplateResponse.model_validate(t) for t in templates],
        total=total,
    )


@router.post("/document-templates", response_model=DocumentTemplateResponse, status_code=201)
async def create_template(
    data: DocumentTemplateCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """
    Create a new document template.

    Admin only. Template is organization-specific.
    """
    org_id = UUID(x_organization_id)

    template = DocumentTemplate(
        organization_id=org_id,
        code=data.code,
        name=data.name,
        language=data.language,
        content_html=data.content_html,
        description=data.description,
        is_active=data.is_active,
        created_by_user_id=current_user.id,
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return DocumentTemplateResponse.model_validate(template)


@router.put("/document-templates/{template_id}", response_model=DocumentTemplateResponse)
async def update_template(
    template_id: UUID,
    data: DocumentTemplateUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """
    Update a document template.

    Admin only. Can only update templates belonging to the organization.
    """
    org_id = UUID(x_organization_id)

    query = select(DocumentTemplate).where(
        DocumentTemplate.id == template_id,
        DocumentTemplate.organization_id == org_id,
    )
    result = await db.execute(query)
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Update fields
    if data.code is not None:
        template.code = data.code
    if data.name is not None:
        template.name = data.name
    if data.language is not None:
        template.language = data.language
    if data.content_html is not None:
        template.content_html = data.content_html
    if data.description is not None:
        template.description = data.description
    if data.is_active is not None:
        template.is_active = data.is_active

    await db.commit()
    await db.refresh(template)

    return DocumentTemplateResponse.model_validate(template)


@router.get("/document-templates/{template_id}", response_model=DocumentTemplateResponse)
async def get_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """Get a document template by ID."""
    org_id = UUID(x_organization_id)

    query = select(DocumentTemplate).where(
        DocumentTemplate.id == template_id,
        (DocumentTemplate.organization_id == org_id) | (DocumentTemplate.organization_id == None),  # noqa: E711
    )
    result = await db.execute(query)
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return DocumentTemplateResponse.model_validate(template)


# --- Org-level Documents (not tied to a specific animal) ---


@router.post("/org-documents/preview", response_model=DocumentPreviewResponse)
async def preview_org_document(
    data: OrgDocumentPreviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """Render an org-level document template preview (no animal, no saving)."""
    org_id = UUID(x_organization_id)

    template_query = select(DocumentTemplate).where(
        DocumentTemplate.code == data.template_code,
        (DocumentTemplate.organization_id == org_id) | (DocumentTemplate.organization_id == None),  # noqa: E711
        DocumentTemplate.is_active == True,  # noqa: E712
    )
    result = await db.execute(template_query)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{data.template_code}' not found")

    document_service = DocumentService(db)
    try:
        rendered_html = await document_service.render_org_template(
            template=template,
            organization_id=org_id,
            created_by_user_id=current_user.id,
            year=data.year,
            locale=data.locale,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return DocumentPreviewResponse(
        document_id=None,
        rendered_html=rendered_html,
        preview_url=None,
        pdf_url=None,
    )


# --- Document Instances (for animals) ---


@router.post("/animals/{animal_id}/documents/preview", response_model=DocumentPreviewResponse)
async def preview_animal_document(
    animal_id: UUID,
    data: DocumentInstanceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """
    Render a document template preview WITHOUT saving to database.

    Use this for quick previews. The rendered HTML is returned but no
    DocumentInstance is created.
    """
    org_id = UUID(x_organization_id)

    animal_query = select(Animal).where(
        Animal.id == animal_id,
        Animal.organization_id == org_id,
    )
    animal_result = await db.execute(animal_query)
    animal = animal_result.scalar_one_or_none()

    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Resolve template
    template_id = data.template_id
    if not template_id and data.template_code:
        template_query = select(DocumentTemplate).where(
            DocumentTemplate.code == data.template_code,
            (DocumentTemplate.organization_id == org_id) | (DocumentTemplate.organization_id == None),  # noqa: E711
            DocumentTemplate.is_active == True,  # noqa: E712
        )
        template_result = await db.execute(template_query)
        template = template_result.scalar_one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail=f"Template '{data.template_code}' not found")

        template_id = template.id

    if not template_id:
        raise HTTPException(status_code=400, detail="Either template_id or template_code must be provided")

    # Fetch template object for rendering
    tpl_query = select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    tpl_result = await db.execute(tpl_query)
    tpl = tpl_result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    document_service = DocumentService(db)
    try:
        rendered_html = await document_service.render_template(
            template=tpl,
            animal_id=animal_id,
            organization_id=org_id,
            created_by_user_id=current_user.id,
            manual_fields=data.manual_fields,
            donor_contact_id=data.donor_contact_id,
            locale=data.locale,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return DocumentPreviewResponse(
        document_id=None,
        rendered_html=rendered_html,
        preview_url=None,
        pdf_url=None,
    )


@router.post("/animals/{animal_id}/documents", response_model=DocumentPreviewResponse, status_code=201)
async def create_animal_document(
    animal_id: UUID,
    data: DocumentInstanceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """
    Create a new document for an animal.

    Renders the template with animal/org/donor data and manual fields.
    Returns the created document with preview URL.
    """
    org_id = UUID(x_organization_id)

    # Verify animal exists and belongs to organization
    animal_query = select(Animal).where(
        Animal.id == animal_id,
        Animal.organization_id == org_id,
    )
    animal_result = await db.execute(animal_query)
    animal = animal_result.scalar_one_or_none()

    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Get template by ID or code
    template_id = data.template_id
    if not template_id and data.template_code:
        template_query = select(DocumentTemplate).where(
            DocumentTemplate.code == data.template_code,
            (DocumentTemplate.organization_id == org_id) | (DocumentTemplate.organization_id == None),  # noqa: E711
            DocumentTemplate.is_active == True,  # noqa: E712
        )
        template_result = await db.execute(template_query)
        template = template_result.scalar_one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail=f"Template with code '{data.template_code}' not found")

        template_id = template.id

    if not template_id:
        raise HTTPException(status_code=400, detail="Either template_id or template_code must be provided")

    # Create document instance using service
    document_service = DocumentService(db)
    try:
        doc_instance = await document_service.create_document_instance(
            template_id=template_id,
            animal_id=animal_id,
            organization_id=org_id,
            created_by_user_id=current_user.id,
            manual_fields=data.manual_fields,
            donor_contact_id=data.donor_contact_id,
            status=data.status,
            locale=data.locale,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Return preview response
    return DocumentPreviewResponse(
        document_id=doc_instance.id,
        rendered_html=doc_instance.rendered_html or "",
        preview_url=f"/documents/{doc_instance.id}/preview",
        pdf_url=doc_instance.pdf_url,
    )


@router.get("/animals/{animal_id}/documents", response_model=DocumentInstanceListResponse)
async def list_animal_documents(
    animal_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
    skip: int = 0,
    limit: int = 100,
):
    """List all documents for an animal."""
    org_id = UUID(x_organization_id)

    # Verify animal exists
    animal_query = select(Animal).where(
        Animal.id == animal_id,
        Animal.organization_id == org_id,
    )
    animal_result = await db.execute(animal_query)
    animal = animal_result.scalar_one_or_none()

    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Get total count
    count_query = select(func.count(DocumentInstance.id)).where(
        DocumentInstance.animal_id == animal_id,
        DocumentInstance.organization_id == org_id,
    )
    total = await db.scalar(count_query) or 0

    # Get documents
    query = (
        select(DocumentInstance)
        .options(
            selectinload(DocumentInstance.template),
            selectinload(DocumentInstance.created_by),
        )
        .where(
            DocumentInstance.animal_id == animal_id,
            DocumentInstance.organization_id == org_id,
        )
        .order_by(DocumentInstance.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    documents = result.scalars().all()

    # Build response items
    items = []
    for doc in documents:
        response = DocumentInstanceResponse.model_validate(doc)
        # Add extra fields
        if doc.template:
            response.template_name = doc.template.name
            response.template_code = doc.template.code
        if doc.created_by:
            response.created_by_name = f"{doc.created_by.first_name or ''} {doc.created_by.last_name or ''}".strip()
        items.append(response)

    return DocumentInstanceListResponse(items=items, total=total)


@router.get("/documents/{document_id}", response_model=DocumentInstanceResponse)
async def get_document(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """Get a document instance by ID."""
    org_id = UUID(x_organization_id)

    query = (
        select(DocumentInstance)
        .options(
            selectinload(DocumentInstance.template),
            selectinload(DocumentInstance.created_by),
        )
        .where(
            DocumentInstance.id == document_id,
            DocumentInstance.organization_id == org_id,
        )
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    response = DocumentInstanceResponse.model_validate(document)
    # Add extra fields
    if document.template:
        response.template_name = document.template.name
        response.template_code = document.template.code
    if document.created_by:
        response.created_by_name = f"{document.created_by.first_name or ''} {document.created_by.last_name or ''}".strip()

    return response


@router.get("/documents/{document_id}/preview", response_model=DocumentPreviewResponse)
async def preview_document(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """Get document preview (rendered HTML)."""
    org_id = UUID(x_organization_id)

    query = select(DocumentInstance).where(
        DocumentInstance.id == document_id,
        DocumentInstance.organization_id == org_id,
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentPreviewResponse(
        document_id=document.id,
        rendered_html=document.rendered_html or "",
        preview_url=f"/documents/{document.id}/preview",
        pdf_url=document.pdf_url,
    )


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str, Header()],
):
    """Delete a document instance (admin only)."""
    org_id = UUID(x_organization_id)

    query = select(DocumentInstance).where(
        DocumentInstance.id == document_id,
        DocumentInstance.organization_id == org_id,
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.delete(document)
    await db.commit()
