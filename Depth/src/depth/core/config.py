from functools import lru_cache
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

JWT_TTL_SECONDS = 86_400
SESSION_COOKIE = "depth_session"
COOKIE_PATH = "/api"
JWT_ISSUER = "statement-studio-depth"
JWT_AUDIENCE = "statement-studio-surface"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str
    jwt_secret: str = Field(min_length=32)
    frontend_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"
    cookie_secure: bool = False
    openai_api_key: SecretStr | None = Field(default=None, repr=False)

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
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must use postgresql+psycopg://")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
