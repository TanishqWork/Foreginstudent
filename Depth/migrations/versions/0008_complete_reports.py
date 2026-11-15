"""Store complete reports and their generation status, replacing the in-memory cache.

One row per unlocked assessment; no row means the report is locked. Clients poll
the row's status: unlocked -> generating -> ready | failed (retryable).
Row-level security is enabled with no policies, matching the other application tables.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_complete_reports"
down_revision = "0007_assessment_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "complete_reports",
        sa.Column("assessment_id", sa.Uuid(), sa.ForeignKey("assessments.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("report", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.Column("error", sa.String(300), nullable=True),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("generation_seconds", sa.Numeric(8, 3), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('unlocked', 'generating', 'ready', 'failed')", name="ck_complete_reports_status"),
        sa.CheckConstraint("status <> 'ready' OR report IS NOT NULL", name="ck_complete_reports_ready_has_report"),
        sa.CheckConstraint("status <> 'generating' OR started_at IS NOT NULL", name="ck_complete_reports_generating_started"),
    )
    op.create_index("ix_complete_reports_user_id", "complete_reports", ["user_id"])
    op.execute("ALTER TABLE public.complete_reports ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("ix_complete_reports_user_id", table_name="complete_reports")
    op.drop_table("complete_reports")
