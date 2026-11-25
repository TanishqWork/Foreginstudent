"""Support time-limited account access to complete reports."""

import sqlalchemy as sa
from alembic import op

revision = "0011_cycle_access"
down_revision = "0010_provider_payment_uq"
branch_labels = None
depends_on = None

ENTITLEMENTS = "complete_report_entitlements"
ATTEMPTS = "complete_report_attempts"


def upgrade() -> None:
    op.add_column(ENTITLEMENTS, sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column(ENTITLEMENTS, "assessment_id", nullable=True)
    op.alter_column(ENTITLEMENTS, "max_successful_runs", nullable=True, server_default=None)
    op.drop_constraint("ck_complete_report_entitlements_max_runs_positive", ENTITLEMENTS, type_="check")
    op.create_check_constraint(
        "ck_complete_report_entitlements_scope", ENTITLEMENTS,
        "(assessment_id IS NOT NULL AND max_successful_runs IS NOT NULL AND max_successful_runs > 0 AND expires_at IS NULL) "
        "OR (assessment_id IS NULL AND max_successful_runs IS NULL AND expires_at IS NOT NULL)",
    )
    op.drop_index("uq_complete_report_attempts_generating_entitlement", table_name=ATTEMPTS)
    op.create_index(
        "uq_complete_report_attempts_generating_assessment", ATTEMPTS, ["assessment_id"],
        unique=True, postgresql_where=sa.text("status = 'generating'"),
    )


def downgrade() -> None:
    op.alter_column(ENTITLEMENTS, "assessment_id", nullable=False)
    op.alter_column(ENTITLEMENTS, "max_successful_runs", nullable=False, server_default="2")
    op.drop_constraint("ck_complete_report_entitlements_scope", ENTITLEMENTS, type_="check")
    op.create_check_constraint("ck_complete_report_entitlements_max_runs_positive", ENTITLEMENTS, "max_successful_runs > 0")
    op.drop_column(ENTITLEMENTS, "expires_at")
    op.drop_index("uq_complete_report_attempts_generating_assessment", table_name=ATTEMPTS)
    op.create_index(
        "uq_complete_report_attempts_generating_entitlement", ATTEMPTS, ["entitlement_id"],
        unique=True, postgresql_where=sa.text("status = 'generating'"),
    )
