"""Seed script for Smlouva o vzdání se zvířete (Animal Surrender Contract) template.

This adds the 'surrender_contract_dog' document template to the database.
Run locally:   python scripts/seed_surrender_contract_template.py
Run on Railway: railway run python scripts/seed_surrender_contract_template.py
"""
import asyncio
from sqlalchemy import select
from src.app.db.session import AsyncSessionLocal
from src.app.models.document_template import DocumentTemplate
from src.app.core.config import settings


TEMPLATE_HTML = """<div style="font-family: Arial, sans-serif; width: 210mm; max-width: 210mm; box-sizing: border-box; margin: 0 auto; padding: 20px; font-size: 13px; line-height: 1.5;">

<h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Smlouva o vzdání se zvířete</h1>
<p style="text-align: center; font-size: 13px; margin-bottom: 4px;">(předání zvířete do péče útulku)</p>
<p style="text-align: center; font-size: 11px; color: #555; margin-bottom: 30px;">uzavřená podle § 494 a násl. zákona č. 89/2012 Sb., občanský zákoník</p>

<!-- ===== Čl. I – Smluvní strany ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. I. SMLUVNÍ STRANY</h2>

<p style="margin-bottom: 4px;"><strong>Přejímající (útulek):</strong></p>
<p style="margin-bottom: 2px;">{{org.name}}</p>
<p style="margin-bottom: 2px;">{{org.subtitle}}</p>
<p style="margin-bottom: 2px;">zastoupený/á: {{org.representative}}</p>
<p style="margin-bottom: 2px;">{{org.address_line1}}</p>
<p style="margin-bottom: 14px;">{{org.address_line2}}</p>
<p style="margin-bottom: 20px; font-style: italic;">(dále jen „Přejímající")</p>

<p style="margin-bottom: 4px;"><strong>Předávající (dosavadní majitel/chovatel):</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
  <tr>
    <td style="padding: 3px 0; width: 45%;">Jméno a příjmení:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #999;">{{person.full_name}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">Trvale bytem:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #999;">{{person.address}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">Telefonní kontakt:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #999;">{{person.phone}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">E-mail:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #999;">{{person.email}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">Datum narození:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #999;">{{person.birth_date}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">Číslo OP:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #999;">{{manual.id_card_number}}</td>
  </tr>
</table>
<p style="margin-bottom: 20px; font-style: italic;">(dále jen „Předávající")</p>

<p style="margin-bottom: 20px;">uzavírají níže uvedeného dne, měsíce a roku tuto <strong>Smlouvu o vzdání se zvířete</strong> (dále jen „Smlouva"):</p>

<!-- ===== Čl. II – Předmět smlouvy ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. II. PŘEDMĚT SMLOUVY</h2>

<p style="margin-bottom: 8px;">Předmětem Smlouvy je závazek Předávajícího předat Přejímajícímu níže specifikované zvíře do péče útulku, a to dobrovolně a bezúplatně:</p>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px;">
  <tr>
    <td style="padding: 3px 8px 3px 0; width: 30%; vertical-align: top;">Druh zvířete:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.species}}</td>
    <td style="padding: 3px 8px 3px 16px; width: 20%; vertical-align: top;">Pohlaví:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.sex}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 8px 3px 0; vertical-align: top;">Jméno:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.name}}</td>
    <td style="padding: 3px 8px 3px 16px; vertical-align: top;">Plemeno:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.breed}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 8px 3px 0; vertical-align: top;">Datum narození (přibližné):</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.birth_date}}</td>
    <td style="padding: 3px 8px 3px 16px; vertical-align: top;">Barva srsti:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.color}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 8px 3px 0; vertical-align: top;">Číslo mikročipu:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.microchip}}</td>
    <td style="padding: 3px 8px 3px 16px; vertical-align: top;">Kastrace:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.altered}}</td>
  </tr>
  <tr>
    <td style="padding: 3px 8px 3px 0; vertical-align: top;">Pas č.:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.passport_number}}</td>
    <td style="padding: 3px 8px 3px 16px; vertical-align: top;">Poslední vakcinace:</td>
    <td style="padding: 3px 0; border-bottom: 1px solid #bbb;">{{animal.last_vaccination_date}}</td>
  </tr>
</table>
<p style="margin-bottom: 20px; font-style: italic;">(dále jen „Zvíře")</p>

<!-- ===== Čl. III – Důvod předání ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. III. DŮVOD PŘEDÁNÍ</h2>

<p style="margin-bottom: 6px;">Předávající předává Zvíře z následujícího důvodu:</p>
<p style="margin-bottom: 4px;">
  <span style="margin-right: 12px;">&#9633; Změna životní situace</span>
  <span style="margin-right: 12px;">&#9633; Zdravotní důvody</span>
  <span style="margin-right: 12px;">&#9633; Neshoda se zvířetem</span>
  <span>&#9633; Jiné</span>
</p>
<p style="margin-bottom: 4px;">Upřesnění:</p>
<p style="margin-bottom: 20px; border-bottom: 1px solid #999; padding-bottom: 4px; min-height: 18px;">{{manual.surrender_reason}}</p>

<!-- ===== Čl. IV – Prohlášení předávajícího ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. IV. PROHLÁŠENÍ PŘEDÁVAJÍCÍHO</h2>

<ol style="margin: 0; padding-left: 20px; margin-bottom: 16px;">
  <li style="margin-bottom: 6px;">Předávající prohlašuje, že je <strong>oprávněným vlastníkem</strong> Zvířete nebo osobou oprávněnou s ním nakládat, a že Zvíře není předmětem zástavy, exekuce ani jiného právního omezení.</li>
  <li style="margin-bottom: 6px;">Předávající prohlašuje, že <strong>sdělil Přejímajícímu veškeré jemu známé informace</strong> o zdravotním stavu, povaze a historii Zvířete, a to pravdivě a úplně.</li>
  <li style="margin-bottom: 6px;">Předávající bere na vědomí, že po předání Zvířete <strong>přecházejí veškerá práva a povinnosti vlastníka</strong> na Přejímajícího a Předávající nemá nárok na vrácení Zvířete ani na úhradu jakýchkoli nákladů spojených s péčí o Zvíře v minulosti.</li>
  <li style="margin-bottom: 6px;">Předávající souhlasí s tím, že Přejímající může Zvíře umístit k novým majitelům dle vlastního uvážení a v souladu se svými pravidly.</li>
  <li style="margin-bottom: 6px;">Předávající prohlašuje, že Zvíře <strong>nejeví known agresivní chování</strong> vůči lidem ani jiným zvířatům, nebo toto chování řádně popsal v čl. III.</li>
</ol>

<!-- ===== Čl. V – Předávaná dokumentace ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. V. PŘEDÁVANÁ DOKUMENTACE A VYBAVENÍ</h2>

<p style="margin-bottom: 6px;">Spolu se Zvířetem Předávající předává (zaškrtněte):</p>
<p style="margin-bottom: 4px;">
  <span style="margin-right: 16px;">&#9633; Očkovací průkaz / pas</span>
  <span style="margin-right: 16px;">&#9633; Průkaz původu</span>
  <span style="margin-right: 16px;">&#9633; Obojek a vodítko</span>
  <span>&#9633; Jiné: {{manual.handed_over_items}}</span>
</p>

<!-- ===== Čl. VI – Závěrečná ustanovení ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. VI. ZÁVĚREČNÁ USTANOVENÍ</h2>

<ol style="margin: 0; padding-left: 20px; margin-bottom: 16px;">
  <li style="margin-bottom: 6px;">Smlouva nabývá platnosti a účinnosti dnem podpisu oběma smluvními stranami.</li>
  <li style="margin-bottom: 6px;">Smlouva je sepsána ve 2 vyhotoveních, z nichž každá ze smluvních stran obdrží po jednom.</li>
  <li style="margin-bottom: 6px;">Vztahy touto Smlouvou neupravené se řídí příslušnými ustanoveními zákona č. 89/2012 Sb., občanský zákoník, a zákona č. 246/1992 Sb., na ochranu zvířat proti týrání.</li>
</ol>

<!-- ===== Podpisy ===== -->
<div style="display: flex; justify-content: space-between; margin-top: 48px;">
  <div style="width: 44%;">
    <p style="margin-bottom: 2px;"><strong>V:</strong> ………………………………</p>
    <p style="margin-bottom: 32px;"><strong>Dne:</strong> {{manual.place_date}}</p>
    <p style="margin-bottom: 2px; border-top: 1px solid #000; padding-top: 6px;"><strong>Předávající (dosavadní majitel):</strong></p>
    <p style="margin-bottom: 0;">{{person.full_name}}</p>
  </div>
  <div style="width: 44%;">
    <p style="margin-bottom: 34px;">&nbsp;</p>
    <p style="margin-bottom: 2px; border-top: 1px solid #000; padding-top: 6px;"><strong>Přejímající (útulek):</strong></p>
    <p style="margin-bottom: 0;">{{org.representative}}</p>
    <p style="margin-bottom: 0; font-size: 11px; color: #555;">{{org.name}}</p>
  </div>
</div>

</div>"""


async def seed_template():
    """Add / update Smlouva o vzdání se zvířete template in database."""
    async with AsyncSessionLocal() as db:
        query = select(DocumentTemplate).where(
            DocumentTemplate.code == "surrender_contract_dog"
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.content_html = TEMPLATE_HTML
            existing.name = "Smlouva o vzdání se zvířete"
            existing.description = (
                "Smlouva o dobrovolném předání zvířete do péče útulku (vzdání se zvířete majitelem)."
            )
            await db.commit()
            print("Updated template 'surrender_contract_dog' (ID: " + str(existing.id) + ")")
            return

        template = DocumentTemplate(
            organization_id=None,  # global template
            code="surrender_contract_dog",
            name="Smlouva o vzdání se zvířete",
            language="cs",
            content_html=TEMPLATE_HTML,
            description="Smlouva o dobrovolném předání zvířete do péče útulku (vzdání se zvířete majitelem).",
            is_active=True,
        )

        db.add(template)
        await db.commit()
        await db.refresh(template)

        print("Created template 'surrender_contract_dog' (ID: " + str(template.id) + ")")
        print("  Name: " + template.name)
        print("  Language: " + template.language)


if __name__ == "__main__":
    print("Seeding Smlouva o vzdani se zvirete template...")
    asyncio.run(seed_template())
    print("Done!")
