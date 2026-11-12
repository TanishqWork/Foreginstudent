from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import RedirectResponse

from depth.controllers import auth_controller
from depth.dependencies import get_auth_service
from depth.schemas.auth import (
    ConfirmationResponse, EmailRequest, LoginRequest, MessageResponse,
    RecoveryResponse, ResetPasswordRequest, SessionResponse,
)
from depth.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["authentication"])
Auth = Annotated[AuthService, Depends(get_auth_service)]


@router.get("/google", response_class=RedirectResponse)
def google_login(request: Request, service: Auth) -> RedirectResponse:
    return auth_controller.google_login(request, service)


@router.get("/google/callback", response_class=RedirectResponse, include_in_schema=False)
def google_callback(request: Request, service: Auth) -> RedirectResponse:
    return auth_controller.google_callback(request, service)


@router.post("/login", response_model=SessionResponse | ConfirmationResponse)
def login(body: LoginRequest, request: Request, response: Response, service: Auth) -> SessionResponse | ConfirmationResponse:
    return auth_controller.login(body, request, response, service)


@router.get("/me", response_model=SessionResponse)
def me(request: Request, response: Response, service: Auth) -> SessionResponse:
    return auth_controller.me(request, response, service)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, service: Auth) -> None:
    auth_controller.logout(request, response, service)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(body: EmailRequest, request: Request, response: Response, service: Auth) -> MessageResponse:
    return auth_controller.forgot_password(body, request, response, service)


@router.get("/recovery/callback", response_class=RedirectResponse, include_in_schema=False)
def recovery_callback(request: Request, service: Auth) -> RedirectResponse:
    return auth_controller.recovery_callback(request, service)


@router.get("/recovery", response_model=RecoveryResponse)
def recovery(request: Request, service: Auth) -> RecoveryResponse:
    return auth_controller.recovery(request, service)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, request: Request, response: Response, service: Auth) -> MessageResponse:
    return auth_controller.reset_password(body, request, response, service)



@router.get("/confirmation/callback", response_class=RedirectResponse, include_in_schema=False)
def confirmation_callback(request: Request, service: Auth) -> RedirectResponse:
    return auth_controller.confirmation_callback(request, service)
