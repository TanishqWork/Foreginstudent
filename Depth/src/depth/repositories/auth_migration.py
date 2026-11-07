"""Database access for the explicit, one-time Supabase Auth user migration."""
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import Engine, inspect, text


@dataclass(frozen=True, repr=False)
class LegacyAuthUser:
    id: UUID
    email: str
    password_hash: str | None
    supabase_user_id: UUID | None


class AuthMigrationRepository:
    def __init__(self, engine: Engine):
        self.engine = engine

    def pending_users(self) -> list[LegacyAuthUser]:
        columns = {column["name"] for column in inspect(self.engine).get_columns("users")}
        if "supabase_user_id" not in columns:
            raise RuntimeError("Apply Alembic revision 0004_supabase_auth first.")
        if "password_hash" not in columns:
            return []
        with self.engine.connect() as connection:
            rows = connection.execute(text(
                "SELECT id, email, password_hash, supabase_user_id FROM users "
                "WHERE supabase_user_id IS NULL OR password_hash IS NOT NULL "
                "ORDER BY created_at, id"
            )).mappings()
            return [LegacyAuthUser(**dict(row)) for row in rows]

    def finish_user(self, local_id: UUID, provider_id: UUID) -> None:
        with self.engine.begin() as connection:
            result = connection.execute(text(
                "UPDATE users SET supabase_user_id = :provider_id, password_hash = NULL "
                "WHERE id = :local_id AND "
                "(supabase_user_id IS NULL OR supabase_user_id = :provider_id)"
            ), {"provider_id": provider_id, "local_id": local_id})
            if result.rowcount != 1:
                raise RuntimeError("Account mapping changed; migration stopped without replacing it.")
