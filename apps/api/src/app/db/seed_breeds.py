import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.breed import Breed
from src.app.models.animal import Species

BREED_DATA: dict[Species, list[str]] = {
    Species.DOG: [
        "Mixed / Unknown",
        "Labrador Retriever",
        "German Shepherd",
        "Golden Retriever",
        "Beagle",
        "Bulldog",
        "Poodle",
        "Rottweiler",
        "Dachshund",
        "Boxer",
        "Siberian Husky",
        "Doberman Pinscher",
        "Chihuahua",
        "Border Collie",
        "Cocker Spaniel",
        "Jack Russell Terrier",
        "Czech Terrier",
        "Czechoslovakian Wolfdog",
        "Pražský Krysařík",
        "Yorkshire Terrier",
    ],
    Species.CAT: [
        "Mixed / Unknown",
        "European Shorthair",
        "Persian",
        "Maine Coon",
        "Siamese",
        "British Shorthair",
        "Ragdoll",
        "Bengal",
        "Sphynx",
        "Russian Blue",
        "Norwegian Forest Cat",
        "Abyssinian",
        "Scottish Fold",
        "Birman",
        "Devon Rex",
    ],
    Species.RABBIT: [
        "Mixed / Unknown",
        "Holland Lop",
        "Mini Rex",
        "Netherland Dwarf",
        "Lionhead",
        "Flemish Giant",
        "English Lop",
        "Czech Red",
    ],
    Species.BIRD: [
        "Mixed / Unknown",
        "Budgerigar",
        "Cockatiel",
        "Canary",
        "Lovebird",
        "African Grey Parrot",
    ],
    Species.OTHER: [
        "Mixed / Unknown",
    ],
}


async def seed_breeds(db: AsyncSession) -> int:
    count = 0
    for species, breed_names in BREED_DATA.items():
        for name in breed_names:
            result = await db.execute(
                select(Breed).where(Breed.species == species, Breed.name == name)
            )
            if result.scalar_one_or_none() is None:
                db.add(Breed(id=uuid.uuid4(), species=species, name=name))
                count += 1
    await db.flush()
    return count
