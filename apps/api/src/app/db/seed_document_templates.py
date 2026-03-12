"""Seed document templates on startup (idempotent - only creates if not exists)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.document_template import DocumentTemplate


# Template definitions
DOCUMENT_TEMPLATES = [
    {
        "code": "annual_intake_report",
        "name": "Výpis přijatých zvířat (roční)",
        "description": "Roční přehled přijatých zvířat pro úřady",
        "html_content": """<div style="font-family: Arial, sans-serif; width: 210mm; max-width: 210mm; box-sizing: border-box; margin: 0 auto; padding: 20px; font-size: 12px; line-height: 1.5;">
<div style="margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 14px;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <p style="margin: 0; font-size: 15px; font-weight: bold;">{{org.name}}</p>
      <p style="margin: 2px 0; font-size: 11px; color: #555;">{{org.address_line1}}</p>
      <p style="margin: 2px 0; font-size: 11px; color: #555;">Tel.: {{org.phone}} | E-mail: {{org.email}}</p>
    </div>
    <div style="text-align: right; font-size: 11px; color: #777;">
      <p style="margin: 0;">Vygenerováno: {{report.generated_at}}</p>
    </div>
  </div>
</div>
<h1 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Výpis přijatých zvířat</h1>
<p style="text-align: center; font-size: 14px; font-weight: bold; margin-top: 0; margin-bottom: 20px;">Rok {{report.year}}</p>
<table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
  <thead>
    <tr style="background-color: #f0f0f0;">
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: center; width: 4%;">#</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: left; width: 14%;">Jméno</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: left; width: 10%;">Interní č.</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: left; width: 8%;">Druh</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: center; width: 11%;">Datum příjmu</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: left;">Poznámka</th>
    </tr>
  </thead>
  <tbody>
    {{#each animals}}
    <tr>
      <td style="border: 1px solid #ccc; padding: 5px 7px; text-align: center;">{{@index_1}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{name}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{public_code}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{species_label}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px; text-align: center;">{{intake_date}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{notes}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
<p style="font-size: 11px; color: #555;">Celkem přijato: <strong>{{animals.length}}</strong> zvířat</p>
</div>""",
    },
    {
        "code": "annual_food_consumption",
        "name": "Spotřeba krmiva (roční)",
        "description": "Roční přehled spotřeby krmiva",
        "html_content": """<div style="font-family: Arial, sans-serif; width: 210mm; max-width: 210mm; box-sizing: border-box; margin: 0 auto; padding: 20px; font-size: 12px; line-height: 1.5;">
<div style="margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 14px;">
  <p style="margin: 0; font-size: 15px; font-weight: bold;">{{org.name}}</p>
  <p style="margin: 2px 0; font-size: 11px; color: #555;">{{org.address_line1}}</p>
</div>
<h1 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase;">Spotřeba krmiva - rok {{report.year}}</h1>
<table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
  <thead>
    <tr style="background-color: #f0f0f0;">
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: left;">Krmivo</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: right;">Množství (kg)</th>
    </tr>
  </thead>
  <tbody>
    {{#each foods}}
    <tr>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{name}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px; text-align: right;">{{quantity_kg}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
<p style="font-size: 11px;"><strong>Celkem:</strong> {{total_kg}} kg</p>
</div>""",
    },
    {
        "code": "website_listing_report",
        "name": "Přehled zvířat na webu",
        "description": "Seznam zvířat zobrazených na veřejném webu",
        "html_content": """<div style="font-family: Arial, sans-serif; width: 210mm; max-width: 210mm; box-sizing: border-box; margin: 0 auto; padding: 20px; font-size: 12px; line-height: 1.5;">
<div style="margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 14px;">
  <p style="margin: 0; font-size: 15px; font-weight: bold;">{{org.name}}</p>
</div>
<h1 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px;">Přehled zvířat na webu</h1>
<p style="text-align: center; font-size: 11px; color: #555; margin-bottom: 20px;">Vygenerováno: {{report.generated_at}}</p>
<table style="width: 100%; border-collapse: collapse; font-size: 11px;">
  <thead>
    <tr style="background-color: #f0f0f0;">
      <th style="border: 1px solid #ccc; padding: 5px 7px;">Jméno</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px;">Druh</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px;">Stav</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px;">Na webu od</th>
    </tr>
  </thead>
  <tbody>
    {{#each animals}}
    <tr>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{name}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{species_label}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{status_label}}</td>
      <td style="border: 1px solid #ccc; padding: 5px 7px;">{{public_since}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
<p style="font-size: 11px; margin-top: 20px;"><strong>Celkem na webu:</strong> {{animals.length}} zvířat</p>
</div>""",
    },
]


async def seed_document_templates(db: AsyncSession) -> int:
    """Seed document templates. Returns number of templates created."""
    created = 0

    for template_data in DOCUMENT_TEMPLATES:
        # Check if template exists
        result = await db.execute(
            select(DocumentTemplate).where(
                DocumentTemplate.code == template_data["code"],
                DocumentTemplate.organization_id.is_(None),  # Global templates
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            continue

        template = DocumentTemplate(
            code=template_data["code"],
            name=template_data["name"],
            description=template_data["description"],
            html_content=template_data["html_content"],
            organization_id=None,  # Global template
            is_active=True,
        )
        db.add(template)
        created += 1

    if created > 0:
        await db.flush()

    return created
