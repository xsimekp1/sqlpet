"""Seed script for Darovací smlouva (Donation Contract) template.

This adds the first document template to the database.
Run with: python scripts/seed_donation_contract_template.py
"""
import asyncio
from sqlalchemy import select
from src.app.db.session import AsyncSessionLocal
from src.app.models.document_template import DocumentTemplate
from src.app.core.config import settings


TEMPLATE_HTML = """<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
<h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 5px;">DAROVACÍ SMLOUVA NA PSA</h1>
<p style="text-align: center; font-size: 12px; margin-bottom: 30px;">uzavřená podle § 2055 a násl. zákona č. 89/2012 Sb, občanský zákoník</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px;">Smluvní strany</h2>

<p style="margin-bottom: 5px;"><strong>pan/paní:</strong> {{donor.full_name}}</p>
<p style="margin-bottom: 5px;"><strong>datum narození:</strong> {{donor.birth_date}}</p>
<p style="margin-bottom: 5px;"><strong>bytem:</strong> {{donor.address_line1}}</p>
<p style="margin-bottom: 5px;">{{donor.address_line2}}</p>
<p style="margin-bottom: 5px;"><strong>Telefon:</strong> {{donor.phone}}</p>
<p style="margin-bottom: 15px;"><strong>PSČ:</strong> {{donor.zip}}</p>
<p style="margin-bottom: 20px; font-style: italic;">dále jen „dárce"</p>

<p style="margin-bottom: 5px;"><strong>{{org.name}}</strong></p>
<p style="margin-bottom: 5px;">{{org.subtitle}}</p>
<p style="margin-bottom: 5px;">{{org.representative}}</p>
<p style="margin-bottom: 5px;">{{org.address_line1}}</p>
<p style="margin-bottom: 5px;">{{org.address_line2}}</p>
<p style="margin-bottom: 15px;"><strong>Tel:</strong> {{org.phone}}</p>
<p style="margin-bottom: 30px; font-style: italic;">dále jen „obdarovaný"</p>

<p style="margin-bottom: 30px;"><strong>V {{doc.place}} dne {{doc.date}}</strong></p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px;">Obsah smlouvy</h2>

<h3 style="font-size: 13px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Preambule: Účel smlouvy</h3>
<p style="text-align: justify; margin-bottom: 15px;">
Účelem této darovací smlouvy je bezplatný převod vlastnického práva ke psu
charakterizovanému níže v této smlouvě (viz čl. 1) dárcem na obdarovaného a přijetí
uvedeného daru obdarovaným od dárce s cílem zajistit tak uvedenému psu další život
v řádných podmínkách odpovídajících jeho potřebám a právním předpisům.
</p>

<h3 style="font-size: 13px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Článek 1: Charakteristika psa a jeho identifikační znaky</h3>
<p style="margin-bottom: 5px;"><strong>Jméno:</strong> {{animal.name}}</p>
<p style="margin-bottom: 5px;"><strong>Plemeno:</strong> {{animal.breed}}</p>
<p style="margin-bottom: 5px;"><strong>Pohlaví:</strong> {{animal.sex}}</p>
<p style="margin-bottom: 5px;"><strong>Stáří:</strong> {{animal.age}}</p>
<p style="margin-bottom: 5px;"><strong>Barva:</strong> {{animal.color}}</p>
<p style="margin-bottom: 5px;"><strong>Čip:</strong> {{animal.microchip}}</p>
<p style="margin-bottom: 5px;"><strong>Váha:</strong> {{animal.weight_kg}} kg</p>
<p style="margin-bottom: 15px;"><strong>Případné další vhodné údaje:</strong> {{doc.other_notes}}</p>

<h3 style="font-size: 13px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Prohlášení dárce</h3>
<ul style="margin-bottom: 15px;">
<li style="margin-bottom: 10px; text-align: justify;">
Dárce prohlašuje, že je výhradním vlastníkem psa/kočky, že psa/kočku řádně nabyl do
svého vlastnictví v souladu s příslušnými ustanoveními zákona č. 89/2012 Sb., občanský
zákoník, a že je jakožto výhradní vlastník oprávněn s tímto předmětem daru nakládat, zejm.
jej převést do vlastnictví jiného.
</li>
<li style="margin-bottom: 10px; text-align: justify;">
Dárce dále prohlašuje, že pes, který je předmětem daru dle této smlouvy, byl jakožto
ztracené zvíře, u něhož je zjevné, že mělo vlastníka (avšak z okolností nebylo možno
poznat, komu by mělo být vráceno) a jakožto zvíře zjevně určené k zájmovému chovu,
nalezen dne {{doc.found_date}} na ulici {{doc.found_street}} na území
{{doc.found_city}} v čase {{doc.found_time}}, vedený v evidenci nalezených psů
{{doc.found_registry}}.
</li>
</ul>

<h3 style="font-size: 13px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Článek 2: Ujednání o darování psa</h3>
<p style="text-align: justify; margin-bottom: 15px;">
Dárce touto smlouvou bezplatně převádí vlastnické právo ke psu, jehož identifikační znaky a
charakteristika jsou uvedeny v článku 1 této darovací smlouvy, na obdarovaného a
obdarovaný tento dar přijímá.
</p>

<h3 style="font-size: 13px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Článek 3: Očkovací průkaz a zdravotní stav psa</h3>
<p style="text-align: justify; margin-bottom: 10px;">
<strong>Odst. 1:</strong> Při předání psa byl vydán očkovací průkaz. Pes byl očkován proti vzteklině a jiným
infekčním chorobám, podrobnosti obsahuje očkovací průkaz. Pes je odčerven.
</p>
<p style="text-align: justify; margin-bottom: 5px;">
<strong>Odst. 2:</strong> Dárce před podpisem této darovací smlouvy obdarovaným upozornil obdarovaného na:
</p>
<ul style="margin-bottom: 15px;">
<li><strong>tento zdravotní stav psa:</strong> {{doc.health_state}}</li>
<li><strong>povaha psa:</strong> {{doc.temperament}}</li>
<li><strong>jiné důležité údaje:</strong> {{doc.other_important}}</li>
</ul>

<h3 style="font-size: 13px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Článek 5: Předání psa</h3>
<p style="text-align: justify; margin-bottom: 10px;">
Vlastnictví k předmětu daru přechází na obdarovaného okamžikem, kdy je na základě této
darovací smlouvy předmět daru (výše uvedený pes) předán dárcem obdarovanému a
obdarovaným od dárce převzat. Tímto okamžikem přecházejí na obdarovaného i veškerá
práva s darem spojená, veškeré užitky, nebezpečí a povinnosti. Smluvní strany potvrzují, že
k předání a převzetí psa, který je předmětem daru dle této smlouvy, došlo.
</p>
<p style="margin-bottom: 15px;">
<strong>Místo:</strong> {{doc.handover_place}} <strong>v čase:</strong> {{doc.handover_time}} <strong>dne:</strong> {{doc.handover_date}}
</p>

<h3 style="font-size: 13px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Článek 6: Zpracování osobních údajů</h3>
<p style="text-align: justify; margin-bottom: 15px;">
Obdarovaný souhlasí se zpracováním osobních údajů pro účely související s předmětem této
smlouvy.
</p>

<h3 style="font-size: 13px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">Článek 7: Ostatní ustanovení</h3>
<p style="text-align: justify; margin-bottom: 10px;">
<strong>a)</strong> každý je povinen zabezpečit zvířeti v zájmovém chovu přiměřené podmínky pro
zachování jeho fyziologických funkcí a zajištění jeho biologických potřeb tak, aby
nedocházelo k bolesti, utrpení nebo poškození zdraví zvířete, a učinit opatření proti úniku
zvířat.
</p>
<p style="text-align: justify; margin-bottom: 30px;">
<strong>b)</strong> každý, kdo chová zvíře v zájmovém chovu nebo se ujal toulavého, případně opuštěného
zvířete, odpovídá za jeho zdraví a dobrý stav; za splnění této povinnosti se považuje i
oznámení místa nálezu obci nebo předání toulavého, případně opuštěného zvířete do
útulku.
</p>

<div style="display: flex; justify-content: space-between; margin-top: 50px;">
<div style="text-align: center;">
<p style="margin-bottom: 40px;"><strong>Obdarovaný:</strong></p>
<p>……………………………………………</p>
</div>
<div style="text-align: center;">
<p style="margin-bottom: 40px;"><strong>Za dárce:</strong></p>
<p>……………………………………………</p>
</div>
</div>

</div>"""


async def seed_template():
    """Add Darovací smlouva template to database."""
    async with AsyncSessionLocal() as db:
        # Check if template already exists
        query = select(DocumentTemplate).where(
            DocumentTemplate.code == "donation_contract_dog"
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            print(f"✓ Template 'donation_contract_dog' already exists (ID: {existing.id})")
            return

        # Create new template (global, not org-specific)
        template = DocumentTemplate(
            organization_id=None,  # Global template
            code="donation_contract_dog",
            name="Darovací smlouva na psa",
            language="cs",
            content_html=TEMPLATE_HTML,
            description="Smlouva o bezplatném převodu vlastnického práva ke psu od dárce na organizaci",
            is_active=True,
        )

        db.add(template)
        await db.commit()
        await db.refresh(template)

        print(f"✓ Created template 'donation_contract_dog' (ID: {template.id})")
        print(f"  Name: {template.name}")
        print(f"  Language: {template.language}")
        print(f"  Status: {'Active' if template.is_active else 'Inactive'}")


if __name__ == "__main__":
    print("Seeding Darovací smlouva template...")
    asyncio.run(seed_template())
    print("Done!")
