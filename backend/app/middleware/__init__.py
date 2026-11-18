"""Middleware package: authentication, rate limiting, CORS, and security headers."""

from app.middleware.auth import CurrentUser, get_current_user, get_optional_user
from app.middleware.cors import configure_cors
from app.middleware.rate_limit import (
    AI_RATE_LIMIT,
    GENERAL_RATE_LIMIT,
    limiter,
    rate_limit_exceeded_handler,
)
from app.middleware.security import SecurityHeadersMiddleware

__all__ = [
    "AI_RATE_LIMIT",
    "CurrentUser",
    "GENERAL_RATE_LIMIT",
    "SecurityHeadersMiddleware",
    "configure_cors",
    "get_current_user",
    "get_optional_user",
    "limiter",
    "rate_limit_exceeded_handler",
]
