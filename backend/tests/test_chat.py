"""Tests for chat conversation lifecycle, message persistence, and AI workflow integration."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.services.ai_service import AIResponse
from tests.conftest import TEST_USER_ID

CONV_ID = "22222222-2222-2222-2222-222222222222"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TestChatFlow:
    def test_health_check_and_security_headers(self, client: TestClient) -> None:
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "DENY"

    def test_create_and_list_conversations(self, authed_client: TestClient) -> None:
        now = _now_iso()
        conv_row = {
            "id": CONV_ID,
            "user_id": TEST_USER_ID,
            "title": "Headache check",
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }

        with patch(
            "app.routers.chat.supabase_service.create_conversation",
            return_value=conv_row,
        ) as mock_create:
            create_resp = authed_client.post(
                "/api/chat/conversations", json={"title": "Headache check"}
            )

        assert create_resp.status_code == 201
        assert create_resp.json()["id"] == CONV_ID
        mock_create.assert_called_once_with(user_id=TEST_USER_ID, title="Headache check")

        with patch(
            "app.routers.chat.supabase_service.list_conversations",
            return_value=([conv_row], 1),
        ):
            list_resp = authed_client.get("/api/chat/conversations?page=1&page_size=20")

        assert list_resp.status_code == 200
        data = list_resp.json()
        assert data["total"] == 1
        assert len(data["conversations"]) == 1
        assert data["conversations"][0]["title"] == "Headache check"

    def test_send_message_persists_user_and_ai_messages(
        self, authed_client: TestClient
    ) -> None:
        now = _now_iso()
        conv_row = {
            "id": CONV_ID,
            "user_id": TEST_USER_ID,
            "title": "New Conversation",
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        persisted_messages: list[dict] = []

        def fake_add_message(
            user_id: str,
            conversation_id: str,
            role: str,
            content: str,
            metadata=None,
            image_url=None,
        ) -> dict:
            msg = {
                "id": f"msg-{len(persisted_messages) + 1}",
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "metadata": metadata or {},
                "image_url": image_url,
                "created_at": now,
            }
            persisted_messages.append(msg)
            return msg

        fake_ai = AIResponse(
            text=(
                "### Understanding Your Concern\n"
                "You mentioned having a mild headache for two days.\n\n"
                "### Possible Explanations\n"
                "This may be related to tension, dehydration, or eye strain.\n\n"
                "### When to See a Doctor\n"
                "Consult a healthcare professional if it persists or worsens."
            ),
            interaction_id="inter_abc123",
            model="gemini-4-hydrogen",
        )

        with (
            patch("app.routers.chat.supabase_service.get_conversation", return_value=conv_row),
            patch("app.routers.chat.supabase_service.get_conversation_messages", return_value=[]),
            patch("app.routers.chat.supabase_service.get_user_profile", return_value=None),
            patch("app.routers.chat.supabase_service.add_message", side_effect=fake_add_message),
            patch("app.routers.chat.supabase_service.update_conversation_timestamp"),
            patch("app.services.health_query_engine.default_ai_service.generate_health_response", return_value=fake_ai),
            patch.object(
                __import__("app.services.health_query_engine", fromlist=["health_query_engine"]).health_query_engine._ai,
                "generate_health_response",
                return_value=fake_ai,
            ),
        ):
            resp = authed_client.post(
                f"/api/chat/conversations/{CONV_ID}/messages",
                json={"content": "I have had a mild headache for 2 days after working long hours."},
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["emergency"]["is_emergency"] is False
        assert body["user_message"]["role"] == "user"
        assert body["assistant_message"]["role"] == "assistant"
        assert "not a medical diagnosis" in body["assistant_message"]["content"].lower()
        assert body["metadata"]["interaction_id"] == "inter_abc123"
        assert "headache" in body["metadata"]["detected_symptoms"]
        assert len(persisted_messages) == 2

    def test_emergency_message_short_circuits_before_ai(
        self, authed_client: TestClient
    ) -> None:
        now = _now_iso()
        conv_row = {
            "id": CONV_ID,
            "user_id": TEST_USER_ID,
            "title": "Urgent",
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        ai_mock = MagicMock()

        def fake_add_message(
            user_id: str, conversation_id: str, role: str, content: str, metadata=None, image_url=None
        ) -> dict:
            return {
                "id": f"msg-{role}",
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "metadata": metadata or {},
                "image_url": image_url,
                "created_at": now,
            }

        engine = __import__("app.services.health_query_engine", fromlist=["health_query_engine"]).health_query_engine
        with (
            patch("app.routers.chat.supabase_service.get_conversation", return_value=conv_row),
            patch("app.routers.chat.supabase_service.get_conversation_messages", return_value=[]),
            patch("app.routers.chat.supabase_service.get_user_profile", return_value=None),
            patch("app.routers.chat.supabase_service.add_message", side_effect=fake_add_message),
            patch.object(engine._ai, "generate_health_response", ai_mock),
        ):
            resp = authed_client.post(
                f"/api/chat/conversations/{CONV_ID}/messages",
                json={"content": "I have crushing chest pain radiating to my left arm!"},
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["emergency"]["is_emergency"] is True
        assert body["emergency"]["category"] == "cardiac"
        assert "112" in body["assistant_message"]["content"]
        # Deterministic emergency detector must bypass AI call completely
        ai_mock.assert_not_called()

    def test_soft_delete_conversation(self, authed_client: TestClient) -> None:
        with patch(
            "app.routers.chat.supabase_service.soft_delete_conversation",
            return_value=True,
        ) as mock_del:
            resp = authed_client.delete(f"/api/chat/conversations/{CONV_ID}")

        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        mock_del.assert_called_once_with(user_id=TEST_USER_ID, conversation_id=CONV_ID)
