"""Pydantic models for image uploads and multimodal AI analyses."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.sanitizers import sanitize_text


class ImageUploadResponse(BaseModel):
    """Response returned after validating and uploading an image."""

    image_url: str
    image_path: str
    content_type: str
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None


class ImageAnalyzeRequest(BaseModel):
    """Request payload for multimodal AI analysis of an uploaded image."""

    image_url: str = Field(..., min_length=1, max_length=2048)
    question: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None

    @field_validator("image_url")
    @classmethod
    def clean_image_url(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("image_url cannot be empty.")
        return cleaned

    @field_validator("question")
    @classmethod
    def clean_question(cls, value: str) -> str:
        cleaned = sanitize_text(value, max_length=2000)
        if not cleaned:
            raise ValueError("Please provide a question about the image.")
        return cleaned


class ImageAnalysisResponse(BaseModel):
    """Response for a single image analysis record."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    conversation_id: Optional[str] = None
    image_url: str
    image_path: str
    question: str
    analysis: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ImageAnalysisListResponse(BaseModel):
    """List of past image analyses."""

    analyses: list[ImageAnalysisResponse] = Field(default_factory=list)
    total: int = 0
