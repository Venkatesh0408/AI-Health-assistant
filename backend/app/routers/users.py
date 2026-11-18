"""Users API router: profile management, full JSON data export, and cascading account deletion."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import CurrentUser, get_current_user
from app.models.user import (
    MessageStatusResponse,
    UserDataExport,
    UserProfile,
    UserProfileUpdate,
)
from app.services.supabase_service import SupabaseServiceError, supabase_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/profile", response_model=UserProfile)
async def get_profile(
    current_user: CurrentUser = Depends(get_current_user),
) -> UserProfile:
    """Return the authenticated user's profile (creating a default row if needed)."""
    try:
        profile = supabase_service.ensure_user_profile(user_id=current_user.user_id)
        return UserProfile(**{**profile, "email": current_user.email})
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/profile", response_model=UserProfile)
async def update_profile(
    payload: UserProfileUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> UserProfile:
    """Update the authenticated user's profile fields."""
    updates = payload.model_dump(exclude_unset=True)
    if "date_of_birth" in updates and updates["date_of_birth"] is not None:
        updates["date_of_birth"] = updates["date_of_birth"].isoformat()

    try:
        if not updates:
            profile = supabase_service.ensure_user_profile(user_id=current_user.user_id)
        else:
            profile = supabase_service.update_user_profile(
                user_id=current_user.user_id, updates=updates
            )
        return UserProfile(**{**profile, "email": current_user.email})
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/account", response_model=MessageStatusResponse)
async def delete_account(
    current_user: CurrentUser = Depends(get_current_user),
) -> MessageStatusResponse:
    """Permanently delete the authenticated user's account and ALL associated data (cascading)."""
    try:
        supabase_service.delete_user_account_cascading(user_id=current_user.user_id)
        return MessageStatusResponse(
            status="ok",
            message="Your account and all associated health data have been permanently deleted.",
        )
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/export", response_model=UserDataExport)
async def export_user_data(
    current_user: CurrentUser = Depends(get_current_user),
) -> UserDataExport:
    """Export all data owned by the authenticated user as structured JSON."""
    try:
        exported = supabase_service.export_user_data(user_id=current_user.user_id)
        return UserDataExport(**exported)
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
