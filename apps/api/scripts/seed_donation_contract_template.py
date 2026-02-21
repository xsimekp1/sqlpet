"""Seed script for Darovací smlouva / Adopční smlouva (Donation/Adoption Contract) template.

This adds the 'donation_contract_dog' document template to the database.
Run locally:   python scripts/seed_donation_contract_template.py
Run on Railway: railway run python scripts/seed_donation_contract_template.py
"""
import asyncio
from sqlalchemy import select
from src.app.db.session import AsyncSessionLocal
from src.app.models.document_template import DocumentTemplate
from src.app.core.config import settings


TEMPLATE_HTML = """<div style="font-family: Arial, sans-serif; width: 210mm; max-width: 210mm; box-sizing: border-box; margin: 0 auto; padding: 20px; font-size: 13px; line-height: 1.5;">

<h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Darovací smlouva</h1>
<p style="text-align: center; font-size: 13px; margin-bottom: 4px;">(adopční smlouva)</p>
<p style="text-align: center; font-size: 11px; color: #555; margin-bottom: 30px;">uzavřená podle § 2055 a násl. zákona č. 89/2012 Sb., občanský zákoník</p>

<!-- ===== Čl. I – Smluvní strany ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. I. SMLUVNÍ STRANY</h2>

<p style="margin-bottom: 4px;"><strong>Předávající (dárce):</strong></p>
<p style="margin-bottom: 2px;">{{org.name}}</p>
<p style="margin-bottom: 2px;">{{org.subtitle}}</p>
<p style="margin-bottom: 2px;">zastoupená: {{org.representative}}</p>
<p style="margin-bottom: 2px;">{{org.address_line1}}</p>
<p style="margin-bottom: 2px;">{{org.address_line2}}</p>
<p style="margin-bottom: 14px;">Tel.: {{org.phone}}</p>
<p style="margin-bottom: 20px; font-style: italic;">(dále jen „Předávající")</p>

<p style="margin-bottom: 4px;"><strong>Obdarovaný (Osvojitel):</strong></p>
<p style="margin-bottom: 2px;">{{donor.full_name}}</p>
<p style="margin-bottom: 2px;">datum narození: {{donor.birth_date}}</p>
<p style="margin-bottom: 2px;">bytem: {{donor.address_line1}}</p>
<p style="margin-bottom: 2px;">{{donor.address_line2}}</p>
<p style="margin-bottom: 2px;">PSČ: {{donor.zip}}</p>
<p style="margin-bottom: 14px;">Tel.: {{donor.phone}}</p>
<p style="margin-bottom: 20px; font-style: italic;">(dále jen „Obdarovaný")</p>

<!-- ===== Čl. II – Předmět smlouvy ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. II. PŘEDMĚT SMLOUVY</h2>

<p style="margin-bottom: 10px; text-align: justify;">
  Předmětem Smlouvy je závazek Předávajícího bezplatně převést do vlastnictví Obdarovaného níže
  specifikované zvíře (dále jen „Zvíře") a závazek Obdarovaného Zvíře přijmout za podmínek
  uvedených v této Smlouvě, které se zavazuje dodržovat.
</p>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
  <tr>
    <td style="border: 1px solid #000; padding: 6px; width: 50%;"><strong>Druh zvířete:</strong> pes</td>
    <td style="border: 1px solid #000; padding: 6px; width: 50%;"><strong>Jméno:</strong> {{animal.name}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Pohlaví:</strong> {{animal.sex}}</td>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Přibližný datum narození:</strong> {{animal.age}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Plemeno:</strong> {{animal.breed}}</td>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Barva a typ srsti:</strong> {{animal.color}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Číslo mikročipu:</strong> {{animal.microchip}}</td>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Váha:</strong> {{animal.weight_kg}} kg</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Kastrace:</strong> &#9744; ano &nbsp; &#9744; ne &nbsp; &#9744; nezjištěno</td>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Pas / průkaz původu:</strong> &nbsp;</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Vakcinace – datum:</strong> &nbsp;</td>
    <td style="border: 1px solid #000; padding: 6px;"><strong>Antiparazitika – datum:</strong> &nbsp;</td>
  </tr>
</table>

<p style="margin-bottom: 4px;"><strong>Zdravotní stav:</strong> {{doc.health_state}}</p>
<p style="margin-bottom: 4px;"><strong>Povaha a specifické projevy chování:</strong> {{doc.temperament}}</p>
<p style="margin-bottom: 4px;"><strong>Jiné důležité informace:</strong> {{doc.other_important}}</p>
<p style="margin-bottom: 14px;"><strong>Předané dokumenty:</strong> {{doc.other_notes}}</p>

<!-- ===== Čl. III – Povinnosti Obdarovaného ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. III. POVINNOSTI A ZÁVAZKY OBDAROVANÉHO</h2>

<p style="margin-bottom: 8px; text-align: justify;">
  1. Obdarovaný se zavazuje neprodleně po převzetí Zvíře přihlásit v místě bydliště na příslušném
  úřadu, pravidelně hradit poplatky z držení psa a zajistit evidenci čipu do 7 dnů od podpisu
  Smlouvy na své jméno v Národním registru chovatelů zvířat (narodniregistr.cz). Zajistí Zvíře
  proti útěku a odcizení.
</p>

<p style="margin-bottom: 4px; text-align: justify;">2. Obdarovaný je povinen zajistit Zvířeti odpovídající životní podmínky, zejména:</p>
<ul style="margin-bottom: 10px; padding-left: 20px; text-align: justify;">
  <li style="margin-bottom: 4px;">Zvíře nebude trvale ani dočasně drženo na řetězu, v kotci, v uzavřené místnosti bez světla nebo bez možnosti výběhu.</li>
  <li style="margin-bottom: 4px;">Zvíře bude mít dostatečnou a pravidelnou možnost pohybu a vycházek odpovídající jeho potřebám. Obdarovaný neumožní Zvířeti pohyb na veřejném prostranství bez dozoru.</li>
  <li style="margin-bottom: 4px;">Zvíře bude krmeno nejméně jednou denně dostatečným množstvím vhodné potravy a bude mít neustálý přístup k čisté pitné vodě.</li>
  <li style="margin-bottom: 4px;">Zvíři bude zajištěna odborná veterinární péče, všechna potřebná očkování dle zákona a pravidelné odčervení.</li>
</ul>

<p style="margin-bottom: 6px; text-align: justify;">
  3. V případě převzetí nekastrovaného Zvířete je Obdarovaný povinen zajistit kastraci na vlastní
  náklady. U samic přibližně okolo prvního hárání (cca 7. měsíc věku), u samců po dovršení
  8. měsíce. Do kastrace zajistí, aby se Zvíře za žádných okolností dále nemnožilo.
  Obdarovaný je povinen zaslat lékařskou zprávu potvrzující provedení kastrace (včetně čísla
  čipu) a fotografii Zvířete s operační ránou.
</p>
<p style="margin-bottom: 14px;">
  Adoptované Zvíře bude vykastrováno v době od: ………………………… nejpozději do: …………………………
</p>

<p style="margin-bottom: 8px; text-align: justify;">
  4. Obdarovaný se zavazuje nepoužívat vůči Zvířeti tresty, které mohou být trýznivé nebo
  poškozovat jeho fyzický či psychický stav, a dodržovat zákon č. 246/1992 Sb., o ochraně
  zvířat proti týrání, a všechny příslušné právní předpisy.
</p>

<p style="margin-bottom: 8px; text-align: justify;">
  5. Obdarovaný je povinen neprodleně informovat Předávajícího o: změně bydliště, zranění nebo
  závažné změně zdravotního stavu Zvířete, ztrátě nebo úhynu Zvířete, a o nemožnosti nadále
  Zvíře chovat.
</p>

<p style="margin-bottom: 8px; text-align: justify;">
  6. Obdarovaný se zavazuje umožnit Předávajícímu a jím pověřeným osobám provádění kontrol
  Zvířete, a to kdykoliv i bez předchozího upozornění. Pověřená osoba se prokáže originálem
  nebo fotokopií této Smlouvy.
</p>

<p style="margin-bottom: 8px; text-align: justify;">
  7. Ke změně držitele Zvířete je nutný písemný souhlas Předávajícího, na jehož základě bude
  sepsána nová smlouva s novým držitelem. V případě nespokojenosti nového držitele bude
  Zvíře vráceno Předávajícímu, nikoli třetí osobě. Pokud Obdarovaný nebude nadále schopen se
  o Zvíře starat, je povinen kontaktovat Předávajícího a Zvíře po domluvě vrátit.
</p>

<p style="margin-bottom: 8px; text-align: justify;">
  8. Obdarovaný se zavazuje zasílat fotografie Zvířete přibližně každých 6 měsíců na e-mail
  Předávajícího (poprvé nejpozději do 7 dnů od adopce) a poskytnout fotodokumentaci kdykoli
  na vyžádání.
</p>

<!-- ===== Čl. IV – Prohlášení Obdarovaného ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. IV. PROHLÁŠENÍ OBDAROVANÉHO</h2>

<p style="margin-bottom: 8px; text-align: justify;">
  1. Obdarovaný prohlašuje, že si Zvíře řádně prohlédl, seznámil se s jeho zdravotním stavem a
  přijímá jej bez výhrad. Je si vědom, že Předávající nezná komplexní historii Zvířete a
  neodpovídá za jeho temperament, zdraví, mentální dispozice ani výcvik.
</p>
<p style="margin-bottom: 8px; text-align: justify;">
  2. Bude-li Obdarovaný požadovat vydání Zvířete před uplynutím karanténní doby a zjištěním
  zdravotního stavu, přechází odpovědnost za případná zdravotní rizika na Obdarovaného dnem
  předání Zvířete. Obdarovaný na sebe přebírá veškerou odpovědnost za chov a péči o Zvíře
  a odpovídá za škody způsobené Zvířetem ode dne předání.
</p>
<p style="margin-bottom: 8px; text-align: justify;">
  3. Obdarovaný zároveň se Zvířetem přebírá: &nbsp; &#9744; Očkovací průkaz &nbsp; &#9744; Pas &nbsp; &#9744; Průkaz původu
</p>
<p style="margin-bottom: 14px; text-align: justify;">
  4. Obdarovaný souhlasí se zveřejněním fotografií a informací o Zvířeti na webu a sociálních sítích Předávajícího: &nbsp; &#9744; ANO &nbsp; &#9744; NE
</p>

<!-- ===== Čl. V – Práva Předávajícího a pokuty ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. V. PRÁVA PŘEDÁVAJÍCÍHO A SMLUVNÍ POKUTY</h2>

<p style="margin-bottom: 8px; text-align: justify;">
  1. Předávající je oprávněn odstoupit od Smlouvy v případě porušení jakékoliv povinnosti
  Obdarovaného dle čl. III. Smlouvy. Odstoupení je účinné okamžikem doručení Obdarovanému.
  Obdarovaný je povinen neprodleně Zvíře předat Předávajícímu. Nemá nárok na náhradu nákladů
  vynaložených v době péče o Zvíře ani na vrácení adopčního poplatku. Zvíře bude odebráno
  i v případě, že nebude možné s Obdarovaným navázat kontakt.
</p>
<p style="margin-bottom: 8px; text-align: justify;">
  2. V případě hrubého porušení závazků dle čl. III. odst. 2, 3, 4, 5 je Obdarovaný povinen
  uhradit Předávajícímu smluvní pokutu ve výši <strong>25 000 Kč</strong> (slovy: dvacet pět tisíc korun
  českých), splatnou do 3 pracovních dnů ode dne zjištění porušení. Vedle smluvní pokuty
  je Obdarovaný povinen uhradit Předávajícímu vzniklou škodu a náklady na veterinární péči
  a dopravu Zvířete.
</p>
<p style="margin-bottom: 14px; text-align: justify;">
  3. V případě jiného porušení závazků dle čl. III. je Předávající oprávněn uložit Obdarovanému
  smluvní pokutu <strong>5 000 Kč</strong> (slovy: pět tisíc korun českých), splatnou do 3 pracovních dnů
  ode dne zjištění porušení.
</p>

<!-- ===== Čl. VI – Předání Zvířete ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. VI. PŘEDÁNÍ ZVÍŘETE</h2>

<p style="margin-bottom: 8px; text-align: justify;">
  Vlastnictví ke Zvířeti přechází na Obdarovaného okamžikem předání. Tímto okamžikem přecházejí
  na Obdarovaného veškerá práva, užitky, nebezpečí a povinnosti spojené se Zvířetem.
  Smluvní strany potvrzují, že k předání a převzetí Zvířete došlo:
</p>
<p style="margin-bottom: 4px;"><strong>Místo předání:</strong> {{doc.handover_place}}</p>
<p style="margin-bottom: 4px;"><strong>Datum předání:</strong> {{doc.handover_date}}</p>
<p style="margin-bottom: 14px;"><strong>Čas předání:</strong> {{doc.handover_time}}</p>

<!-- ===== Čl. VII – GDPR ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. VII. ZPRACOVÁNÍ OSOBNÍCH ÚDAJŮ</h2>

<p style="margin-bottom: 8px; text-align: justify;">
  Předávající zpracovává osobní údaje Obdarovaného uvedené v záhlaví Smlouvy za účelem realizace
  Smlouvy a výkonu právních nároků. Právním základem je nezbytnost zpracování pro splnění
  smlouvy. Osobní údaje budou uchovávány po dobu stanovenou příslušnými předpisy a dále
  po dobu 4 let od smrti Zvířete. Obdarovaný má právo na přístup k osobním údajům, jejich
  opravu nebo výmaz, omezení zpracování, právo vznést námitku a právo podat stížnost
  u Úřadu pro ochranu osobních údajů. Poskytnutí osobních údajů je podmínkou uzavření Smlouvy.
</p>
<p style="margin-bottom: 4px;">Souhlasím se zasíláním novinek a zpráv z útulku: &nbsp; &#9744; ANO &nbsp; &#9744; NE</p>
<p style="margin-bottom: 14px;">Souhlasím s pořízením a zveřejněním mé fotografie na webu a sociálních sítích Předávajícího: &nbsp; &#9744; ANO &nbsp; &#9744; NE</p>

<!-- ===== Čl. VIII – Závěrečná ustanovení ===== -->
<h2 style="font-size: 14px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Čl. VIII. ZÁVĚREČNÁ USTANOVENÍ</h2>

<p style="margin-bottom: 4px; text-align: justify;">1. Smlouva nabývá platnosti a účinnosti dnem podpisu oběma smluvními stranami.</p>
<p style="margin-bottom: 4px; text-align: justify;">2. Jakékoliv změny Smlouvy je možné činit výslovně ve formě písemných, chronologicky číslovaných dodatků.</p>
<p style="margin-bottom: 4px; text-align: justify;">3. Jestliže jakékoliv ustanovení Smlouvy je nebo se stane neplatným, nemá to vliv na zbývající ustanovení.</p>
<p style="margin-bottom: 4px; text-align: justify;">4. Obdarovaný souhlasí s úhradou veškerých soudních nákladů vzniklých v souvislosti s vymáháním podmínek Smlouvy.</p>
<p style="margin-bottom: 4px; text-align: justify;">5. Účastníci prohlašují, že Smlouvu řádně přečetli, pochopili její znění a plně s ním souhlasí. Smlouva nebyla sjednána v tísni ani za nápadně nevýhodných podmínek.</p>
<p style="margin-bottom: 20px; text-align: justify;">6. Smlouva je sepsána ve 2 vyhotoveních; každá smluvní strana obdrží po jednom.</p>

<p style="margin-top: 30px;"><strong>V {{doc.place}} dne {{doc.date}}</strong></p>

<!-- Podpisy -->
<div style="display: flex; justify-content: space-between; margin-top: 60px;">
  <div style="text-align: center; width: 44%;">
    <p style="margin-bottom: 40px; height: 1px; border-top: 1px solid #000;"></p>
    <p style="margin-bottom: 2px;"><strong>Předávající</strong></p>
    <p style="margin-bottom: 0;">{{org.name}}</p>
    <p style="margin-bottom: 0; font-size: 11px;">{{org.representative}}</p>
  </div>
  <div style="text-align: center; width: 44%;">
    <p style="margin-bottom: 40px; height: 1px; border-top: 1px solid #000;"></p>
    <p style="margin-bottom: 2px;"><strong>Obdarovaný (Osvojitel)</strong></p>
    <p style="margin-bottom: 0;">{{donor.full_name}}</p>
  </div>
</div>

</div>"""


async def seed_template():
    """Add / update Darovací smlouva (adopční) template in database."""
    async with AsyncSessionLocal() as db:
        query = select(DocumentTemplate).where(
            DocumentTemplate.code == "donation_contract_dog"
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            # Update content so re-running the script refreshes the template
            existing.content_html = TEMPLATE_HTML
            existing.name = "Darovací smlouva – pes (adopční)"
            existing.description = (
                "Darovací / adopční smlouva – převod psa z útulku na nového majitele."
            )
            await db.commit()
            print(f"✓ Updated template 'donation_contract_dog' (ID: {existing.id})")
            return

        template = DocumentTemplate(
            organization_id=None,  # global template
            code="donation_contract_dog",
            name="Darovací smlouva – pes (adopční)",
            language="cs",
            content_html=TEMPLATE_HTML,
            description="Darovací / adopční smlouva – převod psa z útulku na nového majitele.",
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
    print("Seeding Darovací smlouva (adopční) template...")
    asyncio.run(seed_template())
    print("Done!")
