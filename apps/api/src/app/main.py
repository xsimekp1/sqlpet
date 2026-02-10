from fastapi import FastAPI
from src.app.api.routes.health import router as health_router

app = FastAPI(title="SQLpet API")

app.include_router(health_router)
