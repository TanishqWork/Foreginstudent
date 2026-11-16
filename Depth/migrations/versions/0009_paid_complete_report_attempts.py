"""Replace single complete report rows with purchases, entitlements, and attempts."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_paid_complete_report_attempts"
down_revision = "0008_complete_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_complete_reports_user_id", table_name="complete_reports")
    op.drop_table("complete_reports")

    op.create_table(
        "purchases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("product_type", sa.String(50), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("provider_payment_id", sa.String(200), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('pending', 'paid', 'failed', 'refunded')", name="ck_purchases_status"),
        sa.CheckConstraint("amount_cents >= 0", name="ck_purchases_amount_nonnegative"),
        sa.CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="ck_purchases_currency"),
    )
    op.create_index("ix_purchases_user_id_created_at", "purchases", ["user_id", "created_at"], postgresql_ops={"created_at": "DESC"})
    op.execute("ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY")

    op.create_table(
        "complete_report_entitlements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("purchase_id", sa.Uuid(), sa.ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assessment_id", sa.Uuid(), sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("max_successful_runs", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("max_successful_runs > 0", name="ck_complete_report_entitlements_max_runs_positive"),
        sa.UniqueConstraint("assessment_id", "user_id", name="uq_complete_report_entitlements_assessment_user"),
        sa.UniqueConstraint("purchase_id", name="uq_complete_report_entitlements_purchase"),
    )
    op.create_index("ix_complete_report_entitlements_user_id", "complete_report_entitlements", ["user_id"])
    op.execute("ALTER TABLE public.complete_report_entitlements ENABLE ROW LEVEL SECURITY")

    op.create_table(
        "complete_report_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entitlement_id", sa.Uuid(), sa.ForeignKey("complete_report_entitlements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assessment_id", sa.Uuid(), sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("report", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.Column("error", sa.String(300), nullable=True),
        sa.Column("failure_kind", sa.String(50), nullable=True),
        sa.Column("counts_against_limit", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("generation_seconds", sa.Numeric(8, 3), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('generating', 'ready', 'failed')", name="ck_complete_report_attempts_status"),
        sa.CheckConstraint("status <> 'ready' OR report IS NOT NULL", name="ck_complete_report_attempts_ready_has_report"),
        sa.CheckConstraint("status <> 'failed' OR error IS NOT NULL", name="ck_complete_report_attempts_failed_has_error"),
        sa.CheckConstraint("counts_against_limit = false OR status = 'ready'", name="ck_complete_report_attempts_counted_ready"),
    )
    op.create_index(
        "ix_complete_report_attempts_entitlement_created_at",
        "complete_report_attempts",
        ["entitlement_id", "created_at"],
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        "ix_complete_report_attempts_assessment_created_at",
        "complete_report_attempts",
        ["assessment_id", "created_at"],
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        "ix_complete_report_attempts_user_created_at",
        "complete_report_attempts",
        ["user_id", "created_at"],
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        "uq_complete_report_attempts_generating_entitlement",
        "complete_report_attempts",
        ["entitlement_id"],
        unique=True,
        postgresql_where=sa.text("status = 'generating'"),
    )
    op.execute("ALTER TABLE public.complete_report_attempts ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("uq_complete_report_attempts_generating_entitlement", table_name="complete_report_attempts")
    op.drop_index("ix_complete_report_attempts_user_created_at", table_name="complete_report_attempts")
    op.drop_index("ix_complete_report_attempts_assessment_created_at", table_name="complete_report_attempts")
    op.drop_index("ix_complete_report_attempts_entitlement_created_at", table_name="complete_report_attempts")
    op.drop_table("complete_report_attempts")
    op.drop_index("ix_complete_report_entitlements_user_id", table_name="complete_report_entitlements")
    op.drop_table("complete_report_entitlements")
    op.drop_index("ix_purchases_user_id_created_at", table_name="purchases")
    op.drop_table("purchases")

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
