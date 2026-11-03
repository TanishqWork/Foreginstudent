from depth.repositories.health import HealthRepository


class HealthService:
    def __init__(self, repository: HealthRepository):
        self.repository = repository

    @staticmethod
    def liveness() -> dict[str, str]:
        return {"status": "ok", "service": "depth"}

    def readiness(self) -> dict[str, str]:
        self.repository.check_connection()
        return {"status": "ok", "database": "connected"}
