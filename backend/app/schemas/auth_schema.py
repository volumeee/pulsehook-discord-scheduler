"""Pydantic v2 validation schemas for user account registration, login, and 6-digit OTP flows."""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,32}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
OTP_PATTERN = re.compile(r"^\d{6}$")


class RegisterSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    username: str = Field(..., min_length=3, max_length=32)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        trimmed = value.strip()
        if not USERNAME_PATTERN.match(trimmed):
            raise ValueError(
                "Username must be 3–32 characters using only letters, numbers, or underscores."
            )
        return trimmed

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_PATTERN.match(normalized):
            raise ValueError("Please enter a valid email address.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(ch.islower() for ch in value) or not any(ch.isupper() for ch in value):
            raise ValueError("Password must include both uppercase and lowercase letters.")
        if not any(ch.isdigit() for ch in value):
            raise ValueError("Password must include at least one number.")
        return value


class LoginSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    identifier: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Enter your username or email address.")
        return trimmed


class VerifyOtpSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    challengeToken: str = Field(..., min_length=16, max_length=128)
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        cleaned = re.sub(r"\s+", "", value)
        if not OTP_PATTERN.match(cleaned):
            raise ValueError("Enter the 6-digit numeric verification code.")
        return cleaned


class ResendOtpSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    challengeToken: str = Field(..., min_length=16, max_length=128)


class ForgotPasswordSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    identifier: str = Field(..., min_length=2, max_length=255)

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Enter your username or email address.")
        return trimmed


class ValidateResetTokenSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    token: str = Field(..., min_length=20, max_length=256)

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed.startswith("ph_rst_"):
            raise ValueError("Invalid password reset link.")
        return trimmed


class ResetPasswordSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    token: str = Field(..., min_length=20, max_length=256)
    newPassword: str = Field(..., min_length=8, max_length=128)

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed.startswith("ph_rst_"):
            raise ValueError("Invalid password reset link.")
        return trimmed

    @field_validator("newPassword")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(ch.islower() for ch in value) or not any(ch.isupper() for ch in value):
            raise ValueError("Password must include both uppercase and lowercase letters.")
        if not any(ch.isdigit() for ch in value):
            raise ValueError("Password must include at least one number.")
        return value


class CreateApiKeySchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) < 2:
            raise ValueError("API key name must be at least 2 characters.")
        return trimmed
