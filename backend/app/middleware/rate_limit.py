"""SlowAPI rate limiting configuration: 100/min general, 10/min for AI endpoints."""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings

GENERAL_RATE_LIMIT = settings.general_rate_limit_str
AI_RATE_LIMIT = settings.ai_rate_limit_str


def _rate_limit_key(request: Request) -> str:
    """Identify client by authenticated bearer token hash fallback to remote IP."""
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            # Use a short non-reversible slice/hash of token so limits are per-user
            return f"user:{hash(token)}"
    return get_remote_address(request)


limiter = Limiter(
    key_func=_rate_limit_key,
    default_limits=[GENERAL_RATE_LIMIT],
    headers_enabled=False,
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return structured JSON 429 error when rate limits are exceeded."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Please wait a moment before trying again.",
            "status_code": 429,
            "limit": str(exc.detail) if getattr(exc, "detail", None) else None,
        },
        headers={"Retry-After": "60"},
    )
