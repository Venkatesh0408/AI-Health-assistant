"""Pydantic models for PDF health report generation and retrieval."""

from datetime import date, datetime
from typing import Any, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator


class DateRange(BaseModel):
    """Optional inclusive date range filter for reports."""

    start_date: Optional[date] = Field(
        default=None, validation_alias=AliasChoices("start_date", "start")
    )
    end_date: Optional[date] = Field(
        default=None, validation_alias=AliasChoices("end_date", "end")
    )

    @model_validator(mode="after")
    def validate_order(self) -> "DateRange":
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date cannot be after end_date.")
        return self


class ReportGenerateRequest(BaseModel):
    """Request payload to generate a PDF health information summary."""

    conversation_ids: list[str] = Field(default_factory=list, max_length=50)
    include_vitals: bool = True
    date_range: Optional[DateRange] = None
    report_type: str = Field(default="health_summary", max_length=64)


class ReportResponse(BaseModel):
    """Response representing a generated health report."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    report_type: str = "health_summary"
    content: dict[str, Any] = Field(default_factory=dict)
    pdf_path: Optional[str] = None
    download_url: Optional[str] = None
    generated_at: datetime


class ReportListResponse(BaseModel):
    """List of generated reports for a user."""

    reports: list[ReportResponse] = Field(default_factory=list)
    total: int = 0
