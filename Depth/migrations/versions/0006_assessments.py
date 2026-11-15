"""Save free AI assessments per user.

Row-level security is enabled with no policies, matching 0003_backend_rls:
FastAPI connects as the table owner, browser roles get no row access.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006_assessments"
down_revision = "0005_retire_local_passwords"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assessments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("input", postgresql.JSONB(), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("generation_seconds", sa.Numeric(8, 3), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_assessments_user_id_created_at", "assessments", ["user_id", sa.text("created_at DESC")],
    )
    op.execute("ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("ix_assessments_user_id_created_at", table_name="assessments")
    op.drop_table("assessments")
