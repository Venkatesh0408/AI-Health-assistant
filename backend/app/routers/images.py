"""Images API router: upload validation, multimodal AI analysis, and analysis history."""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.config import settings
from app.middleware.auth import CurrentUser, get_current_user
from app.middleware.rate_limit import AI_RATE_LIMIT, limiter
from app.models.image_analysis import (
    ImageAnalysisListResponse,
    ImageAnalysisResponse,
    ImageAnalyzeRequest,
    ImageUploadResponse,
)
from app.services.image_service import ImageServiceError, image_service
from app.services.supabase_service import SupabaseServiceError, supabase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["Images"])


@router.post(
    "/upload",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
) -> ImageUploadResponse:
    """Validate uploaded image (JPG/PNG/WebP, max 10MB, magic bytes) and upload to Supabase Storage."""
    try:
        # Read one extra byte beyond limit so oversized payloads are rejected cleanly
        max_bytes = settings.max_image_size_bytes
        raw_bytes = await file.read(max_bytes + 1)
        if len(raw_bytes) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image exceeds maximum allowed size of {settings.MAX_IMAGE_SIZE_MB}MB.",
            )

        uploaded = image_service.upload_user_image(
            user_id=current_user.user_id,
            raw_bytes=raw_bytes,
            filename=file.filename,
            declared_content_type=file.content_type,
        )
        return ImageUploadResponse(**uploaded)
    except HTTPException:
        raise
    except ImageServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/analyze",
    response_model=ImageAnalysisResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(AI_RATE_LIMIT)
async def analyze_image(
    request: Request,
    payload: ImageAnalyzeRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ImageAnalysisResponse:
    """Run non-diagnostic multimodal AI analysis on an uploaded health image."""
    try:
        if payload.conversation_id:
            conv = supabase_service.get_conversation(
                user_id=current_user.user_id, conversation_id=payload.conversation_id
            )
            if conv is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Referenced conversation not found.",
                )

        user_profile = supabase_service.get_user_profile(current_user.user_id)
        analysis = image_service.analyze_user_image(
            user_id=current_user.user_id,
            image_url=payload.image_url,
            question=payload.question,
            conversation_id=payload.conversation_id,
            user_profile=user_profile,
        )
        return ImageAnalysisResponse(**analysis)
    except HTTPException:
        raise
    except ImageServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/analyses", response_model=ImageAnalysisListResponse)
async def list_image_analyses(
    current_user: CurrentUser = Depends(get_current_user),
) -> ImageAnalysisListResponse:
    """List the authenticated user's past image analyses."""
    try:
        rows = supabase_service.list_image_analyses(user_id=current_user.user_id)
        items = [
            ImageAnalysisResponse(
                **{
                    **row,
                    "image_url": row.get("image_url") or row.get("image_path", ""),
                }
            )
            for row in rows
        ]
        return ImageAnalysisListResponse(analyses=items, total=len(items))
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
