from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator, model_validator


class EmailRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class LoginRequest(EmailRequest):
    # Longer existing Argon2id passwords remain valid on imported accounts.
    password: SecretStr = Field(min_length=8, max_length=128)


class ResetPasswordRequest(BaseModel):
    password: SecretStr = Field(min_length=8, max_length=128)
    password_confirmation: SecretStr = Field(min_length=8, max_length=128)

    @field_validator("password", "password_confirmation")
    @classmethod
    def password_bytes(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value().encode("utf-8")) > 72:
            raise ValueError("Use a password of at most 72 UTF-8 bytes.")
        return value

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password.get_secret_value() != self.password_confirmation.get_secret_value():
            raise ValueError("Passwords do not match.")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str
    created_at: datetime


class SessionResponse(BaseModel):
    user: UserResponse
    expires_at: datetime


class ConfirmationResponse(BaseModel):
    status: Literal["confirmation_required"] = "confirmation_required"
    email: str


class MessageResponse(BaseModel):
    message: str


class RecoveryResponse(BaseModel):
    valid: Literal[True] = True
