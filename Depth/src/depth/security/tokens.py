from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import jwt

from depth.core.config import JWT_AUDIENCE, JWT_ISSUER
from depth.core.exceptions import AuthenticationError


@dataclass(frozen=True)
class SessionIdentity:
    user_id: UUID
    session_id: UUID


def sign_session_token(
    user_id: UUID, session_id: UUID, issued_at: datetime, expires_at: datetime, secret: str,
) -> str:
    return jwt.encode(
        {"sub": str(user_id), "jti": str(session_id), "iat": issued_at, "exp": expires_at,
         "iss": JWT_ISSUER, "aud": JWT_AUDIENCE},
        secret, algorithm="HS256",
    )


def validate_session_token(token: str | None, secret: str) -> SessionIdentity:
    if not token:
        raise AuthenticationError()
    try:
        claims = jwt.decode(
            token, secret, algorithms=["HS256"], issuer=JWT_ISSUER, audience=JWT_AUDIENCE,
            options={"require": ["sub", "jti", "iat", "exp", "iss", "aud"]},
        )
        return SessionIdentity(user_id=UUID(claims["sub"]), session_id=UUID(claims["jti"]))
    except (jwt.PyJWTError, TypeError, ValueError, KeyError):
        raise AuthenticationError() from None
