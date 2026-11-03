from fastapi import APIRouter

from depth.routes.auth import router as auth_router
from depth.routes.health import router as health_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_router)
