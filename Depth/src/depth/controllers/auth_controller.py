from datetime import datetime, timezone
from math import ceil

from fastapi import Request, Response
from fastapi.responses import RedirectResponse

from depth.core.config import (
    COOKIE_PATH, PKCE_COOKIE, RECOVERY_COOKIE, RECOVERY_TTL_SECONDS,
    REFRESH_COOKIE, SESSION_COOKIE, SESSION_PROOF_COOKIE, SIGNUP_PKCE_COOKIE,
)
from depth.core.exceptions import AuthenticationError, AuthProviderUnavailableError, RateLimitError
from depth.integrations.supabase_auth import ProviderTokens
from depth.models.auth_session import AuthSession
from depth.schemas.auth import (
    ConfirmationResponse, EmailRequest, LoginRequest, MessageResponse,
    RecoveryResponse, ResetPasswordRequest, SessionResponse, UserResponse,
)
from depth.services.auth_service import AuthService, PendingLogin

RECOVERY_MESSAGE = "If an account exists for this email, a password reset link will be sent."


def _set_cookie(response: Response, name: str, value: str, service: AuthService, max_age: int, *, path: str = COOKIE_PATH) -> None:
    response.set_cookie(
        name, value, max_age=max_age, httponly=True,
        secure=service.settings.cookie_secure, samesite="lax", path=path,
    )


def _clear_cookie(response: Response, name: str, service: AuthService, *, path: str = COOKIE_PATH) -> None:
    response.delete_cookie(
        name, path=path, httponly=True, secure=service.settings.cookie_secure, samesite="lax",
    )


def _set_tokens(response: Response, tokens: ProviderTokens, session: AuthSession, service: AuthService) -> None:
    remaining = max(0, ceil((session.expires_at - datetime.now(timezone.utc)).total_seconds()))
    _set_cookie(response, SESSION_COOKIE, tokens.access_token, service, remaining)
    _set_cookie(response, REFRESH_COOKIE, tokens.refresh_token, service, remaining)


def _clear_auth(response: Response, service: AuthService) -> None:
    for name in (SESSION_COOKIE, REFRESH_COOKIE, SESSION_PROOF_COOKIE, RECOVERY_COOKIE):
        _clear_cookie(response, name, service)
    _clear_cookie(response, PKCE_COOKIE, service, path="/api/auth/recovery/callback")
    _clear_cookie(response, SIGNUP_PKCE_COOKIE, service, path="/api/auth/confirmation/callback")


def login(body: LoginRequest, request: Request, response: Response, service: AuthService) -> SessionResponse | ConfirmationResponse:
    ip = request.client.host if request.client else "unknown"
    result = service.login(str(body.email), body.password.get_secret_value(), ip)
    if isinstance(result, PendingLogin):
        if result.verifier:
            _set_cookie(response, SIGNUP_PKCE_COOKIE, result.verifier, service, 3600, path="/api/auth/confirmation/callback")
        return ConfirmationResponse(email=str(body.email))
    _set_tokens(response, result.tokens, result.session, service)
    remaining = max(0, ceil((result.session.expires_at - datetime.now(timezone.utc)).total_seconds()))
    _set_cookie(response, SESSION_PROOF_COOKIE, result.proof, service, remaining)
    _clear_cookie(response, RECOVERY_COOKIE, service)
    return SessionResponse(user=UserResponse.model_validate(result.session.user), expires_at=result.session.expires_at)


def require_session(request: Request, response: Response, service: AuthService) -> AuthSession:
    result = service.current_session(
        request.cookies.get(SESSION_COOKIE), request.cookies.get(REFRESH_COOKIE),
        request.cookies.get(SESSION_PROOF_COOKIE),
    )
    if result.refreshed_tokens is not None:
        _set_tokens(response, result.refreshed_tokens, result.session, service)
    return result.session


def me(request: Request, response: Response, service: AuthService) -> SessionResponse:
    session = require_session(request, response, service)
    return SessionResponse(user=UserResponse.model_validate(session.user), expires_at=session.expires_at)


def logout(request: Request, response: Response, service: AuthService) -> None:
    service.logout(
        request.cookies.get(SESSION_COOKIE), request.cookies.get(SESSION_PROOF_COOKIE),
        request.cookies.get(RECOVERY_COOKIE),
    )
    _clear_auth(response, service)


def forgot_password(body: EmailRequest, request: Request, response: Response, service: AuthService) -> MessageResponse:
    ip = request.client.host if request.client else "unknown"
    verifier = service.start_recovery(str(body.email), ip)
    _set_cookie(response, PKCE_COOKIE, verifier, service, 3600, path="/api/auth/recovery/callback")
    return MessageResponse(message=RECOVERY_MESSAGE)


def recovery_callback(request: Request, service: AuthService) -> RedirectResponse:
    query = dict(request.query_params)
    # Uvicorn reads this scope for its access log after the response.
    request.scope["query_string"] = b""
    token = None
    try:
        if query.get("error") or (query.get("token_hash") and query.get("type") != "recovery"):
            raise AuthenticationError()
        token = service.finish_recovery(
            code=query.get("code"), verifier=request.cookies.get(PKCE_COOKIE),
            recovery_hash=query.get("token_hash"),
        )
    except (AuthenticationError, AuthProviderUnavailableError, RateLimitError):
        pass
    destination = service.settings.frontend_url + "/reset-password"
    if not token:
        destination += "?error=invalid_recovery"
    response = RedirectResponse(destination, status_code=303, headers={
        "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    })
    _clear_cookie(response, PKCE_COOKIE, service, path="/api/auth/recovery/callback")
    if token:
        _set_cookie(response, RECOVERY_COOKIE, token, service, RECOVERY_TTL_SECONDS)
    else:
        _clear_cookie(response, RECOVERY_COOKIE, service)
    return response


def recovery(request: Request, service: AuthService) -> RecoveryResponse:
    service.recovery_session(request.cookies.get(RECOVERY_COOKIE))
    return RecoveryResponse()


def reset_password(body: ResetPasswordRequest, request: Request, response: Response, service: AuthService) -> MessageResponse:
    service.reset_password(request.cookies.get(RECOVERY_COOKIE), body.password.get_secret_value())
    _clear_auth(response, service)
    return MessageResponse(message="Password updated. Sign in with your new password.")



def confirmation_callback(request: Request, service: AuthService) -> RedirectResponse:
    query = dict(request.query_params)
    request.scope["query_string"] = b""
    result = None
    try:
        if query.get("error"):
            raise AuthenticationError()
        result = service.finish_confirmation(query.get("code"), request.cookies.get(SIGNUP_PKCE_COOKIE))
    except (AuthenticationError, AuthProviderUnavailableError, RateLimitError):
        pass
    destination = service.settings.frontend_url + ("/dashboard" if result else "/account?confirmation=invalid")
    response = RedirectResponse(destination, status_code=303, headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
    _clear_cookie(response, SIGNUP_PKCE_COOKIE, service, path="/api/auth/confirmation/callback")
    if result:
        _clear_cookie(response, RECOVERY_COOKIE, service)
        _set_tokens(response, result.tokens, result.session, service)
        remaining = max(0, ceil((result.session.expires_at - datetime.now(timezone.utc)).total_seconds()))
        _set_cookie(response, SESSION_PROOF_COOKIE, result.proof, service, remaining)
    return response
