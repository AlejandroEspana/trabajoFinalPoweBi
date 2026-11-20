from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "API Rendimiento Académico & ANOVA"
    app_version: str = "1.0.0"

    pghost: str = "127.0.0.1"
    pgport: int = 5432
    pgdatabase: str = "momento3_powerbi"
    pguser: str = "postgres"
    pgpassword: str = "123456"

    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
