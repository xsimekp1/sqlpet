"""Document template rendering service."""
import re
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.app.models.animal import Animal
from src.app.models.animal_identifier import AnimalIdentifier, IdentifierType
from src.app.models.organization import Organization
from src.app.models.contact import Contact
from src.app.models.user import User
from src.app.models.document_template import DocumentTemplate, DocumentInstance, DocumentStatus


class DocumentService:
    """Service for rendering document templates with placeholder replacement."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def render_template(
        self,
        template: DocumentTemplate,
        animal_id: UUID,
        organization_id: UUID,
        created_by_user_id: UUID,
        manual_fields: dict[str, Any] | None = None,
        donor_contact_id: UUID | None = None,
    ) -> str:
        """
        Render a document template with data from DB and manual fields.

        Args:
            template: The document template to render
            animal_id: ID of the animal
            organization_id: ID of the organization
            created_by_user_id: ID of the user creating the document
            manual_fields: Manual fields provided by user (place, date, etc.)
            donor_contact_id: Optional contact ID for donor information

        Returns:
            Rendered HTML with placeholders replaced
        """
        # Fetch all required data
        animal = await self._get_animal_data(animal_id, organization_id)
        org = await self._get_organization_data(organization_id)
        user = await self._get_user_data(created_by_user_id)
        donor = None
        if donor_contact_id:
            donor = await self._get_contact_data(donor_contact_id, organization_id)

        # Build placeholder context
        context = self._build_context(animal, org, user, donor, manual_fields or {})

        # Render template with placeholders
        rendered_html = self._replace_placeholders(template.content_html, context)

        return rendered_html

    async def _get_animal_data(self, animal_id: UUID, organization_id: UUID) -> dict[str, Any]:
        """Fetch animal data with related entities."""
        query = (
            select(Animal)
            .options(
                selectinload(Animal.animal_breeds),
                selectinload(Animal.identifiers),
            )
            .where(Animal.id == animal_id, Animal.organization_id == organization_id)
        )
        result = await self.db.execute(query)
        animal = result.scalar_one_or_none()

        if not animal:
            raise ValueError(f"Animal {animal_id} not found")

        # Find microchip identifier
        microchip = None
        for identifier in animal.identifiers:
            if identifier.type == IdentifierType.MICROCHIP:
                microchip = identifier.value
                break

        # Get primary breed name
        breed_name = ""
        if animal.animal_breeds:
            # Get the first breed or the one with highest percentage
            primary_breed = max(
                animal.animal_breeds,
                key=lambda ab: ab.percent if ab.percent else 0,
                default=None
            )
            if primary_breed and hasattr(primary_breed, 'breed') and primary_breed.breed:
                breed_name = primary_breed.breed.name if hasattr(primary_breed.breed, 'name') else ""

        # Calculate age from birth_date_estimated
        age_str = ""
        if animal.birth_date_estimated:
            today = date.today()
            bd = animal.birth_date_estimated
            years = today.year - bd.year
            if (today.month, today.day) < (bd.month, bd.day):
                years -= 1

            if years == 0:
                # Calculate months
                months = today.month - bd.month
                if today.day < bd.day:
                    months -= 1
                if months < 0:
                    months += 12
                age_str = f"{months} měsíců" if months != 1 else "1 měsíc"
            elif years == 1:
                age_str = "1 rok"
            elif years < 5:
                age_str = f"{years} roky"
            else:
                age_str = f"{years} let"

        # Translate sex
        sex_map = {
            "male": "pes",
            "female": "fena",
            "unknown": "neznámé"
        }
        sex_str = sex_map.get(animal.sex, animal.sex)

        # Translate species
        species_map = {
            "dog": "pes",
            "cat": "kočka",
        }
        species_str = species_map.get(animal.species, animal.species)

        return {
            "name": animal.name or "",
            "species": species_str,
            "breed": breed_name,
            "sex": sex_str,
            "age": age_str,
            "color": animal.color or "",
            "microchip": microchip or "",
            "weight_kg": str(animal.weight_current_kg) if animal.weight_current_kg else "",
            "description": animal.description or "",
            "behavior_notes": animal.behavior_notes or "",
        }

    async def _get_organization_data(self, organization_id: UUID) -> dict[str, Any]:
        """Fetch organization data."""
        query = select(Organization).where(Organization.id == organization_id)
        result = await self.db.execute(query)
        org = result.scalar_one_or_none()

        if not org:
            raise ValueError(f"Organization {organization_id} not found")

        return {
            "name": org.name or "",
            "subtitle": org.subtitle or "",
            "representative": org.representative or "",
            "address_line1": org.address_line1 or "",
            "address_line2": org.address_line2 or "",
            "phone": org.phone or "",
            "email": org.email or "",
            "city": org.city or "",
        }

    async def _get_user_data(self, user_id: UUID) -> dict[str, Any]:
        """Fetch user data."""
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError(f"User {user_id} not found")

        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()

        return {
            "full_name": full_name,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "email": user.email or "",
        }

    async def _get_contact_data(self, contact_id: UUID, organization_id: UUID) -> dict[str, Any]:
        """Fetch contact data for donor."""
        query = select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == organization_id
        )
        result = await self.db.execute(query)
        contact = result.scalar_one_or_none()

        if not contact:
            raise ValueError(f"Contact {contact_id} not found")

        # Format birth date
        birth_date_str = ""
        if contact.birth_date:
            birth_date_str = contact.birth_date.strftime("%d.%m.%Y")

        return {
            "full_name": contact.full_name or "",
            "birth_date": birth_date_str,
            "address_line1": contact.address_line1 or "",
            "address_line2": contact.address_line2 or "",
            "phone": contact.phone or "",
            "email": contact.email or "",
            "zip": contact.zip or "",
        }

    def _build_context(
        self,
        animal: dict[str, Any],
        org: dict[str, Any],
        user: dict[str, Any],
        donor: dict[str, Any] | None,
        manual_fields: dict[str, Any],
    ) -> dict[str, Any]:
        """Build the complete context for placeholder replacement."""
        # Format manual date fields
        doc_date = manual_fields.get("date", "")
        if isinstance(doc_date, (date, datetime)):
            doc_date = doc_date.strftime("%d.%m.%Y")

        context = {
            "animal": animal,
            "org": org,
            "user": user,
            "donor": donor or {},
            "doc": {
                "place": manual_fields.get("place", ""),
                "date": doc_date,
                "time": manual_fields.get("time", ""),
                "created_by": user.get("full_name", ""),
                **{k: v for k, v in manual_fields.items() if k not in ["place", "date", "time"]},
            },
        }

        return context

    def _replace_placeholders(self, template_html: str, context: dict[str, Any]) -> str:
        """Replace all {{placeholders}} in template with context values."""
        # Pattern to match {{path.to.value}}
        pattern = r'\{\{([^}]+)\}\}'

        def replacer(match):
            placeholder = match.group(1).strip()
            value = self._get_nested_value(context, placeholder)
            return str(value) if value is not None else ""

        return re.sub(pattern, replacer, template_html)

    def _get_nested_value(self, context: dict[str, Any], path: str) -> Any:
        """Get value from nested dict using dot notation (e.g., 'animal.name')."""
        keys = path.split(".")
        value = context

        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
                if value is None:
                    return None
            else:
                return None

        return value

    async def create_document_instance(
        self,
        template_id: UUID,
        animal_id: UUID,
        organization_id: UUID,
        created_by_user_id: UUID,
        manual_fields: dict[str, Any] | None = None,
        donor_contact_id: UUID | None = None,
        status: DocumentStatus = DocumentStatus.FINAL,
    ) -> DocumentInstance:
        """
        Create a new document instance from a template.

        Args:
            template_id: ID of the template to use
            animal_id: ID of the animal
            organization_id: ID of the organization
            created_by_user_id: ID of the user creating the document
            manual_fields: Manual fields provided by user
            donor_contact_id: Optional contact ID for donor information
            status: Document status (draft or final)

        Returns:
            Created DocumentInstance
        """
        # Get template
        query = select(DocumentTemplate).where(
            DocumentTemplate.id == template_id,
            DocumentTemplate.is_active == True  # noqa: E712
        )
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()

        if not template:
            raise ValueError(f"Template {template_id} not found or not active")

        # Check organization match (template can be global or org-specific)
        if template.organization_id and template.organization_id != organization_id:
            raise ValueError("Template does not belong to this organization")

        # Render the template
        rendered_html = await self.render_template(
            template=template,
            animal_id=animal_id,
            organization_id=organization_id,
            created_by_user_id=created_by_user_id,
            manual_fields=manual_fields,
            donor_contact_id=donor_contact_id,
        )

        # Create document instance
        doc_instance = DocumentInstance(
            organization_id=organization_id,
            animal_id=animal_id,
            template_id=template_id,
            created_by_user_id=created_by_user_id,
            manual_fields=manual_fields or {},
            rendered_html=rendered_html,
            status=status,
        )

        self.db.add(doc_instance)
        await self.db.commit()
        await self.db.refresh(doc_instance)

        return doc_instance
