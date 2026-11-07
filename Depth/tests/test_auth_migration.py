import importlib.util
from pathlib import Path
from uuid import uuid1, uuid4

import httpx
import pytest

from depth.repositories.auth_migration import LegacyAuthUser


spec = importlib.util.spec_from_file_location(
    "migrate_auth_users", Path(__file__).resolve().parents[1] / "scripts" / "migrate_auth_users.py",
)
assert spec and spec.loader
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


def test_existing_email_is_not_sufficient_to_claim_a_legacy_account() -> None:
    user = LegacyAuthUser(uuid4(), "student@example.test", "$argon2id$example", None)
    unrelated = {"id": str(uuid4()), "email": user.email}
    with pytest.raises(RuntimeError, match="conflicts"):
        migration.existing_mapping(user, unrelated)


def test_client_editable_metadata_cannot_authorize_a_migration_mapping() -> None:
    user = LegacyAuthUser(uuid4(), "student@example.test", "$argon2id$example", None)
    unrelated = {
        "id": str(user.id), "email": user.email,
        "user_metadata": {"auth_migration": migration.MIGRATION_MARKER, "app_user_id": str(user.id)},
    }
    with pytest.raises(RuntimeError, match="conflicts"):
        migration.existing_mapping(user, unrelated)


def test_provider_created_identity_can_resume_after_local_commit_failure() -> None:
    user = LegacyAuthUser(uuid1(), "student@example.test", "$argon2id$example", None)
    provider_id = uuid4()
    provider = {
        "id": str(provider_id), "email": user.email,
        "app_metadata": {"auth_migration": migration.MIGRATION_MARKER, "app_user_id": str(user.id)},
    }
    assert migration.existing_mapping(user, provider) == provider_id


@pytest.mark.parametrize("unsafe_url", [
    "http://project.example.test", "https://project.example.test/auth/v1",
    "https://user:secret@project.example.test", "https://project.example.test?key=secret",
])
def test_admin_migration_refuses_unsafe_provider_destinations(monkeypatch, unsafe_url: str) -> None:
    monkeypatch.setattr(migration, "dotenv_values", lambda _: {})
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://test:test@localhost/isolated_test")
    monkeypatch.setenv("SUPABASE_URL", unsafe_url)
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "test-only-admin-key")
    with pytest.raises(RuntimeError, match="HTTPS origin"):
        migration.load_configuration()


def test_admin_errors_do_not_echo_provider_credentials_or_response_body() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(
        401, json={"message": "private-provider-value"},
    ))
    with httpx.Client(base_url="https://project.example.test/auth/v1", transport=transport) as client:
        with pytest.raises(RuntimeError) as caught:
            migration.admin_request(client, "POST", "/admin/users", json={"password_hash": "private-hash"})
    message = str(caught.value)
    assert "401" in message
    assert "private-provider-value" not in message
    assert "private-hash" not in message
