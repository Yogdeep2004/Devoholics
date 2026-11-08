from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")

    database_url: str = "sqlite:///./devoholics.db"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    github_token: str = ""
    log_level: str = "INFO"
    # Any OpenAI-compatible endpoint works (Groq, Gemini compat, OpenRouter, Cerebras, Ollama).
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-oss-120b"
    ai_requests_per_minute: int = 10
    cors_origins: str = "http://localhost:3000"

    @field_validator("llm_base_url", "llm_model", mode="before")
    @classmethod
    def _keep_default_if_empty(cls, v, info):
        return v or cls.model_fields[info.field_name].default

    @field_validator("database_url", mode="before")
    @classmethod
    def _empty_db_url(cls, v):
        return v or "sqlite:///./devoholics.db"


settings = Settings()
