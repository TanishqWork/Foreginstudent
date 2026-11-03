from typing import Annotated

from fastapi import APIRouter, Depends

from depth.controllers import health_controller
from depth.dependencies import get_health_service
from depth.schemas.health import HealthResponse, ReadinessResponse
from depth.services.health_service import HealthService

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("", response_model=HealthResponse)
def health() -> HealthResponse:
    return health_controller.liveness()


@router.get("/ready", response_model=ReadinessResponse)
def readiness(service: Annotated[HealthService, Depends(get_health_service)]) -> ReadinessResponse:
    return health_controller.readiness(service)
