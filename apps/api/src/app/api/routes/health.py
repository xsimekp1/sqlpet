from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from src.app.api.dependencies.db import get_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}
