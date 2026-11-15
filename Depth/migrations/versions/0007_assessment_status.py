"""Track free-assessment generation in its row so POST /free can return before the AI finishes.

Existing rows already hold a result and become `ready`. A row is created as
`generating` with no result, then becomes `ready` (result required) or `failed`.
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_assessment_status"
down_revision = "0006_assessments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assessments", sa.Column("status", sa.String(20), nullable=False, server_default="ready"))
    op.alter_column("assessments", "status", server_default=None)
    op.add_column("assessments", sa.Column("error", sa.String(300), nullable=True))
    op.alter_column("assessments", "result", nullable=True)
    op.create_check_constraint(
        "ck_assessments_status", "assessments", "status IN ('generating', 'ready', 'failed')",
    )
    op.create_check_constraint(
        "ck_assessments_ready_has_result", "assessments", "status <> 'ready' OR result IS NOT NULL",
    )


def downgrade() -> None:
    connection = op.get_bind()
    unfinished = connection.execute(sa.text("SELECT count(*) FROM assessments WHERE result IS NULL")).scalar_one()
    if unfinished:
        # Never discard student records to satisfy a downgrade.
        raise RuntimeError(f"{unfinished} assessments have no result; resolve them before downgrading.")
    op.drop_constraint("ck_assessments_ready_has_result", "assessments", type_="check")
    op.drop_constraint("ck_assessments_status", "assessments", type_="check")
    op.alter_column("assessments", "result", nullable=False)
    op.drop_column("assessments", "error")
    op.drop_column("assessments", "status")
