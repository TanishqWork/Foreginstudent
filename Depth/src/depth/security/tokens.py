"""Read claims only after Supabase has authenticated the exact access token.

This module never signs JWTs and never trusts decoded claims on their own.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from uuid import UUID

import jwt

from depth.core.exceptions import AuthenticationError


@dataclass(frozen=True)
class SessionIdentity:
    user_id: UUID
    session_id: UUID
    issued_at: datetime
    expires_at: datetime
    recovery: bool


def token_hash(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def claims_after_provider_validation(token: str, user_id: UUID, issuer: str) -> SessionIdentity:
    try:
        claims = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
        audience = claims.get("aud")
        if audience != "authenticated" and not (
            isinstance(audience, list) and "authenticated" in audience
        ):
            raise ValueError("Invalid audience")
        if UUID(claims["sub"]) != user_id or claims["iss"] != issuer:
            raise ValueError("Invalid identity")
        issued = datetime.fromtimestamp(claims["iat"], timezone.utc)
        expires = datetime.fromtimestamp(claims["exp"], timezone.utc)
        now = datetime.now(timezone.utc)
        if expires <= now or issued.timestamp() > now.timestamp() + 30:
            raise ValueError("Expired or future token")
        methods = claims.get("amr", [])
        recovery = any(isinstance(item, dict) and item.get("method") == "recovery" for item in methods)
        return SessionIdentity(user_id, UUID(claims["session_id"]), issued, expires, recovery)
    except (jwt.PyJWTError, TypeError, ValueError, KeyError, OverflowError):
        raise AuthenticationError() from None


def access_token_expired(token: str) -> bool:
    """Choose whether to attempt refresh; this never authenticates a token."""
    try:
        claims = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
        return float(claims["exp"]) <= datetime.now(timezone.utc).timestamp()
    except (jwt.PyJWTError, TypeError, ValueError, KeyError):
        return False
