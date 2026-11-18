"""Reports API router: generate PDF summaries, list reports, and download PDF files."""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.config import settings
from app.middleware.auth import CurrentUser, get_current_user
from app.models.report import (
    ReportGenerateRequest,
    ReportListResponse,
    ReportResponse,
)
from app.services.report_service import report_service
from app.services.supabase_service import SupabaseServiceError, supabase_service

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post(
    "/generate",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_report(
    payload: ReportGenerateRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ReportResponse:
    """Generate a PDF health information summary from selected conversations and records."""
    try:
        start_date = payload.date_range.start_date if payload.date_range else None
        end_date = payload.date_range.end_date if payload.date_range else None

        report = report_service.generate_and_store_report(
            user_id=current_user.user_id,
            conversation_ids=payload.conversation_ids,
            include_vitals=payload.include_vitals,
            start_date=start_date,
            end_date=end_date,
            report_type=payload.report_type,
        )
        return ReportResponse(**report)
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("", response_model=ReportListResponse)
async def list_reports(
    current_user: CurrentUser = Depends(get_current_user),
) -> ReportListResponse:
    """List all generated reports owned by the authenticated user."""
    try:
        rows = supabase_service.list_health_reports(user_id=current_user.user_id)
        reports: list[ReportResponse] = []
        for row in rows:
            download_url = f"/api/reports/{row['id']}/download"
            reports.append(ReportResponse(**{**row, "download_url": download_url}))
        return ReportListResponse(reports=reports, total=len(reports))
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    """Download the generated PDF file for a report owned by the current user."""
    try:
        report = supabase_service.get_health_report(
            user_id=current_user.user_id, report_id=report_id
        )
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found.",
            )

        pdf_path = report.get("pdf_path")
        if not pdf_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PDF file is not available for this report.",
            )

        pdf_bytes = supabase_service.download_file(
            bucket=settings.SUPABASE_REPORTS_BUCKET, storage_path=pdf_path
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="health_report_{report_id}.pdf"'
            },
        )
    except HTTPException:
        raise
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
