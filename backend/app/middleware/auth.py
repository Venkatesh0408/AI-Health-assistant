"""Authentication dependency verifying Supabase JWTs from the Authorization header."""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    """Authenticated user context extracted from a verified Supabase JWT."""

    user_id: str
    email: Optional[str] = None
    role: str = "authenticated"
    access_token: str

    @property
    def id(self) -> str:
        return self.user_id


def _verify_jwt_locally(token: str) -> Optional[CurrentUser]:
    """Verify JWT locally using SUPABASE_JWT_SECRET or APP_SECRET_KEY when configured."""
    secrets_to_try = [
        secret
        for secret in (settings.SUPABASE_JWT_SECRET, settings.APP_SECRET_KEY)
        if secret
    ]
    for secret in secrets_to_try:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            sub = payload.get("sub")
            if sub:
                return CurrentUser(
                    user_id=str(sub),
                    email=payload.get("email"),
                    role=str(payload.get("role", "authenticated")),
                    access_token=token,
                )
        except JWTError:
            continue
    return None


def _verify_jwt_via_supabase(token: str) -> Optional[CurrentUser]:
    """Verify token with Supabase Auth API."""
    if not settings.SUPABASE_URL or not (settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
        return None
    try:
        from app.services.supabase_service import supabase_service

        user_data = supabase_service.get_user_from_token(token)
        if user_data and user_data.get("id"):
            return CurrentUser(
                user_id=str(user_data["id"]),
                email=user_data.get("email"),
                role=str(user_data.get("role", "authenticated")),
                access_token=token,
            )
    except Exception:
        logger.warning("Supabase token verification failed.")
    return None


def verify_access_token(token: str) -> CurrentUser:
    """Verify a Bearer token and return CurrentUser or raise 401."""
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # First try local JWT verification if JWT secret is configured (fast, zero network hop)
    user = _verify_jwt_locally(token)
    if user is not None:
        return user

    # Fallback to Supabase Auth verification
    user = _verify_jwt_via_supabase(token)
    if user is not None:
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> CurrentUser:
    """FastAPI dependency requiring a valid Bearer JWT and returning the authenticated user."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_access_token(credentials.credentials)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[CurrentUser]:
    """FastAPI dependency returning CurrentUser if valid credentials are provided, else None."""
    if credentials is None or not credentials.credentials:
        return None
    try:
        return verify_access_token(credentials.credentials)
    except HTTPException:
        return None
