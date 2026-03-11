"""
Update phone numbers for registered shelters in Supabase.
Run: python scripts/update_shelter_phones.py

This script updates the phone numbers for shelters found via web search.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text

# Supabase connection
DATABASE_URL = "postgresql://postgres.ieubksumlsvsdsvqbalh:Malinva2026+@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

# Phone numbers found via web search
PHONE_UPDATES = [
    # (shelter_id, phone_number)
    ("611cc36b-7161-4a86-ad2a-1d803c645edc", "+420 724 526 537"),  # Azyl Libeň
    ("e4c10c57-86ff-4ded-8782-6e5c318d32b1", "+420 733 601 818"),  # Depozitum u Šimona
    ("54b8ca2f-5f65-4143-8ab8-9af8af2443b9", "+420 602 259 705"),  # Dočasky De De
    (
        "b13ab445-422c-491e-9ba7-cf5cf6c3bf16",
        "+420 603 947 295",
    ),  # Opuštěná a léčebná zvířata Bohnice
    (
        "6420e383-39e1-43be-add2-c0a4c249784f",
        "+420 222 025 929",
    ),  # Útulek Měcholupy (kočky)
    (
        "b0474966-b306-485c-b6ec-878a1f8b7088",
        "+420 605 189 844",
    ),  # LARY odchytová služba
    (
        "c1f43586-cfe6-4e04-aeea-710923043c0d",
        "+420 721 878 458",
    ),  # Kočky České Budějovice
    ("34f25695-42b6-44db-b0e5-3ad2c093dd55", "+420 773 791 322"),  # Útulek Tábor
    ("270136ab-df60-4ce1-8772-bfa3aa95fe5a", "+420 606 345 536"),  # Azyl Pes Krásný Les
    ("f872ec4e-1e8d-4471-9d46-61f9dbfa2d5d", "+420 474 651 080"),  # Psí útulek Chomutov
    (
        "45dc17c2-8cf9-45a5-8471-dbc1b6db76fe",
        "+420 605 801 617",
    ),  # Městský útulek Děčín
    ("02ff6de5-02c7-4c56-80cb-9dfce0e37236", "+420 477 001 730"),  # Útulek Most
    (
        "4131a8c2-9c3a-4de7-9ae2-5106a736f8ba",
        "+420 602 452 171",
    ),  # Kočičí azyl Znojemsko
    ("1cb2ef9f-03fb-4477-8b00-48fe2f307549", "+420 596 412 412"),  # Útulek Havířov
    ("9861cf23-33c0-4de4-96e7-1f4ee67a8207", "+420 599 455 191"),  # Útulek Ostrava
    (
        "ce348129-9fc1-49af-8a28-638aed7ad885",
        "+420 731 435 423",
    ),  # Neposedné tlapky Frýdek-Místek
    ("c28a6c12-1b32-4db3-a4cd-9c94e0f5a0c4", "+420 602 541 060"),  # Útulek Přerov
    ("f3aab305-d237-4772-aefa-aab225c60936", "+420 577 244 444"),  # Útulek Zlín
    (
        "8ae7d6f6-58e4-4776-acc6-1eb5c546df16",
        "+420 721 282 895",
    ),  # Městský útulek Jihlava
    (
        "be3f690f-ef2f-42c5-b95b-f57333355b88",
        "+420 739 010 130",
    ),  # Městský útulek Pardubice
    (
        "f0ac32aa-4a2d-426d-acd8-2080abbac026",
        "+420 601 523 392",
    ),  # Azyl pro zvířata Hradec Králové
    ("7e31a1a4-a8a2-446c-83d2-f5c09a7494fa", "+420 485 106 412"),  # ARCHA Liberec
    ("f0ac32aa-4a2d-426d-acd8-2080abbac026", "+420 603 872 653"),  # Psí útulek Trutnov
    ("6f5fe4db-0ad8-4dab-94f8-049701839a9a", "+420 725 536 158"),  # Útulek Karlovy Vary
    ("9af47220-4bb8-4aad-bdcc-5bc888ab58f5", "+420 602 144 145"),  # Útulek Mělník
    ("ccd2fc72-9536-4aa7-98b4-194848c4bea6", "+420 417 510 504"),  # Útulek Teplice
    (
        "35506329-3894-4a71-aaa6-bb361ef07551",
        "+420 737 142 577",
    ),  # Městský útulek Litvínov
    (
        "c577e5e7-3fc5-42f6-9972-1194b8b642c5",
        "+420 725 712 742",
    ),  # Záchytné kotce Rumburk
]

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    for shelter_id, phone in PHONE_UPDATES:
        result = conn.execute(
            text("UPDATE registered_shelters SET phone = :phone WHERE id = :id"),
            {"phone": phone, "id": shelter_id},
        )
        conn.commit()
        if result.rowcount > 0:
            print(f"OK Updated shelter {shelter_id} with phone {phone}")
        else:
            print(f"FAIL Shelter {shelter_id} not found")

print("\nDone!")
