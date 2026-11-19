"""Pydantic models for conversations and chat messages."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.sanitizers import sanitize_text

ConversationStatus = Literal["active", "archived", "deleted"]
MessageRole = Literal["user", "assistant", "system"]


class ConversationCreate(BaseModel):
    """Request payload to start a new conversation."""

    title: Optional[str] = Field(default="New Conversation", max_length=200)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: Optional[str]) -> str:
        if not value:
            return "New Conversation"
        cleaned = sanitize_text(value, max_length=200)
        return cleaned or "New Conversation"


class MessageCreate(BaseModel):
    """Request payload to post a user message to a conversation."""

    content: str = Field(..., min_length=1, max_length=5000)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    language: Optional[str] = Field(default="en", max_length=10)

    @field_validator("language")
    @classmethod
    def clean_language(cls, value: Optional[str]) -> str:
        if not value:
            return "en"
        return value.strip().lower()[:10]

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        cleaned = sanitize_text(value, max_length=5000)
        if not cleaned:
            raise ValueError("Message content cannot be empty.")
        return cleaned

    @field_validator("image_url")
    @classmethod
    def clean_image_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class MessageResponse(BaseModel):
    """Single chat message response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: MessageRole
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    image_url: Optional[str] = None
    created_at: datetime


class ConversationResponse(BaseModel):
    """Conversation summary response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    status: ConversationStatus = "active"
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(ConversationResponse):
    """Conversation with its chronological message list."""

    messages: list[MessageResponse] = Field(default_factory=list)


class ConversationListResponse(BaseModel):
    """Paginated list of user conversations."""

    conversations: list[ConversationResponse] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20


class SendMessageResponse(BaseModel):
    """Response returned after sending a user message and receiving AI guidance."""

    user_message: MessageResponse
    assistant_message: MessageResponse
    emergency: dict[str, Any] = Field(default_factory=lambda: {"is_emergency": False})
    metadata: dict[str, Any] = Field(default_factory=dict)
    conversation_title: Optional[str] = None
