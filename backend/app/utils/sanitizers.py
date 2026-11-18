"""Input sanitization utilities: HTML stripping, Unicode normalization, and length enforcement."""

import re
import unicodedata
from typing import Any

import bleach

# Control characters except common whitespace (\t, \n, \r)
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# Collapse excessive runs of blank lines while preserving normal paragraph breaks
_EXCESS_NEWLINES_RE = re.compile(r"\n{4,}")
# Safe filename characters
_UNSAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]")
# Script/style block removal before bleach strips tags so inner JS/CSS text is not kept
_SCRIPT_STYLE_RE = re.compile(
    r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL
)


def sanitize_text(
    text: str,
    max_length: int = 10000,
    strip_whitespace: bool = True,
) -> str:
    """Strip HTML/scripts, normalize Unicode (NFKC), remove control chars, and enforce max length."""
    if not isinstance(text, str):
        text = str(text)

    # Normalize Unicode to NFKC to defeat homoglyph/width tricks
    normalized = unicodedata.normalize("NFKC", text)

    # Remove script/style blocks completely before stripping remaining HTML tags
    without_scripts = _SCRIPT_STYLE_RE.sub("", normalized)

    # Strip all HTML tags and attributes safely using bleach
    cleaned = bleach.clean(without_scripts, tags=[], attributes={}, strip=True)

    # Remove dangerous/invisible control characters
    cleaned = _CONTROL_CHAR_RE.sub("", cleaned)

    # Normalize excessive blank lines
    cleaned = _EXCESS_NEWLINES_RE.sub("\n\n\n", cleaned)

    if strip_whitespace:
        cleaned = cleaned.strip()

    if max_length > 0 and len(cleaned) > max_length:
        cleaned = cleaned[:max_length]

    return cleaned


def sanitize_filename(filename: str, max_length: int = 128) -> str:
    """Return a filesystem- and storage-safe filename without directory traversal."""
    if not filename:
        return "upload"

    normalized = unicodedata.normalize("NFKC", filename)
    # Strip any path components
    basename = normalized.replace("\\", "/").split("/")[-1]
    safe = _UNSAFE_FILENAME_RE.sub("_", basename).strip("._")
    if not safe:
        safe = "upload"
    if len(safe) > max_length:
        parts = safe.rsplit(".", 1)
        if len(parts) == 2 and len(parts[1]) <= 10:
            ext = "." + parts[1]
            safe = parts[0][: max_length - len(ext)] + ext
        else:
            safe = safe[:max_length]
    return safe


def sanitize_dict_strings(
    data: dict[str, Any],
    max_length: int = 2000,
    max_depth: int = 6,
) -> dict[str, Any]:
    """Recursively sanitize string values inside a JSON-like dictionary."""
    if max_depth <= 0:
        return {}

    sanitized: dict[str, Any] = {}
    for key, value in data.items():
        clean_key = sanitize_text(str(key), max_length=128)
        if not clean_key:
            continue
        sanitized[clean_key] = _sanitize_value(value, max_length, max_depth - 1)
    return sanitized


def _sanitize_value(value: Any, max_length: int, depth: int) -> Any:
    if isinstance(value, str):
        return sanitize_text(value, max_length=max_length)
    if isinstance(value, dict):
        return sanitize_dict_strings(value, max_length=max_length, max_depth=depth)
    if isinstance(value, list):
        if depth <= 0:
            return []
        return [_sanitize_value(item, max_length, depth - 1) for item in value[:100]]
    return value


def redact_for_logging(text: str | None) -> str:
    """Never log health data in plaintext — return only metadata length marker."""
    if text is None:
        return "<empty>"
    return f"<redacted len={len(text)}>"
