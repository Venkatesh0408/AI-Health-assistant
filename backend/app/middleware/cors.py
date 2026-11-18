"""CORS middleware configuration helper."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


def get_allowed_origins() -> list[str]:
    """Return allowed CORS origins from FRONTEND_URL (supports comma-separated values)."""
    origins: list[str] = []
    if settings.FRONTEND_URL:
        for origin in settings.FRONTEND_URL.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned and cleaned not in origins:
                origins.append(cleaned)

    if not settings.is_production:
        for dev_origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            if dev_origin not in origins:
                origins.append(dev_origin)

    return origins or ["http://localhost:5173"]


def configure_cors(app: FastAPI) -> None:
    """Attach CORSMiddleware to the FastAPI application."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
        expose_headers=["Content-Disposition"],
    )
