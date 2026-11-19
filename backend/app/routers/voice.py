"""Voice API router: audio synthesis and voice persona configuration."""

import logging
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from app.middleware.rate_limit import AI_RATE_LIMIT, limiter
from app.services.voice_service import VoiceServiceError, voice_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice"])


class SynthesizeRequest(BaseModel):
    """Payload to synthesize speech audio from text."""

    text: str = Field(..., min_length=1, max_length=5000, description="Text to speak aloud")
    voice_id: Optional[str] = Field(default=None, description="Optional custom voice ID")
    provider: Optional[str] = Field(default=None, description="Optional voice provider override")


@router.get("/status")
async def get_voice_status() -> dict:
    """Check whether voice AI is configured, active provider, and voice IDs."""
    return voice_service.get_status()


@router.get("/voices")
async def list_recommended_voices() -> dict:
    """List recommended clinician & healthcare guidance voice personas."""
    status_info = voice_service.get_status()
    return {
        "active_provider": status_info["provider"],
        "active_voice_id": status_info["voice_id"],
        "voices": status_info["recommended_voices"],
    }


@router.post("/synthesize")
@limiter.limit(AI_RATE_LIMIT)
async def synthesize_speech(
    request: Request,
    payload: SynthesizeRequest = Body(...),
) -> Response:
    """Synthesize text into human-like audio speech (MP3).

    Returns audio/mpeg binary stream for immediate browser playback.
    """
    try:
        audio_bytes, media_type = await voice_service.synthesize(
            text=payload.text,
            voice_id=payload.voice_id,
            provider=payload.provider,
        )
        return Response(
            content=audio_bytes,
            media_type=media_type,
            headers={
                "Content-Type": media_type,
                "Content-Length": str(len(audio_bytes)),
                "Cache-Control": "public, max-age=86400",
            },
        )
    except VoiceServiceError as exc:
        logger.warning("Voice synthesis error (%s): %s", exc.detail_code, exc.message)
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "code": exc.detail_code,
                "fallback": "browser_speech",
            },
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in voice synthesis: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Internal error generating speech.",
                "code": "internal_error",
                "fallback": "browser_speech",
            },
        ) from exc
