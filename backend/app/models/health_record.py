"""Pydantic models for health records and AI health summaries."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.sanitizers import sanitize_dict_strings

HealthRecordType = Literal[
    "vital_signs", "symptom", "medication", "allergy", "condition", "note"
]
HealthRecordSource = Literal["user_entered", "ai_observed", "device_measured"]


class HealthRecordCreate(BaseModel):
    """Request payload for adding a new health record."""

    record_type: HealthRecordType
    data: dict[str, Any] = Field(..., min_length=1)
    source: HealthRecordSource = "user_entered"
    recorded_at: Optional[datetime] = None

    @field_validator("data")
    @classmethod
    def sanitize_data(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(value, dict) or len(value) == 0:
            raise ValueError("Health record data must be a non-empty object.")
        return sanitize_dict_strings(value, max_length=2000)


class HealthRecordResponse(BaseModel):
    """Single health record response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    record_type: HealthRecordType
    data: dict[str, Any]
    source: HealthRecordSource = "user_entered"
    recorded_at: datetime
    created_at: Optional[datetime] = None


class HealthRecordListResponse(BaseModel):
    """List of health records response."""

    records: list[HealthRecordResponse] = Field(default_factory=list)
    total: int = 0


class HealthSummaryResponse(BaseModel):
    """AI-generated summary based on recent health records."""

    summary: str
    record_count: int = 0
    categories_covered: list[str] = Field(default_factory=list)
    generated_at: datetime
    disclaimer: str
    metadata: dict[str, Any] = Field(default_factory=dict)
