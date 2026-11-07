"""Import preserved accounts into Supabase Auth; default is a read-only preflight.

Run from Depth after upgrading to 0004_supabase_auth. No emails are sent. Secrets,
email addresses and password hashes are never printed. Successful imports clear
the corresponding local hash; account UUIDs and application records are retained.
"""
import argparse
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from dotenv import dotenv_values
from sqlalchemy import create_engine

from depth.repositories.auth_migration import AuthMigrationRepository, LegacyAuthUser


BACKEND_ROOT = Path(__file__).resolve().parents[1]
MIGRATION_MARKER = "statement-studio-supabase-auth-v1"


def load_configuration() -> tuple[str, str, str]:
    local = dotenv_values(BACKEND_ROOT / ".env")

    def value(name: str) -> str:
        result = os.environ.get(name) or local.get(name)
        if not result:
            raise RuntimeError(f"Set {name} in the ignored Depth/.env or process environment.")
        return result

    database_url = value("DATABASE_URL")
    for prefix in ("postgresql://", "postgres://"):
        if database_url.startswith(prefix):
            database_url = "postgresql+psycopg://" + database_url[len(prefix):]
            break
    project_url = value("SUPABASE_URL").rstrip("/")
    parsed = urlsplit(project_url)
    if (
        parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
        or parsed.path or parsed.query or parsed.fragment
    ):
        raise RuntimeError("SUPABASE_URL must be an HTTPS origin without credentials or a path.")
    return database_url, project_url, value("SUPABASE_SECRET_KEY")


def admin_request(client: httpx.Client, method: str, path: str, **kwargs) -> dict:
    response = client.request(method, path, **kwargs)
    if not response.is_success:
        raise RuntimeError(f"Supabase Auth admin request failed (HTTP {response.status_code}).")
    body = response.json()
    if not isinstance(body, dict):
        raise RuntimeError("Supabase Auth returned an unexpected admin response.")
    return body


def list_provider_users(client: httpx.Client) -> dict[str, dict]:
    by_email: dict[str, dict] = {}
    page = 1
    while True:
        body = admin_request(client, "GET", "/admin/users", params={"page": page, "per_page": 1000})
        users = body.get("users", [])
        for user in users:
            email = user.get("email")
            if email:
                normalized = email.strip().lower()
                if normalized in by_email:
                    raise RuntimeError("Duplicate Supabase email identities need manual resolution.")
                by_email[normalized] = user
        if len(users) < 1000:
            return by_email
        page += 1


def existing_mapping(user: LegacyAuthUser, provider: dict | None) -> UUID | None:
    if provider is None:
        if user.supabase_user_id is not None:
            raise RuntimeError("A mapped provider identity is missing; manual recovery is required.")
        return None
    provider_id = UUID(provider["id"])
    marker = provider.get("app_metadata", {})
    same_import = (
        marker.get("auth_migration") == MIGRATION_MARKER
        and marker.get("app_user_id") == str(user.id)
    )
    if user.supabase_user_id == provider_id or same_import:
        return provider_id
    raise RuntimeError(
        "An existing Supabase account conflicts with an application account. "
        "No account was linked by email; resolve the conflict explicitly."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Perform imports after the complete preflight passes")
    args = parser.parse_args()
    database_url, project_url, secret = load_configuration()
    engine = create_engine(database_url, connect_args={"connect_timeout": 10}, pool_pre_ping=True)
    try:
        repository = AuthMigrationRepository(engine)
        users = repository.pending_users()
        if not users:
            print("No application accounts need migration.")
            return
        headers = {"apikey": secret, "Authorization": f"Bearer {secret}"}
        with httpx.Client(base_url=project_url + "/auth/v1", headers=headers, timeout=30) as client:
            provider_users = list_provider_users(client)
            # Validate every account before creating or changing any identity.
            for user in users:
                existing_mapping(user, provider_users.get(user.email.strip().lower()))
                if user.password_hash and not user.password_hash.startswith(("$argon2id$", "$2a$", "$2b$", "$2y$")):
                    raise RuntimeError("An existing password hash requires a supported migration strategy.")
            print(f"Preflight passed for {len(users)} application account(s).")
            if not args.apply:
                print("Read-only check complete. Add --apply to migrate these accounts.")
                return
            completed = 0
            for user in users:
                normalized = user.email.strip().lower()
                provider_id = existing_mapping(user, provider_users.get(normalized))
                if provider_id is None:
                    payload = {
                        "email": normalized,
                        "email_confirm": False,
                        "app_metadata": {"auth_migration": MIGRATION_MARKER, "app_user_id": str(user.id)},
                    }
                    if user.id.version == 4:
                        payload["id"] = str(user.id)
                    if user.password_hash:
                        payload["password_hash"] = user.password_hash
                    body = admin_request(client, "POST", "/admin/users", json=payload)
                    provider = body.get("user", body)
                    if provider.get("email", "").strip().lower() != normalized:
                        raise RuntimeError("Imported identity did not match the expected account.")
                    provider_id = UUID(provider["id"])
                    provider_users[normalized] = provider
                repository.finish_user(user.id, provider_id)
                completed += 1
            print(f"Migrated {completed} application account(s); local hashes cleared.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Never include exception text from database/provider clients: it can
        # contain connection details or caller-supplied credentials.
        if isinstance(exc, RuntimeError):
            print(str(exc))
        else:
            print(f"Migration stopped ({type(exc).__name__}); no credentials were logged.")
        raise SystemExit(1) from None
