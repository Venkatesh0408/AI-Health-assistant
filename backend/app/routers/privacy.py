"""Privacy API router: get and update user consent settings."""

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import CurrentUser, get_current_user
from app.models.user import PrivacySettings, PrivacySettingsUpdate
from app.services.supabase_service import SupabaseServiceError, supabase_service

router = APIRouter(prefix="/privacy", tags=["Privacy"])


@router.get("/settings", response_model=PrivacySettings)
async def get_privacy_settings(
    current_user: CurrentUser = Depends(get_current_user),
) -> PrivacySettings:
    """Get the authenticated user's privacy & consent settings."""
    try:
        row = supabase_service.ensure_privacy_settings(user_id=current_user.user_id)
        return PrivacySettings(**row)
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/settings", response_model=PrivacySettings)
async def update_privacy_settings(
    payload: PrivacySettingsUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> PrivacySettings:
    """Update the authenticated user's consent preferences."""
    updates = payload.model_dump(exclude_unset=True)
    try:
        if not updates:
            row = supabase_service.ensure_privacy_settings(user_id=current_user.user_id)
        else:
            row = supabase_service.update_privacy_settings(
                user_id=current_user.user_id, updates=updates
            )
        return PrivacySettings(**row)
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
