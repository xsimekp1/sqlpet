"""Seed script for Roční spotřeba krmiva (Annual Food Consumption) template.

This adds the 'annual_food_consumption' document template to the database.
Run locally:    python scripts/seed_annual_food_consumption_template.py
Run on Railway: railway run python scripts/seed_annual_food_consumption_template.py
"""
import asyncio
from sqlalchemy import select
from src.app.db.session import AsyncSessionLocal
from src.app.models.document_template import DocumentTemplate


TEMPLATE_HTML = """<div style="font-family: Arial, sans-serif; width: 210mm; max-width: 210mm; box-sizing: border-box; margin: 0 auto; padding: 20px; font-size: 12px; line-height: 1.5;">

<!-- ===== Hlavička organizace ===== -->
<div style="margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 14px;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <p style="margin: 0; font-size: 15px; font-weight: bold;">{{org.name}}</p>
      <p style="margin: 2px 0; font-size: 12px; color: #555;">{{org.subtitle}}</p>
      <p style="margin: 2px 0; font-size: 11px; color: #555;">Zastoupená: {{org.representative}}</p>
      <p style="margin: 2px 0; font-size: 11px; color: #555;">{{org.address_line1}}</p>
      <p style="margin: 2px 0; font-size: 11px; color: #555;">Tel.: {{org.phone}} | E-mail: {{org.email}}</p>
    </div>
    <div style="text-align: right; font-size: 11px; color: #777;">
      <p style="margin: 0;">Vygenerováno: {{report.generated_at}}</p>
    </div>
  </div>
</div>

<!-- ===== Nadpis ===== -->
<h1 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">
  Roční spotřeba krmiva
</h1>
<p style="text-align: center; font-size: 14px; font-weight: bold; margin-top: 0; margin-bottom: 20px;">
  Rok {{report.year}}
</p>

<!-- ===== Tabulka ===== -->
<table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
  <thead>
    <tr style="background-color: #f0f0f0;">
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: center; width: 4%;">#</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: left; width: 30%;">Krmivo</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: left; width: 14%;">Typ</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: right; width: 18%;">Množství</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: right; width: 16%;">Hmotnost (kg)</th>
      <th style="border: 1px solid #ccc; padding: 5px 7px; text-align: right; width: 18%;">Cena (Kč)</th>
    </tr>
  </thead>
  <tbody>
    {{data.rows_html}}
  </tbody>
</table>

<!-- ===== Patička ===== -->
<div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
  <p style="font-size: 12px; font-weight: bold; margin: 0;">
    Celkem: {{report.total_weight_kg}} kg &nbsp;|&nbsp; {{report.total_cost}} Kč
  </p>
  <div style="text-align: center; width: 200px;">
    <div style="height: 40px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
    <p style="font-size: 11px; margin: 0;">Podpis a razítko</p>
  </div>
</div>

</div>"""


async def seed_template():
    """Add / update Roční spotřeba krmiva (annual_food_consumption) template in database."""
    async with AsyncSessionLocal() as db:
        query = select(DocumentTemplate).where(
            DocumentTemplate.code == "annual_food_consumption"
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.content_html = TEMPLATE_HTML
            existing.name = "Roční spotřeba krmiva"
            existing.description = (
                "Přehled spotřeby krmiva za kalendářní rok po měsících. "
                "Agreguje výdeje krmiva ze skladu (typ: FOOD, směr: OUT, důvod: CONSUMPTION)."
            )
            await db.commit()
            print(f"✓ Updated template 'annual_food_consumption' (ID: {existing.id})")
            return

        template = DocumentTemplate(
            organization_id=None,  # global template
            code="annual_food_consumption",
            name="Roční spotřeba krmiva",
            language="cs",
            content_html=TEMPLATE_HTML,
            description=(
                "Přehled spotřeby krmiva za kalendářní rok po měsících. "
                "Agreguje výdeje krmiva ze skladu (typ: FOOD, směr: OUT, důvod: CONSUMPTION)."
            ),
            is_active=True,
        )

        db.add(template)
        await db.commit()
        await db.refresh(template)

        print(f"✓ Created template 'annual_food_consumption' (ID: {template.id})")
        print(f"  Name: {template.name}")
        print(f"  Language: {template.language}")
        print(f"  Status: {'Active' if template.is_active else 'Inactive'}")


if __name__ == "__main__":
    print("Seeding annual_food_consumption template...")
    asyncio.run(seed_template())
    print("Done!")
