"""Chat API router: conversations CRUD and AI health messaging."""

import logging
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status

from app.middleware.auth import CurrentUser, get_current_user
from app.middleware.rate_limit import AI_RATE_LIMIT, limiter
from app.models.conversation import (
    ConversationCreate,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    SendMessageResponse,
)
from app.models.user import MessageStatusResponse
from app.services.health_query_engine import health_query_engine
from app.services.supabase_service import SupabaseServiceError, supabase_service
from app.utils.sanitizers import redact_for_logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: Optional[ConversationCreate] = Body(default=None),
    current_user: CurrentUser = Depends(get_current_user),
) -> ConversationResponse:
    """Create a new health conversation for the authenticated user."""
    title = payload.title if payload and payload.title else "New Conversation"
    try:
        conv = supabase_service.create_conversation(
            user_id=current_user.user_id, title=title
        )
        return ConversationResponse(**conv)
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    limit: Optional[int] = Query(default=None, ge=1, le=100),
    offset: Optional[int] = Query(default=None, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
) -> ConversationListResponse:
    """List the authenticated user's active conversations (paginated)."""
    effective_page_size = limit if limit is not None else page_size
    effective_page = (
        (offset // effective_page_size) + 1 if offset is not None else page
    )
    try:
        items, total = supabase_service.list_conversations(
            user_id=current_user.user_id,
            page=effective_page,
            page_size=effective_page_size,
        )
        return ConversationListResponse(
            conversations=[ConversationResponse(**c) for c in items],
            total=total,
            page=effective_page,
            page_size=effective_page_size,
        )
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> ConversationDetailResponse:
    """Fetch a single conversation owned by the current user along with its messages."""
    try:
        conv = supabase_service.get_conversation(
            user_id=current_user.user_id, conversation_id=conversation_id
        )
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        messages = supabase_service.get_conversation_messages(
            user_id=current_user.user_id, conversation_id=conversation_id
        )
        return ConversationDetailResponse(
            **conv,
            messages=[MessageResponse(**m) for m in messages],
        )
    except HTTPException:
        raise
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SendMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(AI_RATE_LIMIT)
async def send_message(
    request: Request,
    conversation_id: str,
    payload: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> SendMessageResponse:
    """Send a user message, run emergency screening + 10-step AI workflow, and persist both messages."""
    try:
        conv = supabase_service.get_conversation(
            user_id=current_user.user_id, conversation_id=conversation_id
        )
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        history = supabase_service.get_conversation_messages(
            user_id=current_user.user_id, conversation_id=conversation_id
        )
        user_profile = supabase_service.get_user_profile(current_user.user_id)

        logger.info(
            "Processing chat message for conversation_id=%s payload=%s",
            conversation_id,
            redact_for_logging(payload.content),
        )

        # Persist user message first
        user_msg = supabase_service.add_message(
            user_id=current_user.user_id,
            conversation_id=conversation_id,
            role="user",
            content=payload.content,
            metadata={
                "has_image": bool(payload.image_url),
                "language": payload.language or "en",
            },
            image_url=payload.image_url,
        )

        # Auto-title new conversations from the first user message
        updated_title: Optional[str] = conv.get("title")
        if conv.get("title") == "New Conversation" and not history:
            auto_title = payload.content[:60].strip()
            if len(payload.content) > 60:
                auto_title += "..."
            if auto_title:
                supabase_service.update_conversation_timestamp(
                    user_id=current_user.user_id,
                    conversation_id=conversation_id,
                    title=auto_title,
                )
                updated_title = auto_title

        # Run 10-step health query engine (deterministic emergency check runs BEFORE AI)
        result = health_query_engine.process_query(
            user_message=payload.content,
            conversation_history=history,
            user_profile=user_profile,
            image_url=payload.image_url,
            language=payload.language or "en",
        )

        assistant_metadata = result.to_metadata()
        assistant_metadata["language"] = payload.language or "en"
        assistant_msg = supabase_service.add_message(
            user_id=current_user.user_id,
            conversation_id=conversation_id,
            role="assistant",
            content=result.response_text,
            metadata=assistant_metadata,
        )

        return SendMessageResponse(
            user_message=MessageResponse(**user_msg),
            assistant_message=MessageResponse(**assistant_msg),
            emergency=result.emergency.to_dict(),
            metadata=assistant_metadata,
            conversation_title=updated_title,
        )
    except HTTPException:
        raise
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/conversations/{conversation_id}",
    response_model=MessageStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_conversation(
    conversation_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> MessageStatusResponse:
    """Soft-delete a conversation owned by the current user."""
    try:
        deleted = supabase_service.soft_delete_conversation(
            user_id=current_user.user_id, conversation_id=conversation_id
        )
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        return MessageStatusResponse(
            status="ok",
            message="Conversation deleted successfully.",
        )
    except HTTPException:
        raise
    except SupabaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
