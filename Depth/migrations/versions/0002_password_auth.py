"""Replace the unused email-link flow with password authentication.

Existing identities are preserved without a password and cannot be claimed by
entering their email. Previous sessions are revoked during the transition.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_password_auth"
down_revision = "0001_email_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(512), nullable=True))
    op.execute("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL")
    op.drop_table("magic_links")


def downgrade() -> None:
    op.create_table(
        "magic_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_magic_links_token_hash"),
    )
    op.create_index("ix_magic_links_expires_at", "magic_links", ["expires_at"])
    op.drop_column("users", "password_hash")
