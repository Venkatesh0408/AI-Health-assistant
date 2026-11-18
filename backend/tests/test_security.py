"""Security & privacy tests: auth enforcement, user isolation, XSS sanitization, input limits."""

from unittest.mock import patch

import pytest

from app.models.report import DateRange
from app.utils.sanitizers import redact_for_logging, sanitize_text


class TestAuthenticationEnforcement:
    """Protected endpoints must reject unauthenticated requests."""

    @pytest.mark.parametrize(
        "method,path",
        [
            ("GET", "/api/users/profile"),
            ("PUT", "/api/users/profile"),
            ("DELETE", "/api/users/account"),
            ("GET", "/api/users/export"),
            ("GET", "/api/privacy/settings"),
            ("PUT", "/api/privacy/settings"),
            ("GET", "/api/chat/conversations"),
            ("POST", "/api/chat/conversations"),
            ("GET", "/api/health/records"),
            ("GET", "/api/health/summary"),
            ("GET", "/api/images/analyses"),
            ("GET", "/api/reports"),
        ],
    )
    def test_protected_routes_require_bearer_token(self, client, method, path):
        resp = client.request(method, path)
        assert resp.status_code in (401, 403), f"{method} {path} returned {resp.status_code}"

    def test_invalid_bearer_token_rejected(self, client):
        resp = client.get(
            "/api/users/profile",
            headers={"Authorization": "Bearer not-a-valid-jwt-token"},
        )
        assert resp.status_code == 401


class TestUserDataIsolation:
    """A user must never be able to read or delete another user's resources."""

    def test_cannot_access_other_users_conversation(self, authed_client):
        with patch("app.routers.chat.supabase_service.get_conversation", return_value=None):
            resp = authed_client.get("/api/chat/conversations/other-user-conv-id")
        assert resp.status_code == 404

    def test_cannot_delete_other_users_conversation(self, authed_client):
        with patch("app.routers.chat.supabase_service.soft_delete_conversation", return_value=False):
            resp = authed_client.delete("/api/chat/conversations/other-user-conv-id")
        assert resp.status_code == 404

    def test_cannot_download_other_users_report(self, authed_client):
        with patch("app.routers.reports.supabase_service.get_health_report", return_value=None):
            resp = authed_client.get("/api/reports/other-user-report-id/download")
        assert resp.status_code == 404


class TestInputValidationAndSanitization:
    """Verify XSS stripping, length limits, log redaction, and DateRange aliases."""

    def test_xss_tags_stripped_from_input(self):
        dirty = "<script>alert('xss')</script>I have a <b>headache</b>"
        clean = sanitize_text(dirty)
        assert "<script>" not in clean
        assert "<b>" not in clean
        assert "headache" in clean

    def test_oversized_chat_message_rejected(self, authed_client):
        too_long = "a" * 5001
        resp = authed_client.post(
            "/api/chat/conversations/22222222-2222-2222-2222-222222222222/messages",
            json={"content": too_long},
        )
        assert resp.status_code == 422

    def test_redact_for_logging_never_leaks_health_text(self):
        secret_symptom = "Severe migraine and blood pressure 160/100"
        redacted = redact_for_logging(secret_symptom)
        assert "migraine" not in redacted
        assert "160/100" not in redacted
        assert "redacted" in redacted

    def test_date_range_accepts_both_alias_conventions(self):
        dr1 = DateRange(start="2026-01-01", end="2026-01-31")
        dr2 = DateRange(start_date="2026-01-01", end_date="2026-01-31")
        assert dr1.start_date == dr2.start_date
        assert dr1.end_date == dr2.end_date

    def test_date_range_rejects_inverted_dates(self):
        with pytest.raises(ValueError):
            DateRange(start_date="2026-02-01", end_date="2026-01-01")


class TestSecurityHeaders:
    """Confirm hardened HTTP security headers are attached to responses."""

    def test_security_headers_present(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("x-frame-options") == "DENY"
        assert "referrer-policy" in resp.headers
