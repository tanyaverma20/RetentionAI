"""
config.py
=========
Centralized, validated environment configuration for the AI Service —
Sprint 10, Part 2 (Production Environment).

This does NOT replace the existing `os.getenv(...)` call sites scattered
across the prediction/RAG/NLP/agent modules — those already have sensible
defaults and rewiring 15+ files to read from a settings object instead would
be exactly the kind of unrelated churn Sprint 10 explicitly rules out.
Instead, this module is a single, authoritative validation gate: it re-reads
the same environment variables through a pydantic schema and is invoked once
at startup (`validate_startup_config()` in `main.py`'s lifespan, before
anything else runs) so a genuinely broken configuration fails immediately
with a clear message instead of the service limping up with pieces silently
missing.
"""

from typing import Literal
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PLACEHOLDER_TOKENS = {
    "replace-with-a-service-token",
    "replace-with-a-groq-api-key",
    "",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = Field(
        default="development", alias="AI_SERVICE_ENV"
    )
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_db_name: str = Field(default="retentionai", alias="MONGODB_DB_NAME")
    ai_service_host: str = Field(default="0.0.0.0", alias="AI_SERVICE_HOST")
    ai_service_port: int = Field(default=8000, alias="AI_SERVICE_PORT")
    ai_service_token: str = Field(default="", alias="AI_SERVICE_TOKEN")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    log_level: str = Field(default="info", alias="LOG_LEVEL")

    @field_validator("ai_service_token")
    @classmethod
    def _token_present(cls, value: str) -> str:
        # A missing/placeholder service token is fatal in every environment —
        # every request from Node is rejected without it, so there is no
        # degraded-but-working mode to fall back to.
        if value in PLACEHOLDER_TOKENS:
            raise ValueError(
                "AI_SERVICE_TOKEN is missing or still the placeholder value. "
                "Set a real shared secret matching the Node server's AI_SERVICE_TOKEN."
            )
        return value


def validate_startup_config() -> Settings:
    """Raises a clear, actionable error and prevents startup on fatal misconfiguration."""
    settings = Settings()

    if settings.environment == "production" and not settings.groq_api_key:
        # reasoning_chain.py raises ValueError the first time the Decision
        # Engine actually needs the LLM (it's lazily instantiated, not
        # touched at startup) — surfacing it here instead means a missing
        # key is caught at boot, not on the first real user's request.
        raise RuntimeError(
            "GROQ_API_KEY is not set. The Decision Engine's LLM reasoning step "
            "(app/agent/chains/reasoning_chain.py) will fail on first use without it. "
            "Required in production; only development is permitted to boot without it."
        )

    return settings
