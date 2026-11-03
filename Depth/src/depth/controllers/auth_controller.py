from fastapi import Request, Response

from depth.core.config import COOKIE_PATH, JWT_TTL_SECONDS, SESSION_COOKIE
from depth.schemas.auth import LoginRequest, SessionResponse, UserResponse
from depth.services.auth_service import AuthService


def login(body: LoginRequest, request: Request, response: Response, service: AuthService) -> SessionResponse:
    ip = request.client.host if request.client else "unknown"
    result = service.login(str(body.email), body.password.get_secret_value(), ip)
    response.set_cookie(
        SESSION_COOKIE, result.token, max_age=JWT_TTL_SECONDS, expires=result.expires_at,
        httponly=True, secure=service.settings.cookie_secure, samesite="lax", path=COOKIE_PATH,
    )
    return SessionResponse(user=UserResponse.model_validate(result.user), expires_at=result.expires_at)


def me(request: Request, service: AuthService) -> SessionResponse:
    session = service.current_session(request.cookies.get(SESSION_COOKIE))
    return SessionResponse(user=UserResponse.model_validate(session.user), expires_at=session.expires_at)


def logout(request: Request, response: Response, service: AuthService) -> None:
    service.logout(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(
        SESSION_COOKIE, path=COOKIE_PATH, httponly=True,
        secure=service.settings.cookie_secure, samesite="lax",
    )
