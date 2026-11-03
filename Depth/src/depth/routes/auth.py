from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from depth.controllers import auth_controller
from depth.dependencies import get_auth_service
from depth.schemas.auth import LoginRequest, SessionResponse
from depth.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["authentication"])
Auth = Annotated[AuthService, Depends(get_auth_service)]


@router.post("/login", response_model=SessionResponse)
def login(body: LoginRequest, request: Request, response: Response, service: Auth) -> SessionResponse:
    return auth_controller.login(body, request, response, service)


@router.get("/me", response_model=SessionResponse)
def me(request: Request, service: Auth) -> SessionResponse:
    return auth_controller.me(request, service)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, service: Auth) -> None:
    auth_controller.logout(request, response, service)
