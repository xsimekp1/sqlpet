#!/usr/bin/env python3
"""
Diagnostika: porovná URL pole fotek u všech zvířat.
Ukáže co mají Hafik, Bobeš, Kikina vs. ostatní zvířata.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.app.core.config import settings


async def main():
    engine = create_async_engine(settings.DATABASE_URL_ASYNC)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # 1. Stav všech zvířat
        # NOTE: thumbnail_url is computed at API response time (not stored in DB).
        # The stored photo columns are: primary_photo_url, default_image_url, default_thumbnail_url.
        rows = await db.execute(
            text("""
            SELECT name, species, color,
                   primary_photo_url IS NOT NULL AS has_primary,
                   default_image_url IS NOT NULL AS has_default,
                   default_thumbnail_url IS NOT NULL AS has_def_thumb,
                   primary_photo_url, default_image_url, default_thumbnail_url
            FROM animals
            ORDER BY name
        """)
        )
        all_animals = rows.fetchall()

        print("=== VŠECHNA ZVÍŘATA ===")
        print(
            f"{'Jméno':<20} {'Druh':<8} {'primary':<8} {'default':<8} {'defthumb':<9} {'URL'}"
        )
        for r in all_animals:
            url_sample = (
                r.primary_photo_url or r.default_image_url or r.default_thumbnail_url or "NULL"
            )[:60]
            flag = (
                "[!] "
                if not r.has_primary and not r.has_default
                else "[ok]"
            )
            print(
                f"{flag}{r.name:<18} {r.species:<8} {str(r.has_primary):<8} {str(r.has_default):<8} {str(r.has_def_thumb):<9} {url_sample}"
            )

        # 2. Stav default_animal_images tabulky
        dai = await db.execute(
            text("""
            SELECT species, breed_id IS NULL as no_breed, color_pattern,
                   is_active, public_url
            FROM default_animal_images
            LIMIT 20
        """)
        )
        dai_rows = dai.fetchall()
        print(f"\n=== default_animal_images ({len(dai_rows)} řádků, max 20) ===")
        if not dai_rows:
            print("  [!]  TABULKA JE PRAZDNA - zadne defaultni obrazky")
        for r in dai_rows:
            print(
                f"  species={r.species} no_breed={r.no_breed} color={r.color_pattern} active={r.is_active} url={r.public_url[:60]}"
            )

    await engine.dispose()


asyncio.run(main())
