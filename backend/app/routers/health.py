"""Health records API router: list/create records and AI-generated health summary."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.middleware.auth import CurrentUser, get_current_user
from app.middleware.rate_limit import AI_RATE_LIMIT, limiter
from app.models.health_record import (
    HealthRecordCreate,
    HealthRecordListResponse,
    HealthRecordResponse,
    HealthRecordType,
    HealthSummaryResponse,
)
from app.services.ai_service import ai_service
from app.services.prompt_builder import prompt_builder
from app.services.supabase_service import SupabaseServiceError, supabase_service
from app.utils.safety import (
    MEDICAL_DISCLAIMER,
    ensure_medical_disclaimer,
    validate_response_safety,
)

router = APIRouter(prefix="/health", tags=["Health Records"])


@router.get("/records", response_model=HealthRecordListResponse)
async def get_health_records(
    record_type: Optional[HealthRecordType] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: CurrentUser = Depends(get_current_user),
) -> HealthRecordListResponse:
    """Return the authenticated user's health records, optionally filtered by type."""
    try:
        rows = supabase_service.list_health_records(
            user_id=current_user.user_id,
            record_type=record_type,
            limit=limit,
        )
        records = [HealthRecordResponse(**row) for row in rows]
        return HealthRecordListResponse(records=records, total=len(records))
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/records",
    response_model=HealthRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_health_record(
    payload: HealthRecordCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> HealthRecordResponse:
    """Create a new health record (vital signs, symptom, medication, allergy, etc.)."""
    try:
        row = supabase_service.create_health_record(
            user_id=current_user.user_id,
            record_type=payload.record_type,
            data=payload.data,
            source=payload.source,
            recorded_at=payload.recorded_at,
        )
        return HealthRecordResponse(**row)
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/summary", response_model=HealthSummaryResponse)
@limiter.limit(AI_RATE_LIMIT)
async def get_health_summary(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> HealthSummaryResponse:
    """Generate a non-diagnostic AI health summary from the user's recent health records."""
    try:
        records = supabase_service.list_health_records(
            user_id=current_user.user_id, limit=30
        )
        now = datetime.now(timezone.utc)

        if not records:
            return HealthSummaryResponse(
                summary=(
                    "You haven't logged any health records yet. Once you add vital signs, "
                    "symptoms, medications, or allergies, I can generate an educational "
                    "summary to help you review trends with your doctor."
                ),
                record_count=0,
                categories_covered=[],
                generated_at=now,
                disclaimer=MEDICAL_DISCLAIMER,
                metadata={"disclaimer_included": True},
            )

        profile = supabase_service.get_user_profile(current_user.user_id)
        prompt = prompt_builder.build_health_summary_prompt(
            records=records, user_profile=profile
        )
        ai_result = ai_service.generate_health_response(prompt=prompt)
        safety = validate_response_safety(ai_result.text)
        summary_text, _ = ensure_medical_disclaimer(safety.sanitized_response)

        categories = sorted({str(r.get("record_type", "note")) for r in records})
        return HealthSummaryResponse(
            summary=summary_text,
            record_count=len(records),
            categories_covered=categories,
            generated_at=now,
            disclaimer=MEDICAL_DISCLAIMER,
            metadata={
                "interaction_id": ai_result.interaction_id,
                "safety_flags": safety.flags,
                "is_fallback": ai_result.is_fallback,
                "disclaimer_included": True,
            },
        )
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
