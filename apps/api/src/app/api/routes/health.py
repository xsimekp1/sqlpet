from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from src.app.db.session import SessionLocal


router = APIRouter(prefix="/health", tags=["health"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/db")
def health_db(db: Session = Depends(get_db)):
    db.execute(text("select 1"))
    return {"status": "ok"}
