from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.app.api.routes.health import router as health_router
from src.app.api.routes.auth import router as auth_router
from src.app.api.routes.animals import router as animals_router, breed_router
from src.app.api.routes.kennels import router as kennels_router
from src.app.api.routes.stays import router as stays_router
from src.app.db.session import async_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await async_engine.dispose()


app = FastAPI(title="SQLpet API", lifespan=lifespan)

# CORS configuration
# For production, explicitly list allowed origins for security
ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Local dev
    "http://localhost:5173",  # Vite dev
    "https://web-theta-peach-77.vercel.app",  # Vercel production
    "https://*.vercel.app",  # Vercel preview deployments
]

# In development/testing, allow all origins
# TODO: Remove wildcard in production and use only ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to ALLOWED_ORIGINS for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(animals_router)
app.include_router(breed_router)
app.include_router(kennels_router)
app.include_router(stays_router)
