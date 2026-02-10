from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL_SYNC: str

    class Config:
        env_file = ".env"


settings = Settings()
