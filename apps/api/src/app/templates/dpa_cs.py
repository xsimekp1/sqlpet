"""
Czech GDPR Data Processing Agreement (DPA) template.
Filled with organization data at request time.
"""

PROCESSOR_NAME = "Petslog s.r.o."
PROCESSOR_ADDRESS = "Praha, Česká republika"
PROCESSOR_ICO = "TBD"  # TODO: fill when company is registered

DPA_TEMPLATE_CS = """
<div class="dpa-document" style="font-family: Georgia, serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">

<h1 style="text-align: center; font-size: 1.3em; margin-bottom: 0.5em;">
  SMLOUVA O ZPRACOVÁNÍ OSOBNÍCH ÚDAJŮ
</h1>
<p style="text-align: center; color: #666; margin-bottom: 2em;">
  dle čl. 28 Nařízení Evropského parlamentu a Rady (EU) 2016/679 (GDPR)
</p>

<h2 style="font-size: 1.1em;">I. SMLUVNÍ STRANY</h2>

<p><strong>Správce osobních údajů:</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 1em;">
  <tr><td style="width: 40%; padding: 4px 0;">Název:</td><td><strong>{org_name}</strong></td></tr>
  <tr><td style="padding: 4px 0;">Adresa:</td><td>{org_address}</td></tr>
  <tr><td style="padding: 4px 0;">IČO:</td><td>{org_registration_number}</td></tr>
</table>
<p>(dále jen <strong>„Správce"</strong>)</p>

<p><strong>Zpracovatel osobních údajů:</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 1em;">
  <tr><td style="width: 40%; padding: 4px 0;">Název:</td><td><strong>{processor_name}</strong></td></tr>
  <tr><td style="padding: 4px 0;">Adresa:</td><td>{processor_address}</td></tr>
  <tr><td style="padding: 4px 0;">IČO:</td><td>{processor_ico}</td></tr>
</table>
<p>(dále jen <strong>„Zpracovatel"</strong>)</p>

<hr style="margin: 1.5em 0;" />

<h2 style="font-size: 1.1em;">II. PŘEDMĚT SMLOUVY</h2>
<p>
  Zpracovatel poskytuje Správci software PawShelter (ÚtulekOS) — cloudový systém pro správu útulku pro zvířata —
  a v rámci tohoto vztahu zpracovává osobní údaje výhradně na základě dokumentovaných pokynů Správce,
  a to za podmínek stanovených touto smlouvou a Nařízením GDPR.
</p>

<h2 style="font-size: 1.1em;">III. ÚČEL ZPRACOVÁNÍ</h2>
<p>Osobní údaje jsou zpracovávány výhradně za účelem:</p>
<ul>
  <li>správy evidence zvířat v útulku (příjem, umístění, výdej)</li>
  <li>vedení evidence kontaktů (nálezci, adoptéři, dobrovolníci, veterináři, dárci)</li>
  <li>správy dobrovolnické sítě a pěstounské péče</li>
  <li>komunikace s veřejností v rámci adopčního procesu</li>
  <li>vedení lékařské a veterinární dokumentace zvířat</li>
  <li>plnění zákonných povinností provozovatele útulku</li>
</ul>

<h2 style="font-size: 1.1em;">IV. KATEGORIE SUBJEKTŮ ÚDAJŮ</h2>
<ul>
  <li>Zaměstnanci a dobrovolníci Správce</li>
  <li>Nálezci a odevzdávající zvířat</li>
  <li>Zájemci o adopci a adoptéři</li>
  <li>Pěstouni zvířat</li>
  <li>Veterináři a smluvní partneři</li>
  <li>Dárci a sponzoři</li>
</ul>

<h2 style="font-size: 1.1em;">V. TYPY ZPRACOVÁVANÝCH OSOBNÍCH ÚDAJŮ</h2>
<ul>
  <li>Identifikační údaje: jméno, příjmení, datum narození</li>
  <li>Kontaktní údaje: e-mailová adresa, telefonní číslo, adresa bydliště</li>
  <li>Ekonomické údaje: číslo bankovního účtu, daňové identifikační číslo (pro smluvní partnery)</li>
  <li>Provozní údaje: IP adresa, záznamy přihlášení, záznamy činností v systému (audit logy)</li>
  <li>Dokumentační údaje: podpisy na smlouvách, fotodokumentace</li>
</ul>

<h2 style="font-size: 1.1em;">VI. POVINNOSTI ZPRACOVATELE</h2>
<p>Zpracovatel se zavazuje:</p>
<ol>
  <li>zpracovávat osobní údaje pouze na základě dokumentovaných pokynů Správce;</li>
  <li>zajistit, aby osoby oprávněné zpracovávat osobní údaje byly zavázány mlčenlivostí;</li>
  <li>přijmout veškerá opatření požadovaná dle čl. 32 GDPR;</li>
  <li>dodržovat podmínky pro zapojení dalšího zpracovatele (sub-zpracovatelé);</li>
  <li>napomáhat Správci plnit povinnosti vůči subjektům údajů (právo na přístup, výmaz, přenositelnost);</li>
  <li>po ukončení smlouvy vymazat nebo vrátit veškeré osobní údaje Správci;</li>
  <li>poskytnout Správci veškeré informace potřebné k doložení souladu s touto smlouvou.</li>
</ol>

<h2 style="font-size: 1.1em;">VII. TECHNICKÁ A ORGANIZAČNÍ OPATŘENÍ (čl. 32 GDPR)</h2>
<ul>
  <li><strong>Šifrování hesel:</strong> Argon2id (odolné proti brute-force útokům)</li>
  <li><strong>Šifrování přenosu dat:</strong> TLS 1.2+ (HTTPS) na všech koncových bodech</li>
  <li><strong>Autentizace:</strong> JWT tokeny s krátkodobou platností + refresh token rotace</li>
  <li><strong>Řízení přístupu:</strong> RBAC (7 šablon rolí, 22+ oprávnění), princip nejmenšího oprávnění</li>
  <li><strong>Audit logy:</strong> Záznamy o všech změnách klíčových entit (actor, čas, před/po stavu)</li>
  <li><strong>Záznamy přihlášení:</strong> IP adresa, user agent, výsledek (úspěch/selhání)</li>
  <li><strong>Oddělení dat (multi-tenancy):</strong> Každá tabulka obsahuje organization_id; uživatelé vidí pouze data své organizace</li>
  <li><strong>Zálohy databáze:</strong> Automaticky zajišťuje poskytovatel hostingu (Railway) s retencí min. 7 dní</li>
</ul>

<h2 style="font-size: 1.1em;">VIII. SUB-ZPRACOVATELÉ</h2>
<p>Správce bere na vědomí, že Zpracovatel využívá tyto sub-zpracovatele:</p>
<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr style="background: #f5f5f5;">
      <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Sub-zpracovatel</th>
      <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Sídlo</th>
      <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Účel</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">Railway Inc.</td>
      <td style="padding: 8px; border: 1px solid #ddd;">USA (EU region k dispozici)</td>
      <td style="padding: 8px; border: 1px solid #ddd;">Hosting API serveru a PostgreSQL databáze</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">Vercel Inc.</td>
      <td style="padding: 8px; border: 1px solid #ddd;">USA (EU edge síť)</td>
      <td style="padding: 8px; border: 1px solid #ddd;">Hosting webového rozhraní (frontend)</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">Supabase / MinIO</td>
      <td style="padding: 8px; border: 1px solid #ddd;">dle konfigurace</td>
      <td style="padding: 8px; border: 1px solid #ddd;">Úložiště souborů (fotografie, dokumenty)</td>
    </tr>
  </tbody>
</table>

<h2 style="font-size: 1.1em;">IX. DOBA ZPRACOVÁNÍ</h2>
<p>
  Osobní údaje jsou zpracovávány po dobu trvání smluvního vztahu mezi Správcem a Zpracovatelem.
  Po ukončení smluvního vztahu Zpracovatel na základě volby Správce osobní údaje vymaže nebo vrátí
  nejpozději do 30 dnů.
</p>

<h2 style="font-size: 1.1em;">X. ZÁVĚREČNÁ USTANOVENÍ</h2>
<p>
  Tato smlouva se řídí právem České republiky a příslušnými předpisy EU.
  Jakékoliv změny smlouvy musí být provedeny písemně a podepsány oběma smluvními stranami.
</p>

<div style="margin-top: 3em; display: flex; gap: 4em;">
  <div>
    <p><strong>Za Správce:</strong></p>
    <p>{org_name}</p>
    <br/><br/>
    <p>Podpis: _______________________</p>
    <p>Datum: {generated_date}</p>
  </div>
  <div>
    <p><strong>Za Zpracovatele:</strong></p>
    <p>{processor_name}</p>
    <br/><br/>
    <p>Podpis: _______________________</p>
    <p>Datum: {generated_date}</p>
  </div>
</div>

</div>
"""


def render_dpa(
    org_name: str,
    org_address: str,
    org_registration_number: str,
    generated_date: str,
) -> str:
    """Render the Czech DPA template with organization data."""
    return DPA_TEMPLATE_CS.format(
        org_name=org_name or "—",
        org_address=org_address or "—",
        org_registration_number=org_registration_number or "—",
        processor_name=PROCESSOR_NAME,
        processor_address=PROCESSOR_ADDRESS,
        processor_ico=PROCESSOR_ICO,
        generated_date=generated_date,
    )
