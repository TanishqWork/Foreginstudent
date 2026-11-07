from pathlib import Path

import pytest
from pydantic import ValidationError

from depth.core.config import BACKEND_ROOT, Settings


def settings_for(database_url: str) -> Settings:
    return Settings(
        database_url=database_url,
        jwt_secret="test-only-signing-key-with-at-least-32-characters",
        _env_file=None,
    )


@pytest.mark.parametrize("scheme", ["postgresql", "postgres", "postgresql+psycopg"])
def test_supabase_connection_url_uses_psycopg_and_preserves_ssl(scheme: str) -> None:
    connection = (
        f"{scheme}://postgres.project:encoded%40password@pooler.example.com:5432/"
        "postgres?sslmode=verify-full&sslrootcert=C%3A%2Fcerts%2Froot.crt"
    )
    settings = settings_for(connection)
    assert settings.database_url == "postgresql+psycopg://" + connection.split("://", 1)[1]


def test_invalid_database_url_does_not_echo_credentials() -> None:
    with pytest.raises(ValidationError) as caught:
        settings_for("mysql://postgres:private-password@example.com/postgres")
    assert "PostgreSQL connection URL" in str(caught.value)
    assert "private-password" not in str(caught.value)


def test_environment_file_is_anchored_to_backend_directory(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    assert Path(Settings.model_config["env_file"]) == BACKEND_ROOT / ".env"
    assert (BACKEND_ROOT / "pyproject.toml").is_file()
