"""Tests for authentication endpoints: register, login, logout, forgot-password, verify-email."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.services.supabase_service import SupabaseServiceError
from tests.conftest import TEST_USER_EMAIL, TEST_USER_ID


class TestAuthEndpoints:
    def test_register_success(self, client: TestClient) -> None:
        mock_result = {
            "access_token": "jwt-token-123",
            "refresh_token": "refresh-token-123",
            "expires_in": 3600,
            "user": {
                "id": TEST_USER_ID,
                "email": TEST_USER_EMAIL,
                "display_name": "Asha Patel",
                "email_verified": False,
            },
        }
        with patch("app.routers.auth.supabase_service.register_user", return_value=mock_result) as mock_reg:
            resp = client.post(
                "/api/auth/register",
                json={
                    "email": TEST_USER_EMAIL,
                    "password": "StrongPassword1!",
                    "display_name": "Asha Patel",
                },
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["access_token"] == "jwt-token-123"
        assert data["user"]["email"] == TEST_USER_EMAIL
        assert data["user"]["display_name"] == "Asha Patel"
        mock_reg.assert_called_once()

    def test_register_rejects_weak_password(self, client: TestClient) -> None:
        resp = client.post(
            "/api/auth/register",
            json={
                "email": TEST_USER_EMAIL,
                "password": "weak",
                "display_name": "Asha",
            },
        )
        assert resp.status_code == 422

    def test_register_rejects_invalid_email(self, client: TestClient) -> None:
        resp = client.post(
            "/api/auth/register",
            json={
                "email": "not-an-email",
                "password": "StrongPassword1!",
                "display_name": "Asha",
            },
        )
        assert resp.status_code == 422

    def test_login_success(self, client: TestClient) -> None:
        mock_result = {
            "access_token": "jwt-login-token",
            "refresh_token": "refresh-login-token",
            "expires_in": 3600,
            "user": {
                "id": TEST_USER_ID,
                "email": TEST_USER_EMAIL,
                "display_name": "Asha Patel",
                "email_verified": True,
            },
        }
        with patch("app.routers.auth.supabase_service.login_user", return_value=mock_result):
            resp = client.post(
                "/api/auth/login",
                json={"email": TEST_USER_EMAIL, "password": "StrongPassword1!"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"] == "jwt-login-token"
        assert body["token_type"] == "bearer"
        assert body["user"]["id"] == TEST_USER_ID

    def test_login_invalid_credentials(self, client: TestClient) -> None:
        with patch(
            "app.routers.auth.supabase_service.login_user",
            side_effect=SupabaseServiceError("Invalid email or password.", status_code=401),
        ):
            resp = client.post(
                "/api/auth/login",
                json={"email": TEST_USER_EMAIL, "password": "WrongPassword1!"},
            )

        assert resp.status_code == 401
        assert "Invalid email or password" in resp.json()["detail"]

    def test_logout_requires_auth(self, client: TestClient) -> None:
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 401

    def test_logout_success(self, authed_client: TestClient) -> None:
        with patch("app.routers.auth.supabase_service.logout_user") as mock_logout:
            resp = authed_client.post("/api/auth/logout")

        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        mock_logout.assert_called_once_with("mock-access-token")

    def test_forgot_password_always_returns_generic_ok(self, client: TestClient) -> None:
        with patch("app.routers.auth.supabase_service.send_password_reset") as mock_reset:
            resp = client.post(
                "/api/auth/forgot-password",
                json={"email": TEST_USER_EMAIL},
            )

        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        mock_reset.assert_called_once_with(TEST_USER_EMAIL)

    def test_verify_email_success(self, client: TestClient) -> None:
        with patch(
            "app.routers.auth.supabase_service.verify_email_token",
            return_value={"verified": True, "user_id": TEST_USER_ID, "email": TEST_USER_EMAIL},
        ):
            resp = client.get("/api/auth/verify-email", params={"token": "valid-token-123456"})

        assert resp.status_code == 200
        assert "verified" in resp.json()["message"].lower()

    def test_verify_email_invalid_token(self, client: TestClient) -> None:
        with patch(
            "app.routers.auth.supabase_service.verify_email_token",
            side_effect=SupabaseServiceError("Invalid or expired verification token.", status_code=400),
        ):
            resp = client.get("/api/auth/verify-email", params={"token": "expired-token-123"})

        assert resp.status_code == 400
