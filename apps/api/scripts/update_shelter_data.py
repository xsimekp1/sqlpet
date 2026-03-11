"""
Update phone, website and email for registered shelters in Supabase.
Run: python scripts/update_shelter_data.py

This script updates the phone, website and email for shelters found via web search.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text

# Supabase connection
DATABASE_URL = "postgresql://postgres.ieubksumlsvsdsvqbalh:Malinva2026+@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

# Shelter data updates: (id, phone, website, email)
SHELTER_UPDATES = [
    # (shelter_id, phone, website, email)
    (
        "611cc36b-7161-4a86-ad2a-1d803c645edc",
        "+420 724 526 537",
        None,
        None,
    ),  # Azyl Libeň
    (
        "e4c10c57-86ff-4ded-8782-6e5c318d32b1",
        "+420 733 601 818",
        None,
        None,
    ),  # Depozitum u Šimona
    (
        "54b8ca2f-5f65-4143-8ab8-9af8af2443b9",
        "+420 602 259 705",
        None,
        None,
    ),  # Dočasky De De
    (
        "b13ab445-422c-491e-9ba7-cf5cf6c3bf16",
        "+420 603 947 295",
        None,
        None,
    ),  # Opuštěná a léčebná zvířata Bohnice
    (
        "6420e383-39e1-43be-add2-c0a4c249784f",
        "+420 222 025 929",
        None,
        None,
    ),  # Útulek Měcholupy (kočky)
    (
        "b0474966-b306-485c-b6ec-878a1f8b7088",
        "+420 605 189 844",
        None,
        None,
    ),  # LARY odchytová služba
    (
        "c1f43586-cfe6-4e04-aeea-710923043c0d",
        "+420 721 878 458",
        "https://www.kockycb.cz/kontakty/",
        "kockycb@seznam.cz",
    ),  # Kočky České Budějovice
    (
        "34f25695-42b6-44db-b0e5-3ad2c093dd55",
        "+420 773 791 322",
        "https://www.utulektabor.cz/",
        "utulek@tstabor.cz",
    ),  # Útulek Tábor
    (
        "270136ab-df60-4ce1-8772-bfa3aa95fe5a",
        "+420 606 345 536",
        "https://azylpes.cz/",
        "info@azylpes.cz",
    ),  # Azyl Pes Krásný Les
    (
        "f872ec4e-1e8d-4471-9d46-61f9dbfa2d5d",
        "+420 474 651 080",
        "https://psiutulekchomutovjirkov.estranky.cz/",
        "psiutulek-chomutov@seznam.cz",
    ),  # Psí útulek Chomutov
    (
        "45dc17c2-8cf9-45a5-8471-dbc1b6db76fe",
        "+420 605 801 617",
        "https://www.utulekdecin.cz/",
        "utulek@mmdecin.cz",
    ),  # Městský útulek Děčín
    (
        "02ff6de5-02c7-4c56-80cb-9dfce0e37236",
        "+420 477 001 730",
        "https://www.utulekmost.cz/",
        "info@utulekmost.cz",
    ),  # Útulek Most
    (
        "4131a8c2-9c3a-4de7-9ae2-5106a736f8ba",
        "+420 602 452 171",
        "http://www.kociciazylznojemsko.cz/",
        "vitmusic@email.cz",
    ),  # Kočičí azyl Znojemsko
    (
        "1cb2ef9f-03fb-4477-8b00-48fe2f307549",
        "+420 596 412 412",
        "https://www.utulekhavirov.cz/",
        "utulek@tsh.cz",
    ),  # Útulek Havířov
    (
        "9861cf23-33c0-4de4-96e7-1f4ee67a8207",
        "+420 599 455 191",
        "https://utulek.ostrava.cz/",
        "utulek@ostrava.cz",
    ),  # Útulek Ostrava
    (
        "ce348129-9fc1-49af-8a28-638aed7ad885",
        "+420 731 435 423",
        "https://www.neposednetlapky.cz/",
        "neposednetlapky@seznam.cz",
    ),  # Neposedné tlapky Frýdek-Místek
    (
        "c28a6c12-1b32-4db3-a4cd-9c94e0f5a0c4",
        "+420 602 541 060",
        "https://www.utulekprerov.cz/",
        "utulek@tsmpr.cz",
    ),  # Útulek Přerov
    (
        "f3aab305-d237-4772-aefa-aab225c60936",
        "+420 577 244 444",
        "https://www.utulekzlin.cz/",
        "utulekzlin@utulekzlin.cz",
    ),  # Útulek Zlín
    (
        "8ae7d6f6-58e4-4776-acc6-1eb5c546df16",
        "+420 721 282 895",
        "https://jihlava.cz/utulek",
        "utulek@jihlava-city.cz",
    ),  # Městský útulek Jihlava
    (
        "be3f690f-ef2f-42c5-b95b-f57333355b88",
        "+420 739 010 130",
        "https://www.utulekpardubice.cz/",
        "sekretariat@mppardubice.cz",
    ),  # Městský útulek Pardubice
    (
        "f0ac32aa-4a2d-426d-acd8-2080abbac026",
        "+420 601 523 392",
        "https://www.azylprozviratahk.cz/",
        "azyl@vslesy.cz",
    ),  # Azyl pro zvířata Hradec Králové
    (
        "7e31a1a4-a8a2-446c-83d2-f5c09a7494fa",
        "+420 485 106 412",
        "https://archa.zooliberec.cz/",
        "utulek@zooliberec.cz",
    ),  # ARCHA Liberec
    (
        "6f5fe4db-0ad8-4dab-94f8-049701839a9a",
        "+420 725 536 158",
        "http://www.utulekpropsy.cz/",
        "info@utulekpropsy.cz",
    ),  # Útulek Karlovy Vary
    (
        "9af47220-4bb8-4aad-bdcc-5bc888ab58f5",
        "+420 602 144 145",
        "https://www.msoz.cz/",
        "info@msoz.cz",
    ),  # Útulek Mělník
    (
        "ccd2fc72-9536-4aa7-98b4-194848c4bea6",
        "+420 417 510 504",
        "https://www.teplice.cz/",
        "utulekteplice@email.cz",
    ),  # Útulek Teplice
    (
        "35506329-3894-4a71-aaa6-bb361ef07551",
        "+420 737 142 577",
        "https://www.mplitvinov.cz/",
        "utulek@mulitvinov.cz",
    ),  # Městský útulek Litvínov
    (
        "c577e5e7-3fc5-42f6-9972-1194b8b642c5",
        "+420 725 712 742",
        "https://www.rumburk.cz/cz/obcan-zachytne-kotce.html",
        "martina.hronikova@rumburk.cz",
    ),  # Záchytné kotce Rumburk
    (
        "15695567-ecb3-44b0-a5a5-88d1df51a063",
        "+420 583 210 759",
        "https://www.olomouckyutulek.cz/",
        "olomouc.utulek-loz@seznam.cz",
    ),  # Liga na ochranu zvířat Olomouc
    (
        "ab7f3f6a-5d3c-483a-8cc4-f98c9edc370e",
        "+420 573 333 553",
        "https://www.utulekkromeriz.cz/",
        "utulek.kromeriz@seznam.cz",
    ),  # Městský útulek Čápka Kroměříž
    (
        "0851a117-24f3-4b82-9101-262e1b449ffb",
        "+420 734 796 370",
        "https://utulek-chrudim.cz/",
        "utulek@tschrudim.cz",
    ),  # Útulek Chrudim
    (
        "9cedf50b-1c82-4198-ba3f-6ad84da1ae5c",
        "+420 606 908 540",
        "https://utulek-kh.estranky.cz/",
        "utulekkh@seznam.cz",
    ),  # MVE Plus Kutná Hora
    (
        "badcddd8-6de3-40c7-abf1-5fcdf227078f",
        "+420 325 512 222",
        None,
        "mestsky@mpnymburk.cz",
    ),  # Město Nymburk - Záchytné kotce
    (
        "5eba375a-87a4-4f92-962c-2a120323986d",
        "+420 777 705 616",
        "https://www.ts-pb.cz/psi-utulek/",
        "utulek@ts-pb.cz",
    ),  # Technické služby Příbram
    (
        "3b63fa56-8eaf-4bd5-94a6-afe95f9c2ba0",
        "+420 321 715 220",
        "https://www.mukolin.cz/utulek/",
        "utulek@mpkolin.cz",
    ),  # Městský útulek Kolín
    # === New updates from web search ===
    (
        "204d5343-f5c5-4e6d-8825-49218dc18e68",
        "+420 604 518 626",
        "https://www.milevsko-mesto.cz/utulek-pro-kocky-mesta-milevska",
        "marta.bardova@milevsko-mesto.cz",
    ),  # Útulek pro kočky Města Milevska
    (
        "ca15b5d1-da01-4086-bd83-ac178fd4d28c",
        "+420 606 768 919",
        "https://kockavsrdci.cz/",
        "kockavsrdci@seznam.cz",
    ),  # Kočka v srdci z.s.
    (
        "70110ee2-6163-4e65-8aa3-bc22d9b04d92",
        "+420 603 765 843",
        "https://utulek-dknl.estranky.cz/",
        "utulek.dknl@seznam.cz",
    ),  # Psí útulek Dvůr Králové n. L
    # === More updates from web search ===
    (
        "4aa2347e-750a-4dc9-8ae6-91629712299d",
        "+420 601 087 018",
        "https://www.utulekostrov.cz/",
        "utulekbety@seznam.cz",
    ),  # Městský útulek Ostrov
    (
        "07403f90-6dac-4f0e-9271-47f1f43ea139",
        "+420 774 749 821",
        "https://www.trinecko.cz/psi-utulek",
        "utulek@trinecko.cz",
    ),  # Městský útulek pro psy Třinec
    (
        "a26a2250-d744-4837-81ac-b633acbe7757",
        "+420 731 124 627",
        "https://www.bohumin.cz/cz/o-meste/utulek-pro-psy",
        "hledamdomov@gmail.com",
    ),  # Útulek pro psy Bohumín
    # === More updates from web search ===
    (
        "1f0bd8bc-bc59-4d87-b3f3-505e9a1c7b24",
        "+420 778 468 605",
        "http://www.psi-jh.estranky.cz/",
        "klarys@centrum.cz",
    ),  # Záchytné kotce Jindřichův Hradec
    # === More updates from web search ===
    (
        "c5635c1a-4264-4beb-b618-ed4f49dad05b",
        "+420 723 778 248",
        "http://www.utulekvm.estranky.cz/",
        "utulekvm@centrum.cz",
    ),  # Městský útulek Velké Meziříčí
    # === More updates from web search ===
    (
        "a841374d-10a9-49db-a138-7fd50486844d",
        "+420 777 118 185",
        "https://www.utuleknovapaka.cz/",
        "misto.novapaka@gmail.com",
    ),  # MÍSTO Nová Paka
    # === More updates from web search ===
    (
        "9786da95-1c4a-4b4e-b65f-9fe72bf166fc",
        "+420 384 758 011",
        None,
        "info@meu.velenice.cz",
    ),  # Záchytné kotce Jungmannova České Velenice
    # === More updates from web search ===
    (
        "78a01112-dac6-42e9-976f-558039b19664",
        "+420 602 425 210",
        "https://www.svitavy.cz/mestsky-utulek-pro-opustene-psy",
        "jiri.hainc@svitavy.cz",
    ),  # Městský útulek Svitavy
    # === More updates from web search ===
    (
        "14880831-2714-4798-b2a9-13767739558d",
        "+420 734 597 049",
        "https://kockysobe.estranky.cz/",
        "kockysobe@seznam.cz",
    ),  # KOČKY SOBĚ z.s.
    # === More updates from web search ===
    (
        "634fe452-6479-4257-b8cf-ffbbf8443523",
        "+420 724 813 222",
        "https://phlanskroun.cz/",
        "renata@petheroes.cz",
    ),  # Pet Heroes Lanškroun
    # === More updates from web search ===
    (
        "d3afc679-60b6-4bbe-92f0-d88e67cf0ab2",
        "+420 732 136 390",
        "https://kocici-spolek-slatina.webnode.cz/",
        "spolekslatina@seznam.cz",
    ),  # Kočičí spolek Slatina
    # === More updates from web search ===
    (
        "d2c5bf4d-c43a-4822-bdf7-481c390ba156",
        "+420 604 700 501",
        "https://utulek-pro-psy.cz/",
        "utulekzdar@seznam.cz",
    ),  # Psí útulek Žďár nad Sázavou
    # === More updates from web search ===
    (
        "079b14d4-6622-4c79-ba2d-fb8d775a4b2e",
        "+420 774 755 787",
        "https://www.mikeshb.cz/",
        "mikeshb@seznam.cz",
    ),  # Kočičí útulek Mikeš HB
    # === More updates from web search ===
    (
        "bf898128-3ef3-40e3-945b-6b233d537ed7",
        "+420 606 795 858",
        "https://www.psiutulek.klatovynet.cz/",
        "seflova@tsklatovy.cz",
    ),  # Psí útulek Klatovy
    # === More updates from web search ===
    (
        "4832fa67-3959-41f8-a334-1bec8c7f3686",
        None,
        "http://animalsos.cz/",
        None,
    ),  # ANIMAL'S OS
    (
        "3b9672ad-92ce-4ed8-a857-9111b690e62f",
        "+420 724 059 157",
        None,
        "psidrhovice@seznam.cz",
    ),  # Psi pomáhají
    (
        "365d9931-ccbc-46b3-b38c-8a04a1565bd2",
        "+420 607 707 537",
        "https://depozitum-chlupnechlup.webnode.cz/",
        "ditau@email.cz",
    ),  # Depozitum Chlupnechlup
    (
        "7662d0bc-4f1d-42a0-afc0-da092c76048e",
        "+420 602 486 070",
        None,
        "meu@dacice.cz",
    ),  # Město Dačice - odchyt
    (
        "e4d6707e-d9d0-4606-bd47-2bb73d4968dc",
        "+420 602 447 834",
        "https://firmy.euro.cz/subjekt-technicke-sluzby-mesta-nova-bystrice-s-r-o-25185691",
        None,
    ),  # Technické služby Nová Bystřice
    (
        "feb997ae-ca27-47c9-904d-676eec3dc9f9",
        "+420 777 359 040",
        None,
        "Kadlecka1@seznam.cz",
    ),  # Adámkův zvířecí azyl
    (
        "a6b9593a-1d31-402f-9bf9-db7c5b293976",
        "+420 605 174 466",
        "https://kocici-azyl.cz/",
        "dastinek.ustup@seznam.cz",
    ),  # Azyl Jiřina Skoumalová
    (
        "e8df90b2-6169-41f9-82d2-4cf8031969df",
        "+420 603 504 660",
        "https://brnenskymax.estranky.cz/",
        "brnenskymax@seznam.cz",
    ),  # Brněnský Max
    (
        "e090a8f9-d638-4db7-8a54-adc603aa5d68",
        "+420 777 866 555",
        "https://www.psiostrov.cz/cs/",
        "info@psiostrov.cz",
    ),  # Dočasky.cz / Centrum Psí ostrov
    (
        "9ed9480a-a864-4a1d-a167-67a853d528d5",
        "+420 602 166 969",
        None,
        "kocicioaza@email.cz",
    ),  # Kočičí oáza
    (
        "0eb65e4c-8258-4a4d-9426-43915dc11310",
        "+420 721 156 156",
        "https://www.veseli-nad-moravou.cz/",
        "posta@veseli-nad-moravou.cz",
    ),  # Město Veselí nad Moravou
    (
        "dc2f0f3e-fa27-4ca3-83c4-af5b9ca544ac",
        "+420 737 911 605",
        "https://www.sportoviste-blansko.cz/utulek-pro-psy",
        "maytainfo@gmail.com",
    ),  # Obecní útulek pro psy Blansko
    (
        "05c19bdc-bc39-46f2-b8c8-1befef8bf0d6",
        "+420 733 774 430",
        "https://www.kocicitlapky.cz/",
        "info@kocicitlapky.cz",
    ),  # OKT Opuštěné kočičí tlapky
    (
        "d4184adb-9d05-469a-b38c-ae58f2a918a3",
        "+420 723 040 495",
        "https://www.utulekbreclavbulhary.cz/",
        "utulekbreclavbulhary@seznam.cz",
    ),  # Útulek Bulhary
    (
        "20b4ce6f-f71e-4149-8236-4fe412c54ce2",
        "+420 731 712 275",
        None,
        "zviretnik.org@gmail.com",
    ),  # Zvířetník Omice
    # === More updates from web search ===
    (
        "63c3c330-0874-49a2-9679-86584a569666",
        "+420 607 567 525",
        "https://hledaczvirat.cz/uzivatel/LOZPisek",
        "mackmi@atlas.cz",
    ),  # LOZ Písek
    (
        "139a7d47-e171-48e4-8cb4-5f6d4d274529",
        "+420 731 115 900",
        "https://nnnn.webnode.cz/utulky-pro-zviratka/",
        "formajan@seznam.cz",
    ),  # Záchytné kotce Třeboň
    (
        "627c6acb-0ad7-4cd4-b9db-72a0bd7786da",
        None,
        "https://www.detail.cz/firma/25177419-utulek-pro-kone-costa-sro-heim-fur-pferde-und-andere-tiere-tesinov-31-petrikov/",
        None,
    ),  # Útulek pro koně COSTA
    # === More updates from web search ===
    (
        "49230847-0338-4630-a419-122583f2bf35",
        "+420 724 077 264",
        "https://psi-dobris.estranky.cz/",
        "pesoklub@seznam.cz",
    ),  # Psí útulek Dobříš
    (
        "b7ded04c-865f-4231-867b-335d1e2f8101",
        "+420 775 105 275",
        "https://utulek-kralupy.estranky.cz/",
        "kolkova@seznam.cz",
    ),  # Městský útulek Kralupy nad Vltavou Lesan
    (
        "71ec4ba7-09bb-4ef5-a9c7-2a68232a9bec",
        "+420 604 787 205",
        "https://fuklubko.estranky.cz/",
        "utulek@fretka.cz",
    ),  # Fretčí útulek Klubko
    (
        "cd09b253-ad20-4c4a-a79f-b1ce6e8f785b",
        None,
        "https://kociciapsiazyl.cz/",
        "mail@kociciapsiazyl.cz",
    ),  # Kočičí a psí azyl
    # === More updates from web search ===
    (
        "21884dac-752c-4aaa-8a18-c649d3f3eb2c",
        "+420 491 847 151",
        None,
        "mertlikova@jaromer-josefov.cz",
    ),  # Městský útulek Jaroměř
    (
        "115f713b-e18b-432c-92a9-e1b9605f823d",
        "+420 737 269 889",
        "https://www.mujicin.cz/mestska-zachytna-stanice-psu/ds-29506/p1=61051",
        "dolezalova@mujicin.cz",
    ),  # Záchytná stanice Zebín Jičín
    (
        "0540f06b-7615-4d78-85e4-8d1c73859034",
        "+420 732 289 552",
        "https://www.kockytrutnov.cz/",
        "info@kockytrutnov.cz",
    ),  # Kočky Trutnov
    (
        "27fb0006-0792-45d6-8087-d560ce0a432b",
        "+420 773 023 018",
        "https://www.srdcem-pro-psy.cz/",
        "srdcem-pro-psy@seznam.cz",
    ),  # Srdcem pro psy Turnov
    # === More updates from web search ===
    (
        "80e88d33-dd47-49b8-af11-1a002793e1b6",
        "+420 577 004 800",
        "https://www.mesto-slavicin.cz/",
        "podatelna@mesto-slavicin.cz",
    ),  # Město Slavičín
]

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    for shelter_id, phone, website, email in SHELTER_UPDATES:
        updates = {"id": shelter_id}
        query_parts = []

        if phone:
            query_parts.append("phone = :phone")
            updates["phone"] = phone
        if website:
            query_parts.append("website = :website")
            updates["website"] = website
        if email:
            query_parts.append("email = :email")
            updates["email"] = email

        if query_parts:
            query = text(
                f"UPDATE registered_shelters SET {', '.join(query_parts)} WHERE id = :id"
            )
            result = conn.execute(query, updates)
            conn.commit()
            if result.rowcount > 0:
                print(f"OK Updated {shelter_id}")
            else:
                print(f"FAIL Shelter {shelter_id} not found")

print("\nDone!")
