"""Document template rendering service."""
import re
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.app.models.animal import Animal
from src.app.models.animal_identifier import AnimalIdentifier, IdentifierType
from src.app.models.intake import Intake
from src.app.models.organization import Organization
from src.app.models.contact import Contact
from src.app.models.user import User
from src.app.models.document_template import DocumentTemplate, DocumentInstance, DocumentStatus
from src.app.models.breed_i18n import BreedI18n


SEX_LABELS: dict[str, dict[str, str]] = {
    "cs": {"male": "samec", "female": "samice", "unknown": "neznámé"},
    "en": {"male": "male", "female": "female", "unknown": "unknown"},
}
SPECIES_LABELS: dict[str, dict[str, str]] = {
    "cs": {"dog": "pes", "cat": "kočka", "rodent": "hlodavec", "bird": "pták", "other": "jiný"},
    "en": {"dog": "dog", "cat": "cat", "rodent": "rodent", "bird": "bird", "other": "other"},
}
ALTERED_LABELS: dict[str, dict[str, str]] = {
    "cs": {"neutered": "kastrován", "spayed": "kastrována", "intact": "ne", "unknown": "neznámé"},
    "en": {"neutered": "neutered", "spayed": "spayed", "intact": "intact", "unknown": "unknown"},
}

OUTCOME_LABELS: dict[str, dict[str, str]] = {
    "cs": {
        "adopted": "adopce",
        "returned_to_owner": "vráceno majiteli",
        "deceased": "uhynulo",
        "euthanized": "utraceno",
        "transferred": "přemístěno",
        "escaped": "uprchlo",
    },
    "en": {
        "adopted": "adoption",
        "returned_to_owner": "returned to owner",
        "deceased": "deceased",
        "euthanized": "euthanized",
        "transferred": "transferred",
        "escaped": "escaped",
    },
}

INTAKE_REASON_LABELS: dict[str, dict[str, str]] = {
    "cs": {
        "found": "nalezeno",
        "surrender": "vzdání se",
        "return": "vrácená adopce",
        "official": "úřední",
        "transfer": "přemístění",
        "birth": "narozeno v útulku",
        "other": "jiné",
    },
    "en": {
        "found": "found",
        "surrender": "surrender",
        "return": "adoption return",
        "official": "official",
        "transfer": "transfer",
        "birth": "born in shelter",
        "other": "other",
    },
}

IN_SHELTER_LABEL: dict[str, str] = {"cs": "v útulku", "en": "in shelter"}

A4_STYLE = (
    '<style>'
    '@page{size:A4 portrait;margin:15mm 20mm;}'
    '@media print{body{margin:0;}}'
    '</style>'
)


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
        locale: str = "cs",
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
        animal = await self._get_animal_data(animal_id, organization_id, locale=locale)
        org = await self._get_organization_data(organization_id)
        user = await self._get_user_data(created_by_user_id)
        donor = None
        if donor_contact_id:
            donor = await self._get_contact_data(donor_contact_id, organization_id)

        # Build placeholder context
        context = self._build_context(animal, org, user, donor, manual_fields or {})

        # Render template with placeholders
        rendered_html = self._replace_placeholders(template.content_html, context)

        return A4_STYLE + rendered_html

    async def _get_animal_data(self, animal_id: UUID, organization_id: UUID, locale: str = "cs") -> dict[str, Any]:
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

        # Get primary breed name (locale-aware via BreedI18n)
        breed_name = ""
        if animal.animal_breeds:
            primary_breed = max(
                animal.animal_breeds,
                key=lambda ab: ab.percent if ab.percent else 0,
                default=None
            )
            if primary_breed and hasattr(primary_breed, 'breed') and primary_breed.breed:
                i18n_q = select(BreedI18n).where(
                    BreedI18n.breed_id == primary_breed.breed.id,
                    BreedI18n.locale == locale,
                )
                i18n_row = (await self.db.execute(i18n_q)).scalar_one_or_none()
                breed_name = i18n_row.name if i18n_row else primary_breed.breed.name

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

        # Translate sex (locale-aware)
        sex_str = SEX_LABELS.get(locale, SEX_LABELS["cs"]).get(
            str(animal.sex.value) if hasattr(animal.sex, 'value') else str(animal.sex),
            str(animal.sex.value) if hasattr(animal.sex, 'value') else str(animal.sex),
        )

        # Translate species (locale-aware)
        species_str = SPECIES_LABELS.get(locale, SPECIES_LABELS["cs"]).get(
            str(animal.species.value) if hasattr(animal.species, 'value') else str(animal.species),
            str(animal.species.value) if hasattr(animal.species, 'value') else str(animal.species),
        )

        # Format birth date
        birth_date_str = ""
        if animal.birth_date_estimated:
            birth_date_str = animal.birth_date_estimated.strftime("%d.%m.%Y")

        # Translate altered status (locale-aware)
        altered_key = str(animal.altered_status.value) if animal.altered_status else "unknown"
        altered_str = ALTERED_LABELS.get(locale, ALTERED_LABELS["cs"]).get(altered_key, altered_key)

        return {
            "name": animal.name or "",
            "species": species_str,
            "breed": breed_name,
            "sex": sex_str,
            "age": age_str,
            "birth_date": birth_date_str,
            "color": animal.color or "",
            "microchip": microchip or "",
            "altered": altered_str,
            "passport_number": "",  # TODO: read from AnimalPassport when loaded
            "last_vaccination_date": "",  # TODO: read from AnimalVaccination when loaded
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

        # Use getattr for fields not yet on the model (future org-settings expansion)
        address = org.address or ""
        return {
            "name": org.name or "",
            "subtitle": getattr(org, "subtitle", None) or "",
            "representative": getattr(org, "representative", None) or "",
            "address_line1": getattr(org, "address_line1", None) or address,
            "address_line2": getattr(org, "address_line2", None) or "",
            "phone": getattr(org, "phone", None) or "",
            "email": getattr(org, "email", None) or "",
            "city": getattr(org, "city", None) or "",
            "registration_number": org.registration_number or "",
        }

    async def _get_user_data(self, user_id: UUID) -> dict[str, Any]:
        """Fetch user data."""
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError(f"User {user_id} not found")

        full_name = (
            getattr(user, "full_name", None)
            or f"{getattr(user, 'first_name', None) or ''} {getattr(user, 'last_name', None) or ''}".strip()
            or user.name
            or ""
        )

        return {
            "full_name": full_name,
            "first_name": getattr(user, "first_name", None) or user.name or "",
            "last_name": getattr(user, "last_name", None) or "",
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
        raw_birth_date = getattr(contact, "birth_date", None)
        if raw_birth_date:
            birth_date_str = raw_birth_date.strftime("%d.%m.%Y")

        address = contact.address or ""
        return {
            "full_name": getattr(contact, "full_name", None) or contact.name or "",
            "birth_date": birth_date_str,
            "address": address,
            "address_line1": getattr(contact, "address_line1", None) or address,
            "address_line2": getattr(contact, "address_line2", None) or "",
            "phone": contact.phone or "",
            "email": contact.email or "",
            "zip": getattr(contact, "zip", None) or "",
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

        # manual namespace: all manual_fields accessible as {{manual.key}}
        manual_ns = {k: v for k, v in manual_fields.items()}

        context = {
            "animal": animal,
            "org": org,
            "user": user,
            "donor": donor or {},
            # {{person.*}} = alias for donor/contact (used in surrender contracts)
            "person": donor or {},
            "manual": manual_ns,
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

    async def _get_org_intakes_data(
        self,
        organization_id: UUID,
        year: int,
        locale: str = "cs",
    ) -> list[dict[str, Any]]:
        """Fetch intakes for the given year (excluding hotel stays)."""
        query = (
            select(Intake)
            .options(selectinload(Intake.animal))
            .where(
                Intake.organization_id == organization_id,
                Intake.animal_id != None,  # noqa: E711
                Intake.reason != "hotel",
                Intake.deleted_at == None,  # noqa: E711
                extract("year", Intake.intake_date) == year,
            )
            .order_by(Intake.intake_date.asc())
        )
        result = await self.db.execute(query)
        intakes = result.scalars().all()

        outcome_map = OUTCOME_LABELS.get(locale, OUTCOME_LABELS["cs"])
        reason_map = INTAKE_REASON_LABELS.get(locale, INTAKE_REASON_LABELS["cs"])
        in_shelter = IN_SHELTER_LABEL.get(locale, IN_SHELTER_LABEL["cs"])

        rows = []
        for intake in intakes:
            animal = intake.animal
            if not animal:
                continue

            # Outcome date: prefer intake.actual_outcome_date, fallback animal.outcome_date
            outcome_date = intake.actual_outcome_date or getattr(animal, "outcome_date", None)
            outcome_date_str = outcome_date.strftime("%d.%m.%Y") if outcome_date else ""

            # Outcome type from animal.status
            status_val = str(animal.status.value) if hasattr(animal.status, "value") else str(animal.status)
            outcome_label = outcome_map.get(status_val, in_shelter) if outcome_date else in_shelter

            # Intake reason
            reason_val = str(intake.reason.value) if hasattr(intake.reason, "value") else str(intake.reason)
            reason_label = reason_map.get(reason_val, reason_val)

            rows.append({
                "name": animal.name or "",
                "public_code": animal.public_code or "",
                "species": SPECIES_LABELS.get(locale, SPECIES_LABELS["cs"]).get(
                    str(animal.species.value) if hasattr(animal.species, "value") else str(animal.species), ""
                ),
                "intake_date": intake.intake_date.strftime("%d.%m.%Y") if intake.intake_date else "",
                "intake_reason": reason_label,
                "outcome_date": outcome_date_str,
                "outcome_type": outcome_label,
            })

        return rows

    async def render_org_template(
        self,
        template: DocumentTemplate,
        organization_id: UUID,
        created_by_user_id: UUID,
        year: int,
        locale: str = "cs",
    ) -> str:
        """Render an org-level template (not tied to a specific animal)."""
        org = await self._get_organization_data(organization_id)
        user = await self._get_user_data(created_by_user_id)
        intakes = await self._get_org_intakes_data(organization_id, year, locale)

        # Build rows HTML
        rows_html = ""
        for i, row in enumerate(intakes, start=1):
            rows_html += (
                f'<tr>'
                f'<td style="border:1px solid #ccc;padding:5px 7px;text-align:center;">{i}</td>'
                f'<td style="border:1px solid #ccc;padding:5px 7px;">{row["name"]}</td>'
                f'<td style="border:1px solid #ccc;padding:5px 7px;">{row["public_code"]}</td>'
                f'<td style="border:1px solid #ccc;padding:5px 7px;">{row["species"]}</td>'
                f'<td style="border:1px solid #ccc;padding:5px 7px;text-align:center;">{row["intake_date"]}</td>'
                f'<td style="border:1px solid #ccc;padding:5px 7px;">{row["intake_reason"]}</td>'
                f'<td style="border:1px solid #ccc;padding:5px 7px;text-align:center;">{row["outcome_date"]}</td>'
                f'<td style="border:1px solid #ccc;padding:5px 7px;">{row["outcome_type"]}</td>'
                f'</tr>'
            )

        context = {
            "org": org,
            "user": user,
            "report": {
                "year": str(year),
                "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
                "total": str(len(intakes)),
            },
            "data": {
                "rows_html": rows_html,
            },
        }

        rendered_html = self._replace_placeholders(template.content_html, context)
        return A4_STYLE + rendered_html

    async def create_document_instance(
        self,
        template_id: UUID,
        animal_id: UUID,
        organization_id: UUID,
        created_by_user_id: UUID,
        manual_fields: dict[str, Any] | None = None,
        donor_contact_id: UUID | None = None,
        status: DocumentStatus = DocumentStatus.FINAL,
        locale: str = "cs",
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
            locale=locale,
        )

        # Create document instance
        doc_instance = DocumentInstance(
            organization_id=organization_id,
            animal_id=animal_id,
            template_id=template_id,
            created_by_user_id=created_by_user_id,
            manual_fields=manual_fields or {},
            rendered_html=rendered_html,
            status=status.value if hasattr(status, 'value') else status,
        )

        self.db.add(doc_instance)
        await self.db.commit()
        await self.db.refresh(doc_instance)

        return doc_instance
