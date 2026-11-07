"""Remove local credentials only after all existing identities are migrated."""
from alembic import op
import sqlalchemy as sa

revision = "0005_retire_local_passwords"
down_revision = "0004_supabase_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM users
                WHERE password_hash IS NOT NULL OR supabase_user_id IS NULL
            ) THEN
                RAISE EXCEPTION 'Migrate existing accounts first: upgrade to 0004_supabase_auth, run python scripts/migrate_auth_users.py --apply, then upgrade head.';
            END IF;
        END;
        $$;
    """)
    op.drop_column("users", "password_hash")


def downgrade() -> None:
    # Old password hashes cannot be recovered from Supabase Auth through this migration.
    # Preserved accounts remain unclaimable by the retired local password flow.
    op.add_column("users", sa.Column("password_hash", sa.String(512), nullable=True))
