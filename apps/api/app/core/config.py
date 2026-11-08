from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")

    database_url: str = "sqlite:///./devoholics.db"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    github_token: str = ""
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000"

    @field_validator("database_url", mode="before")
    @classmethod
    def _empty_db_url(cls, v):
        return v or "sqlite:///./devoholics.db"


settings = Settings()
