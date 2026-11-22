"""CORS middleware configuration helper."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# Explicit trusted origins
DEFAULT_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://ai-health-assistant-iota.vercel.app",
    "https://ai-health-assistant-85q.pages.dev",
]


def get_allowed_origins() -> list[str]:
    """Return allowed CORS origins from FRONTEND_URL and defaults."""
    origins: list[str] = list(DEFAULT_TRUSTED_ORIGINS)
    if settings.FRONTEND_URL:
        for origin in settings.FRONTEND_URL.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned and cleaned not in origins:
                origins.append(cleaned)

    return origins


def configure_cors(app: FastAPI) -> None:
    """Attach CORSMiddleware to the FastAPI application."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_origin_regex=r"^https:\/\/(?:[a-zA-Z0-9-]+\.)*(?:vercel\.app|pages\.dev|onrender\.com)$",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
        expose_headers=["Content-Disposition"],
    )
