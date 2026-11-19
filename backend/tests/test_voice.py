"""Tests for Voice Service and Voice API endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.voice_service import (
    RECOMMENDED_VOICES,
    VoiceService,
    VoiceServiceError,
    sanitize_text_for_speech,
)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_sanitize_text_for_speech():
    """Verify markdown symbols, links, headers, and bullet points are stripped for smooth speech."""
    raw = (
        "# Medical Guidance\n\n"
        "Here are **important** instructions:\n"
        "- First step is to rest.\n"
        "- Visit [Health Portal](https://example.com/health) for details.\n\n"
        "> [!CAUTION]\n"
        "> Do not ignore chest pain.\n\n"
        "```python\nprint('code')\n```\n"
        "Use `paracetamol` if prescribed."
    )
    sanitized = sanitize_text_for_speech(raw)

    assert "#" not in sanitized
    assert "**" not in sanitized
    assert "[Health Portal]" not in sanitized
    assert "Health Portal" in sanitized
    assert "https://" not in sanitized
    assert "[!CAUTION]" not in sanitized
    assert "print('code')" not in sanitized
    assert "paracetamol" in sanitized
    assert "\n" not in sanitized


def test_voice_status_endpoint(client: TestClient):
    """GET /api/voice/status returns provider info and readiness."""
    res = client.get("/api/voice/status")
    assert res.status_code == 200
    data = res.json()
    assert "provider" in data
    assert "enabled" in data
    assert "ready" in data
    assert "recommended_voices" in data
    assert len(data["recommended_voices"]) > 0


def test_voice_voices_endpoint(client: TestClient):
    """GET /api/voice/voices returns recommended healthcare voices."""
    res = client.get("/api/voice/voices")
    assert res.status_code == 200
    data = res.json()
    assert "voices" in data
    assert "active_provider" in data
    assert any(v["id"] == "21m00Tcm4TlvDq8ikWAM" for v in data["voices"])


@pytest.mark.asyncio
async def test_synthesize_without_key_raises_error(monkeypatch):
    """Attempting synthesis without an API key raises VoiceServiceError with api_key_missing."""
    service = VoiceService()
    monkeypatch.setattr("app.config.settings.ELEVENLABS_API_KEY", "")
    monkeypatch.setattr("app.config.settings.VOICE_PROVIDER", "elevenlabs")

    with pytest.raises(VoiceServiceError) as exc_info:
        await service.synthesize("Please drink plenty of water and rest.", provider="elevenlabs")

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail_code == "api_key_missing"


@pytest.mark.asyncio
async def test_synthesize_empty_text():
    """Attempting synthesis with blank text raises 400."""
    service = VoiceService()
    with pytest.raises(VoiceServiceError) as exc_info:
        await service.synthesize("   ")

    assert exc_info.value.status_code == 400


def test_synthesize_endpoint_fallback_without_key(client: TestClient, monkeypatch):
    """POST /api/voice/synthesize returns 503 with fallback guidance when key is not configured."""
    monkeypatch.setattr("app.config.settings.ELEVENLABS_API_KEY", "")
    monkeypatch.setattr("app.config.settings.VOICE_PROVIDER", "elevenlabs")

    res = client.post("/api/voice/synthesize", json={"text": "Stay hydrated and monitor your pulse."})
    assert res.status_code == 503
    detail = res.json()["detail"]
    assert detail["code"] == "api_key_missing"
    assert detail["fallback"] == "browser_speech"
