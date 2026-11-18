"""Validation helpers for email, password strength, UUIDs, and image files with magic bytes."""

import re
import uuid
from dataclasses import dataclass, field
from typing import Iterable, Optional

from app.config import settings

# RFC-5322 inspired practical email regex
_EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)

# Magic byte signatures for supported image types
_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_WEBP_RIFF = b"RIFF"
_WEBP_TAG = b"WEBP"

_MIME_TO_EXTENSIONS = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
}


@dataclass
class PasswordValidationResult:
    """Result of password strength check."""

    is_valid: bool
    errors: list[str] = field(default_factory=list)


@dataclass
class ImageValidationResult:
    """Result of uploaded image file validation."""

    is_valid: bool
    detected_mime: Optional[str] = None
    size_bytes: int = 0
    error: Optional[str] = None


def validate_email(email: str) -> bool:
    """Validate email format and reasonable length."""
    if not email or not isinstance(email, str):
        return False
    cleaned = email.strip()
    if len(cleaned) > 254 or ".." in cleaned:
        return False
    return bool(_EMAIL_RE.match(cleaned))


def validate_password_strength(password: str) -> PasswordValidationResult:
    """Validate password complexity: >=8 chars, uppercase, lowercase, digit, special char."""
    errors: list[str] = []
    if not isinstance(password, str) or len(password) < 8:
        errors.append("Password must be at least 8 characters long.")
    if isinstance(password, str) and len(password) > 128:
        errors.append("Password must not exceed 128 characters.")
    if not any(ch.isupper() for ch in password):
        errors.append("Password must contain at least one uppercase letter.")
    if not any(ch.islower() for ch in password):
        errors.append("Password must contain at least one lowercase letter.")
    if not any(ch.isdigit() for ch in password):
        errors.append("Password must contain at least one digit.")
    if not any(not ch.isalnum() for ch in password):
        errors.append("Password must contain at least one special character.")

    return PasswordValidationResult(is_valid=len(errors) == 0, errors=errors)


def validate_uuid(value: str) -> bool:
    """Return True if value is a valid UUID string."""
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def detect_image_mime_from_magic_bytes(data: bytes) -> Optional[str]:
    """Identify image MIME type strictly from file magic bytes (not extension or header)."""
    if not data or len(data) < 12:
        return None
    if data[:3] == _JPEG_MAGIC:
        return "image/jpeg"
    if data[:8] == _PNG_MAGIC:
        return "image/png"
    if data[:4] == _WEBP_RIFF and data[8:12] == _WEBP_TAG:
        return "image/webp"
    return None


def validate_image_file(
    data: bytes,
    filename: Optional[str] = None,
    declared_content_type: Optional[str] = None,
    max_size_bytes: Optional[int] = None,
    allowed_types: Optional[Iterable[str]] = None,
) -> ImageValidationResult:
    """Validate an uploaded image using size limits, magic bytes, and allowed MIME types."""
    max_bytes = max_size_bytes if max_size_bytes is not None else settings.max_image_size_bytes
    allowed = {
        t.strip().lower()
        for t in (allowed_types if allowed_types is not None else settings.allowed_image_types_list)
    }

    size_bytes = len(data) if data else 0
    if size_bytes == 0:
        return ImageValidationResult(
            is_valid=False,
            size_bytes=0,
            error="Uploaded file is empty.",
        )

    if size_bytes > max_bytes:
        max_mb = max_bytes / (1024 * 1024)
        return ImageValidationResult(
            is_valid=False,
            size_bytes=size_bytes,
            error=f"Image exceeds maximum allowed size of {max_mb:.0f}MB.",
        )

    detected_mime = detect_image_mime_from_magic_bytes(data)
    if detected_mime is None:
        return ImageValidationResult(
            is_valid=False,
            size_bytes=size_bytes,
            error="Unsupported or corrupted image file. Only valid JPG, PNG, and WebP images are allowed.",
        )

    if detected_mime not in allowed:
        return ImageValidationResult(
            is_valid=False,
            detected_mime=detected_mime,
            size_bytes=size_bytes,
            error=f"Image type '{detected_mime}' is not allowed.",
        )

    if declared_content_type:
        norm_declared = declared_content_type.split(";")[0].strip().lower()
        if norm_declared == "image/jpg":
            norm_declared = "image/jpeg"
        if norm_declared and norm_declared != "application/octet-stream" and norm_declared != detected_mime:
            return ImageValidationResult(
                is_valid=False,
                detected_mime=detected_mime,
                size_bytes=size_bytes,
                error="Declared file content type does not match actual image format.",
            )

    if filename and "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
        valid_exts = _MIME_TO_EXTENSIONS.get(detected_mime, set())
        if ext and ext not in valid_exts:
            return ImageValidationResult(
                is_valid=False,
                detected_mime=detected_mime,
                size_bytes=size_bytes,
                error="File extension does not match actual image content.",
            )

    return ImageValidationResult(
        is_valid=True,
        detected_mime=detected_mime,
        size_bytes=size_bytes,
    )
