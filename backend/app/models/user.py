"""Pydantic models for authentication, user profiles, privacy settings, and data export."""

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.sanitizers import sanitize_text
from app.utils.validators import validate_email, validate_password_strength

GenderType = Literal["male", "female", "other", "prefer_not_to_say"]


class UserRegister(BaseModel):
    """Request payload for user registration."""

    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str = Field(..., min_length=1, max_length=100)

    @field_validator("email")
    @classmethod
    def check_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not validate_email(cleaned):
            raise ValueError("Please provide a valid email address.")
        return cleaned

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        result = validate_password_strength(value)
        if not result.is_valid:
            raise ValueError(" ".join(result.errors))
        return value

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        cleaned = sanitize_text(value, max_length=100)
        if not cleaned:
            raise ValueError("Display name cannot be empty.")
        return cleaned


class UserLogin(BaseModel):
    """Request payload for user login."""

    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def check_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not validate_email(cleaned):
            raise ValueError("Please provide a valid email address.")
        return cleaned


class ForgotPasswordRequest(BaseModel):
    """Request payload for password reset email."""

    email: str = Field(..., min_length=5, max_length=254)

    @field_validator("email")
    @classmethod
    def check_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not validate_email(cleaned):
            raise ValueError("Please provide a valid email address.")
        return cleaned


class UserInfo(BaseModel):
    """Basic authenticated user summary."""

    id: str
    email: str
    display_name: Optional[str] = None
    email_verified: bool = False


class AuthResponse(BaseModel):
    """Response returned on successful register/login."""

    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: UserInfo
    message: Optional[str] = None


class MessageStatusResponse(BaseModel):
    """Generic status message response."""

    status: str = "ok"
    message: str


class UserProfile(BaseModel):
    """User profile response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[GenderType] = None
    medical_conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    """Request payload for updating user profile."""

    display_name: Optional[str] = Field(default=None, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[GenderType] = None
    medical_conditions: Optional[list[str]] = None
    allergies: Optional[list[str]] = None

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = sanitize_text(value, max_length=100)
        if not cleaned:
            raise ValueError("Display name cannot be blank.")
        return cleaned

    @field_validator("medical_conditions", "allergies")
    @classmethod
    def clean_string_list(cls, values: Optional[list[str]]) -> Optional[list[str]]:
        if values is None:
            return None
        cleaned: list[str] = []
        for item in values[:50]:
            text = sanitize_text(str(item), max_length=120)
            if text:
                cleaned.append(text)
        return cleaned

    @field_validator("date_of_birth")
    @classmethod
    def check_dob(cls, value: Optional[date]) -> Optional[date]:
        if value is not None and value > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return value


class PrivacySettings(BaseModel):
    """User privacy & consent preferences."""

    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    user_id: str
    data_collection_consent: bool = False
    ai_processing_consent: bool = False
    consent_updated_at: Optional[datetime] = None


class PrivacySettingsUpdate(BaseModel):
    """Request payload for updating privacy settings."""

    data_collection_consent: Optional[bool] = None
    ai_processing_consent: Optional[bool] = None


class UserDataExport(BaseModel):
    """Full JSON export of all user data."""

    exported_at: datetime
    user_id: str
    profile: Optional[dict[str, Any]] = None
    privacy_settings: Optional[dict[str, Any]] = None
    conversations: list[dict[str, Any]] = Field(default_factory=list)
    health_records: list[dict[str, Any]] = Field(default_factory=list)
    image_analyses: list[dict[str, Any]] = Field(default_factory=list)
    health_reports: list[dict[str, Any]] = Field(default_factory=list)
