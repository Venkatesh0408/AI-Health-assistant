"""Shared pytest fixtures for backend unit and integration tests."""

import os
import sys
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient

# Ensure backend root is importable
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from app.main import app  # noqa: E402
from app.middleware.auth import CurrentUser, get_current_user  # noqa: E402

TEST_USER_ID = "11111111-1111-1111-1111-111111111111"
TEST_USER_EMAIL = "patient@example.com"


@pytest.fixture()
def test_user() -> CurrentUser:
    """Return a mock authenticated CurrentUser."""
    return CurrentUser(
        user_id=TEST_USER_ID,
        email=TEST_USER_EMAIL,
        role="authenticated",
        access_token="mock-access-token",
    )


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    """Return an unauthenticated FastAPI TestClient."""
    app.dependency_overrides.clear()
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


@pytest.fixture()
def authed_client(test_user: CurrentUser) -> Generator[TestClient, None, None]:
    """Return an authenticated FastAPI TestClient with get_current_user overridden."""
    app.dependency_overrides[get_current_user] = lambda: test_user
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()
