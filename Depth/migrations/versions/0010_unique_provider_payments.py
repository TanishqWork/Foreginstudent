"""Require provider payment ids to be unique when present."""
from alembic import op
import sqlalchemy as sa

revision = "0010_unique_provider_payments"
down_revision = "0009_paid_complete_report_attempts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_purchases_provider_payment_id",
        "purchases",
        ["provider", "provider_payment_id"],
        unique=True,
        postgresql_where=sa.text("provider_payment_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_purchases_provider_payment_id", table_name="purchases")
