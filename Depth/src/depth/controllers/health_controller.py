from depth.schemas.health import HealthResponse, ReadinessResponse
from depth.services.health_service import HealthService


def liveness() -> HealthResponse:
    return HealthResponse(**HealthService.liveness())


def readiness(service: HealthService) -> ReadinessResponse:
    return ReadinessResponse(**service.readiness())
