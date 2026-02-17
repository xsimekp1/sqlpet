from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "SQLpet API"
    ENV: str = "dev"

    DATABASE_URL_ASYNC: str = "postgresql+asyncpg://pet:pet@localhost:5432/petdb"
    DATABASE_URL_SYNC: str = "postgresql://pet:pet@localhost:5432/petdb"

    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ISSUER: str = "sqlpet"
    JWT_ACCESS_TTL_MIN: int = 120  # 2 hours - enough for a work session
    JWT_REFRESH_TTL_DAYS: int = 30

    # Supabase Configuration
    SUPABASE_URL: str = "https://placeholder.supabase.co"
    SUPABASE_KEY: str = "placeholder-key"
    SUPABASE_SERVICE_KEY: str = "placeholder-service-key"

    # File Upload Settings
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_FILE_TYPES: List[str] = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    # Performance Monitoring Settings
    PERF_ENABLED: bool = False
    PERF_SLOW_THRESHOLD_MS: int = 200
    PERF_VERY_SLOW_THRESHOLD_MS: int = 800
    PERF_LOG_SQL: bool = False
    PERF_LOG_TOP_N: int = 5
    PERF_COLORED_LOGS: bool = True

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


settings = Settings()
