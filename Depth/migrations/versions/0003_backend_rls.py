"""Keep application authentication tables private on hosted PostgreSQL.

No browser-facing policies are created. FastAPI connects as the table owner,
which retains access while ordinary browser roles receive no row access.
"""
from alembic import op

revision = "0003_backend_rls"
down_revision = "0002_password_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE public.users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.execute("ALTER TABLE public.auth_rate_limits DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.auth_sessions DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.users DISABLE ROW LEVEL SECURITY")
