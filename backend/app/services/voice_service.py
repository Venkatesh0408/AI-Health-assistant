"""Voice service for AI Health Monitor.

Provides text-to-speech synthesis using ElevenLabs, OpenAI, or browser fallback.
Includes text sanitization for spoken voice, audio caching, and quota protection.
"""

import hashlib
import logging
import re
from typing import Dict, List, Optional, Tuple

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Recommended voice library for healthcare assistance
RECOMMENDED_VOICES = [
    {
        "id": "21m00Tcm4TlvDq8ikWAM",
        "name": "Rachel (Calm & Reassuring)",
        "provider": "elevenlabs",
        "gender": "female",
        "description": "Warm, articulate, ideal for healthcare advice and empathy.",
    },
    {
        "id": "AZnzlk1XvdvUeBnXmlld",
        "name": "Domi (Friendly & Clear)",
        "provider": "elevenlabs",
        "gender": "female",
        "description": "Energetic and crisp, excellent for instructions.",
    },
    {
        "id": "pNInz6obpgDQGcFmaJgB",
        "name": "Adam (Professional & Grounded)",
        "provider": "elevenlabs",
        "gender": "male",
        "description": "Deep, calm, and reassuring clinician tone.",
    },
    {
        "id": "alloy",
        "name": "Alloy (Neutral & Balanced)",
        "provider": "openai",
        "gender": "neutral",
        "description": "Direct, versatile OpenAI standard voice.",
    },
    {
        "id": "nova",
        "name": "Nova (Warm & Friendly)",
        "provider": "openai",
        "gender": "female",
        "description": "Conversational, approachable guidance tone.",
    },
]


def sanitize_text_for_speech(text: str) -> str:
    """Strip markdown formatting, URLs, and code tokens for natural speech flow."""
    if not text:
        return ""

    # Remove code blocks
    cleaned = re.sub(r"```[\s\S]*?```", "", text)
    # Strip inline code backticks keeping the text
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    # Remove markdown links: [text](url) -> text
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    # Remove bare URLs
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    # Remove markdown headers (#, ##, ###)
    cleaned = re.sub(r"^#+\s*", "", cleaned, flags=re.MULTILINE)
    # Remove bullet points and asterisks
    cleaned = re.sub(r"^\s*[-*•]\s*", "", cleaned, flags=re.MULTILINE)
    # Remove bold / italic markers (**text**, *text*, __text__, _text_)
    cleaned = re.sub(r"(\*\*|__)(.*?)\1", r"\2", cleaned)
    cleaned = re.sub(r"(\*|_)(.*?)\1", r"\2", cleaned)
    # Remove blockquote markers
    cleaned = re.sub(r"^\s*>\s*(\[!CAUTION\]|\[!WARNING\]|\[!NOTE\]|\[!TIP\])?", "", cleaned, flags=re.MULTILINE)
    # Collapse multiple whitespace and newlines
    cleaned = re.sub(r"\n+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned


class VoiceServiceError(Exception):
    """Base exception for voice service errors."""

    def __init__(self, message: str, status_code: int = 500, detail_code: str = "voice_error"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail_code = detail_code


class VoiceService:
    """Synthesizes text into high-fidelity speech audio."""

    def __init__(self):
        # In-memory cache: md5(key) -> (audio_bytes, content_type)
        self._cache: Dict[str, Tuple[bytes, str]] = {}
        self._max_cache_entries = 100

    def get_status(self) -> dict:
        """Return current voice provider configuration and readiness."""
        provider = settings.VOICE_PROVIDER.lower().strip()
        has_elevenlabs_key = bool(settings.ELEVENLABS_API_KEY.strip())
        has_openai_key = bool(settings.OPENAI_API_KEY.strip())

        active_provider = provider
        ready = False

        if provider == "elevenlabs":
            ready = has_elevenlabs_key
        elif provider == "openai":
            ready = has_openai_key
        elif provider == "auto":
            if has_elevenlabs_key:
                active_provider = "elevenlabs"
                ready = True
            elif has_openai_key:
                active_provider = "openai"
                ready = True
            else:
                active_provider = "web_speech"
                ready = False
        else:
            ready = True  # web_speech client fallback

        return {
            "enabled": settings.VOICE_ENABLED,
            "provider": active_provider,
            "ready": ready,
            "has_elevenlabs_key": has_elevenlabs_key,
            "has_openai_key": has_openai_key,
            "voice_id": settings.ELEVENLABS_VOICE_ID if active_provider == "elevenlabs" else settings.OPENAI_VOICE,
            "model_id": settings.ELEVENLABS_MODEL_ID,
            "recommended_voices": RECOMMENDED_VOICES,
        }

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        provider: Optional[str] = None,
    ) -> Tuple[bytes, str]:
        """Synthesize clean text into speech audio bytes.

        Returns:
            Tuple of (audio_bytes, media_type) e.g. (b"...", "audio/mpeg")
        """
        if not settings.VOICE_ENABLED:
            raise VoiceServiceError("Voice synthesis is currently disabled.", status_code=503, detail_code="voice_disabled")

        clean_text = sanitize_text_for_speech(text)
        if not clean_text:
            raise VoiceServiceError("No speakable text provided.", status_code=400, detail_code="empty_text")

        # Limit length to 4,000 characters to prevent massive billing spikes
        if len(clean_text) > 4000:
            clean_text = clean_text[:4000]

        target_provider = (provider or settings.VOICE_PROVIDER).lower().strip()

        # If set to auto, resolve to available provider
        if target_provider == "auto":
            if settings.ELEVENLABS_API_KEY.strip():
                target_provider = "elevenlabs"
            elif settings.OPENAI_API_KEY.strip():
                target_provider = "openai"
            else:
                target_provider = "elevenlabs"

        target_voice_id = voice_id or (
            settings.ELEVENLABS_VOICE_ID if target_provider == "elevenlabs" else settings.OPENAI_VOICE
        )

        # Cache check
        cache_key = hashlib.md5(f"{target_provider}:{target_voice_id}:{clean_text}".encode("utf-8")).hexdigest()
        if cache_key in self._cache:
            logger.info("Serving voice audio from cache (key=%s)", cache_key[:8])
            return self._cache[cache_key]

        # Dispatch synthesis
        if target_provider == "elevenlabs":
            audio_bytes, media_type = await self._synthesize_elevenlabs(clean_text, target_voice_id)
        elif target_provider == "openai":
            audio_bytes, media_type = await self._synthesize_openai(clean_text, target_voice_id)
        else:
            raise VoiceServiceError(
                f"Unsupported voice provider: {target_provider}",
                status_code=400,
                detail_code="invalid_provider",
            )

        # Store in LRU-like cache
        if len(self._cache) >= self._max_cache_entries:
            # Drop an arbitrary key
            self._cache.pop(next(iter(self._cache)))
        self._cache[cache_key] = (audio_bytes, media_type)

        return audio_bytes, media_type

    async def _synthesize_elevenlabs(self, text: str, voice_id: str) -> Tuple[bytes, str]:
        """Call ElevenLabs Text-to-Speech REST API."""
        api_key = settings.ELEVENLABS_API_KEY.strip()
        if not api_key:
            raise VoiceServiceError(
                "ELEVENLABS_API_KEY is not configured in backend/.env. Please add your key to enable voice synthesis.",
                status_code=503,
                detail_code="api_key_missing",
            )

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": text,
            "model_id": settings.ELEVENLABS_MODEL_ID or "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)

                if response.status_code == 401:
                    raise VoiceServiceError(
                        "Invalid ElevenLabs API key. Please check your ELEVENLABS_API_KEY in backend/.env.",
                        status_code=401,
                        detail_code="invalid_api_key",
                    )
                if response.status_code == 429:
                    raise VoiceServiceError(
                        "ElevenLabs quota or rate limit exceeded. Please check your account usage.",
                        status_code=429,
                        detail_code="quota_exceeded",
                    )
                if response.is_error:
                    error_detail = response.text[:300]
                    logger.error("ElevenLabs API error: %s - %s", response.status_code, error_detail)
                    raise VoiceServiceError(
                        f"ElevenLabs TTS service returned error ({response.status_code}).",
                        status_code=response.status_code,
                        detail_code="provider_error",
                    )

                return response.content, "audio/mpeg"
        except httpx.TimeoutException as exc:
            logger.error("ElevenLabs synthesis timed out: %s", exc)
            raise VoiceServiceError("Voice synthesis timed out. Please try again.", status_code=504, detail_code="timeout") from exc
        except httpx.RequestError as exc:
            logger.error("Network error reaching ElevenLabs: %s", exc)
            raise VoiceServiceError("Failed to reach ElevenLabs voice API.", status_code=502, detail_code="network_error") from exc

    async def _synthesize_openai(self, text: str, voice_id: str) -> Tuple[bytes, str]:
        """Call OpenAI Audio Speech REST API."""
        api_key = settings.OPENAI_API_KEY.strip()
        if not api_key:
            raise VoiceServiceError(
                "OPENAI_API_KEY is not configured in backend/.env. Please add your key to enable OpenAI voice synthesis.",
                status_code=503,
                detail_code="api_key_missing",
            )

        url = "https://api.openai.com/v1/audio/speech"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "tts-1",
            "input": text,
            "voice": voice_id or settings.OPENAI_VOICE or "alloy",
            "response_format": "mp3",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)

                if response.status_code == 401:
                    raise VoiceServiceError(
                        "Invalid OpenAI API key. Please check your OPENAI_API_KEY in backend/.env.",
                        status_code=401,
                        detail_code="invalid_api_key",
                    )
                if response.is_error:
                    logger.error("OpenAI TTS error: %s - %s", response.status_code, response.text[:300])
                    raise VoiceServiceError(
                        f"OpenAI TTS service returned error ({response.status_code}).",
                        status_code=response.status_code,
                        detail_code="provider_error",
                    )

                return response.content, "audio/mpeg"
        except httpx.TimeoutException as exc:
            raise VoiceServiceError("Voice synthesis timed out.", status_code=504, detail_code="timeout") from exc
        except httpx.RequestError as exc:
            raise VoiceServiceError("Failed to reach OpenAI audio API.", status_code=502, detail_code="network_error") from exc


# Global singleton instance
voice_service = VoiceService()
