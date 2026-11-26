"""Resilience tests: user-scoped RLS client fallback, CORS on 500 errors, auto-title, and error mapping."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.main import app
from app.middleware.auth import reset_request_access_token, set_request_access_token
from app.services.ai_service import AIResponse
from app.services.supabase_service import (
    SupabaseService,
    SupabaseServiceError,
    _map_supabase_exception,
)
from tests.conftest import TEST_USER_ID


class TestSupabaseUserScoping:
    def test_get_db_client_uses_user_jwt_when_service_role_missing(self, monkeypatch) -> None:
        monkeypatch.setattr("app.config.settings.SUPABASE_URL", "https://example.supabase.co")
        monkeypatch.setattr("app.config.settings.SUPABASE_ANON_KEY", "anon-key-test")
        monkeypatch.setattr("app.config.settings.SUPABASE_SERVICE_ROLE_KEY", "")

        svc = SupabaseService()
        token_ctx = set_request_access_token("user-jwt-abc")
        try:
            with patch("app.services.supabase_service.create_client") as mock_create:
                mock_create.return_value = MagicMock()
                svc._get_db_client()
                mock_create.assert_called_once()
                opts = mock_create.call_args.kwargs["options"]
                assert opts.headers["Authorization"] == "Bearer user-jwt-abc"
        finally:
            reset_request_access_token(token_ctx)

    def test_map_supabase_rls_and_auth_errors(self) -> None:
        rls_err = APIError({"code": "42501", "message": "new row violates row-level security policy"})
        mapped_rls = _map_supabase_exception(rls_err, "create_conversation")
        assert isinstance(mapped_rls, SupabaseServiceError)
        assert mapped_rls.status_code == 403

        jwt_err = APIError({"code": "PGRST301", "message": "JWT expired"})
        mapped_jwt = _map_supabase_exception(jwt_err, "get_conversation")
        assert mapped_jwt.status_code == 401

        dup_err = APIError({"code": "23505", "message": "duplicate key value"})
        mapped_dup = _map_supabase_exception(dup_err, "ensure_user_profile")
        assert mapped_dup.status_code == 409


class TestCorsAndUnhandledErrorShield:
    def test_cors_header_present_even_on_unhandled_500(self) -> None:
        app.dependency_overrides.clear()
        with TestClient(app, raise_server_exceptions=False) as tc:
            with patch(
                "app.services.voice_service.voice_service.get_status",
                side_effect=RuntimeError("unexpected boom"),
            ):
                resp = tc.get(
                    "/api/voice/status",
                    headers={"Origin": "https://ai-health-assistant-iota.vercel.app"},
                )
        assert resp.status_code == 500
        assert resp.headers.get("access-control-allow-origin") == "https://ai-health-assistant-iota.vercel.app"
        assert "status_code" in resp.json()


class TestChatAutoTitleForFrontendDefault:
    def test_auto_titles_new_health_consultation(self, authed_client: TestClient) -> None:
        now = datetime.now(timezone.utc).isoformat()
        conv_row = {
            "id": "33333333-3333-3333-3333-333333333333",
            "user_id": TEST_USER_ID,
            "title": "New Health Consultation",
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        fake_ai = AIResponse(
            text="### Understanding Your Concern\nRest and hydrate.\n\n---\n*This is not a medical diagnosis.*",
            interaction_id="inter_1",
        )
        engine = __import__(
            "app.services.health_query_engine", fromlist=["health_query_engine"]
        ).health_query_engine

        def fake_add(user_id, conversation_id, role, content, metadata=None, image_url=None):
            return {
                "id": f"m-{role}",
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "metadata": metadata or {},
                "image_url": image_url,
                "created_at": now,
            }

        with (
            patch("app.routers.chat.supabase_service.get_conversation", return_value=conv_row),
            patch("app.routers.chat.supabase_service.get_conversation_messages", return_value=[]),
            patch("app.routers.chat.supabase_service.get_user_profile", return_value=None),
            patch("app.routers.chat.supabase_service.add_message", side_effect=fake_add),
            patch("app.routers.chat.supabase_service.update_conversation_timestamp") as mock_title,
            patch.object(engine._ai, "generate_health_response", return_value=fake_ai),
        ):
            resp = authed_client.post(
                f"/api/chat/conversations/{conv_row['id']}/messages",
                json={"content": "Persistent sore throat since yesterday"},
            )

        assert resp.status_code == 201
        assert resp.json()["conversation_title"] == "Persistent sore throat since yesterday"
        mock_title.assert_called()
