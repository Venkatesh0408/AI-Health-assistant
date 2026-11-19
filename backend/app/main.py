"""FastAPI application entry point for the AI Health Monitoring System."""

import logging
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.middleware.cors import configure_cors
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler
from app.middleware.security import SecurityHeadersMiddleware
from app.routers import auth, chat, health, images, privacy, reports, users, voice
from app.services.image_service import ImageServiceError
from app.services.supabase_service import SupabaseServiceError

logging.basicConfig(
    level=logging.INFO if not settings.is_production else logging.WARNING,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    application = FastAPI(
        title="AI Health Monitor API",
        version="1.0.0",
        description=(
            "Backend API for the AI Health Monitoring System. "
            "Provides educational health information only — NOT a medical diagnosis tool."
        ),
        docs_url=None if settings.is_production else "/api/docs",
        redoc_url=None if settings.is_production else "/api/redoc",
        openapi_url=None if settings.is_production else "/api/openapi.json",
    )

    # Rate limiter state & middleware
    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    application.add_middleware(SlowAPIMiddleware)

    # Security headers & CORS
    application.add_middleware(SecurityHeadersMiddleware)
    configure_cors(application)

    # Structured exception handlers (never expose stack traces in production)
    @application.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
                "status_code": exc.status_code,
            },
            headers=exc.headers,
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(loc) for loc in err.get("loc", [])),
                "message": err.get("msg", "Invalid value"),
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Request validation failed.",
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "errors": errors,
            },
        )

    @application.exception_handler(SupabaseServiceError)
    async def supabase_error_handler(
        request: Request, exc: SupabaseServiceError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.message,
                "status_code": exc.status_code,
            },
        )

    @application.exception_handler(ImageServiceError)
    async def image_error_handler(
        request: Request, exc: ImageServiceError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.message,
                "status_code": exc.status_code,
            },
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled server error (%s) on %s", type(exc).__name__, request.url.path)
        detail = (
            "An internal server error occurred. Please try again later."
            if settings.is_production
            else f"Internal server error ({type(exc).__name__})."
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": detail,
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )

    # Health check endpoint
    @application.get("/api/health", tags=["System"])
    async def health_check() -> dict[str, object]:
        return {
            "status": "healthy",
            "service": "ai-health-monitor-backend",
            "environment": settings.APP_ENV,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # Mount all routers with /api prefix
    for router in (
        auth.router,
        chat.router,
        images.router,
        health.router,
        reports.router,
        users.router,
        privacy.router,
        voice.router,
    ):
        application.include_router(router, prefix="/api")

    return application


app = create_app()
