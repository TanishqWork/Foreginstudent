"""Stateless server-side Supabase Auth requests; user sessions are never shared."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

import httpx

from depth.core.config import Settings
from depth.core.exceptions import (
    AuthenticationError, AuthInputError, AuthProviderUnavailableError,
    EmailConfirmationRequired, RateLimitError,
)
from depth.security.tokens import SessionIdentity, claims_after_provider_validation


def _password_rejection_message(data: dict[str, Any]) -> str:
    """Translate only known reason codes; never echo a provider's raw message."""
    weakness = data.get("weak_password")
    supplied = weakness.get("reasons") if isinstance(weakness, dict) else None
    reasons = {item for item in supplied if isinstance(item, str)} if isinstance(supplied, list) else set()
    if "pwned" in reasons:
        return "This password is known to be compromised. Choose a different password."
    if reasons == {"length"}:
        return "Use at least 8 characters for your new password."
    return (
        "Use at least 8 characters, including an uppercase letter, a lowercase letter, "
        "a number, and a symbol."
    )


@dataclass(frozen=True)
class ProviderUser:
    id: UUID
    email: str
    created_at: datetime
    email_verified: bool


@dataclass(frozen=True)
class ProviderTokens:
    access_token: str = field(repr=False)
    refresh_token: str = field(repr=False)


@dataclass(frozen=True)
class ProviderSession:
    user: ProviderUser
    identity: SessionIdentity
    tokens: ProviderTokens = field(repr=False)


class SupabaseAuthProvider:
    def __init__(self, settings: Settings):
        self.url = settings.supabase_url + "/auth/v1"
        self.key = settings.supabase_publishable_key.get_secret_value()

    def _request(
        self, method: str, path: str, *, body: dict[str, Any] | None = None,
        token: str | None = None, params: dict[str, str] | None = None,
        recovery_request: bool = False,
    ) -> dict[str, Any]:
        headers = {"apikey": self.key}
        if token:
            headers["Authorization"] = "Bearer " + token
        try:
            with httpx.Client(timeout=20.0, follow_redirects=False) as client:
                response = client.request(method, self.url + path, json=body, headers=headers, params=params)
        except httpx.HTTPError:
            raise AuthProviderUnavailableError() from None
        if response.status_code >= 500 or response.status_code in (301, 302, 307, 308):
            raise AuthProviderUnavailableError()
        try:
            data = response.json() if response.content else {}
        except ValueError:
            raise AuthProviderUnavailableError() from None
        if not isinstance(data, dict):
            raise AuthProviderUnavailableError()
        if response.status_code == 429:
            retry = response.headers.get("retry-after", "60")
            raise RateLimitError(int(retry) if retry.isdigit() else 60)
        if response.status_code >= 400:
            code = data.get("error_code") or data.get("code")
            if recovery_request and code in ("email_address_not_authorized", "user_not_found"):
                return {}
            if code == "email_not_confirmed":
                raise EmailConfirmationRequired()
            if code == "same_password":
                raise AuthInputError("Choose a new password that is different from your current password.")
            if code in ("weak_password", "validation_failed"):
                raise AuthInputError(_password_rejection_message(data))
            if response.status_code in (401, 403) and not token and code not in (
                "invalid_credentials", "email_not_confirmed",
            ):
                raise AuthProviderUnavailableError()
            raise AuthenticationError()
        return data

    @staticmethod
    def _user(data: dict[str, Any]) -> ProviderUser:
        try:
            return ProviderUser(
                UUID(data["id"]), str(data["email"]).strip().lower(),
                datetime.fromisoformat(str(data["created_at"]).replace("Z", "+00:00")),
                bool(data.get("email_confirmed_at")),
            )
        except (KeyError, ValueError, TypeError):
            raise AuthProviderUnavailableError() from None

    def authenticate(self, token: str) -> tuple[ProviderUser, SessionIdentity]:
        user = self._user(self._request("GET", "/user", token=token))
        return user, claims_after_provider_validation(token, user.id, self.url)

    def _session(self, data: dict[str, Any]) -> ProviderSession:
        try:
            tokens = ProviderTokens(str(data["access_token"]), str(data["refresh_token"]))
        except (KeyError, TypeError):
            raise AuthenticationError() from None
        user, identity = self.authenticate(tokens.access_token)
        return ProviderSession(user, identity, tokens)

    def sign_in(self, email: str, password: str) -> ProviderSession:
        return self._session(self._request(
            "POST", "/token", params={"grant_type": "password"},
            body={"email": email, "password": password},
        ))

    def sign_up(self, email: str, password: str, redirect_to: str, challenge: str | None = None) -> ProviderSession | None:
        data = self._request(
            "POST", "/signup", params={"redirect_to": redirect_to},
            body={"email": email, "password": password, **({"code_challenge": challenge, "code_challenge_method": "s256"} if challenge else {})},
        )
        # An obfuscated signup user is not proof of authentication.
        return self._session(data) if data.get("access_token") else None

    def refresh(self, refresh_token: str) -> ProviderSession:
        return self._session(self._request(
            "POST", "/token", params={"grant_type": "refresh_token"},
            body={"refresh_token": refresh_token},
        ))

    def send_recovery(self, email: str, challenge: str, redirect_to: str) -> None:
        self._request("POST", "/recover", params={"redirect_to": redirect_to}, body={
            "email": email, "code_challenge": challenge, "code_challenge_method": "s256",
        }, recovery_request=True)

    def exchange_code(self, code: str, verifier: str) -> ProviderSession:
        return self._session(self._request(
            "POST", "/token", params={"grant_type": "pkce"},
            body={"auth_code": code, "code_verifier": verifier},
        ))

    def verify_recovery(self, token_hash: str) -> ProviderSession:
        return self._session(self._request(
            "POST", "/verify", body={"token_hash": token_hash, "type": "recovery"},
        ))

    def update_password(self, token: str, password: str) -> None:
        self._request("PUT", "/user", token=token, body={"password": password})

    def sign_out(self, token: str, *, all_sessions: bool = False) -> None:
        self._request("POST", "/logout", token=token, params={"scope": "global" if all_sessions else "local"})
