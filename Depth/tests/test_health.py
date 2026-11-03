from sqlalchemy.exc import OperationalError

from depth.database.session import get_db

from conftest import AuthTestContext


def test_health_and_database_readiness(auth_context: AuthTestContext) -> None:
    assert auth_context.client.get("/api/health").status_code == 200
    assert auth_context.client.get("/api/health/ready").status_code == 200


def test_readiness_reports_database_outage_without_breaking_liveness(auth_context: AuthTestContext) -> None:
    class UnavailableDatabase:
        def execute(self, *args: object) -> None:
            raise OperationalError("SELECT 1", {}, RuntimeError("database offline"))

    def unavailable_database():
        yield UnavailableDatabase()

    auth_context.app.dependency_overrides[get_db] = unavailable_database
    response = auth_context.client.get("/api/health/ready")
    assert response.status_code == 503
    assert "database offline" not in response.text
    assert auth_context.client.get("/api/health").status_code == 200
