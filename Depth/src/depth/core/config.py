from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

JWT_TTL_SECONDS = 86_400
SESSION_COOKIE = "depth_session"
SESSION_PROOF_COOKIE = "depth_session_proof"
REFRESH_COOKIE = "depth_refresh"
RECOVERY_COOKIE = "depth_recovery"
PKCE_COOKIE = "depth_recovery_verifier"
SIGNUP_PKCE_COOKIE = "depth_signup_verifier"
RECOVERY_TTL_SECONDS = 900
COOKIE_PATH = "/api"
BACKEND_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env", env_file_encoding="utf-8", extra="ignore",
        hide_input_in_errors=True,
    )

    database_url: str
    supabase_url: str
    supabase_publishable_key: SecretStr = Field(repr=False)
    supabase_secret_key: SecretStr | None = Field(default=None, repr=False)
    frontend_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"
    cookie_secure: bool = False
    openai_api_key: SecretStr | None = Field(default=None, repr=False)
    free_assessment_max_output_tokens: int = Field(default=16384, gt=0)

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username
                or parsed.password or parsed.query or parsed.fragment
                or parsed.path not in ("", "/")):
            raise ValueError("SUPABASE_URL must be an HTTPS origin")
        return value.rstrip("/")

    @field_validator("frontend_url", "api_url")
    @classmethod
    def validate_origin(cls, value: str) -> str:
        parsed = urlsplit(value)
        if (
            parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ("", "/")
        ):
            raise ValueError("URL must be an http(s) origin without a path")
        return value.rstrip("/")

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        value = value.strip()
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                value = "postgresql+psycopg://" + value[len(prefix):]
                break
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection URL")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
