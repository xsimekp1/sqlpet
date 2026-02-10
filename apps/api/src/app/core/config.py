from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "SQLpet API"
    ENV: str = "dev"

    DATABASE_URL_ASYNC: str
    DATABASE_URL_SYNC: str

    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ISSUER: str = "sqlpet"
    JWT_ACCESS_TTL_MIN: int = 15
    JWT_REFRESH_TTL_DAYS: int = 30


settings = Settings()
