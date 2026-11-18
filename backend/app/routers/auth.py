"""Authentication API router: register, login, logout, password recovery, email verification."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.middleware.auth import CurrentUser, get_current_user
from app.middleware.rate_limit import GENERAL_RATE_LIMIT, limiter
from app.models.user import (
    AuthResponse,
    ForgotPasswordRequest,
    MessageStatusResponse,
    UserInfo,
    UserLogin,
    UserRegister,
)
from app.services.supabase_service import SupabaseServiceError, supabase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(GENERAL_RATE_LIMIT)
async def register(request: Request, payload: UserRegister) -> AuthResponse:
    """Register a new user account via Supabase Auth."""
    try:
        result = supabase_service.register_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.display_name,
        )
        return AuthResponse(
            access_token=result.get("access_token"),
            refresh_token=result.get("refresh_token"),
            expires_in=result.get("expires_in"),
            user=UserInfo(**result["user"]),
            message=(
                "Account created successfully. Please check your email to verify your account."
                if not result.get("access_token")
                else "Account created and signed in successfully."
            ),
        )
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
@limiter.limit(GENERAL_RATE_LIMIT)
async def login(request: Request, payload: UserLogin) -> AuthResponse:
    """Authenticate an existing user and return a JWT session."""
    try:
        result = supabase_service.login_user(
            email=payload.email,
            password=payload.password,
        )
        return AuthResponse(
            access_token=result.get("access_token"),
            refresh_token=result.get("refresh_token"),
            expires_in=result.get("expires_in"),
            user=UserInfo(**result["user"]),
            message="Logged in successfully.",
        )
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/logout",
    response_model=MessageStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def logout(current_user: CurrentUser = Depends(get_current_user)) -> MessageStatusResponse:
    """Invalidate the current authenticated session."""
    supabase_service.logout_user(current_user.access_token)
    return MessageStatusResponse(status="ok", message="Logged out successfully.")


@router.post(
    "/forgot-password",
    response_model=MessageStatusResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
async def forgot_password(
    request: Request, payload: ForgotPasswordRequest
) -> MessageStatusResponse:
    """Send a password reset email via Supabase Auth without revealing account existence."""
    supabase_service.send_password_reset(payload.email)
    return MessageStatusResponse(
        status="ok",
        message="If an account exists for that email address, a password reset link has been sent.",
    )


@router.get(
    "/verify-email",
    response_model=MessageStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def verify_email(
    token: str = Query(..., min_length=6, description="Email verification token"),
    token_type: str = Query(default="signup", alias="type"),
) -> MessageStatusResponse:
    """Verify a user's email address using the Supabase confirmation token."""
    try:
        supabase_service.verify_email_token(token=token, token_type=token_type)
        return MessageStatusResponse(
            status="ok",
            message="Email verified successfully. You may now sign in.",
        )
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
