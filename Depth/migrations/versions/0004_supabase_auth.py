"""Map application identities to Supabase Auth and retire legacy sessions."""
from alembic import op
import sqlalchemy as sa

revision = "0004_supabase_auth"
down_revision = "0003_backend_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("supabase_user_id", sa.Uuid(), nullable=True))
    op.create_unique_constraint("uq_users_supabase_user_id", "users", ["supabase_user_id"])
    op.add_column("auth_sessions", sa.Column("token_hash", sa.String(64), nullable=True))
    op.create_index("ix_auth_sessions_token_hash", "auth_sessions", ["token_hash"])
    op.execute("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL")


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_token_hash", table_name="auth_sessions")
    op.drop_column("auth_sessions", "token_hash")
    op.drop_constraint("uq_users_supabase_user_id", "users", type_="unique")
    op.drop_column("users", "supabase_user_id")
