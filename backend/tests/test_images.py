"""Tests for image validation (magic bytes, size, resizing) and upload/analyze endpoints."""

import io
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.services.image_service import ImageService, ImageServiceError
from app.utils.validators import detect_image_mime_from_magic_bytes, validate_image_file


def _make_image_bytes(
    fmt: str = "PNG", size: tuple[int, int] = (200, 200), color: tuple[int, int, int] = (120, 140, 160)
) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=fmt)
    return buf.getvalue()


class TestImageValidation:
    @pytest.mark.parametrize(
        "pil_fmt,expected_mime,filename",
        [
            ("JPEG", "image/jpeg", "rash.jpg"),
            ("PNG", "image/png", "skin.png"),
            ("WEBP", "image/webp", "mole.webp"),
        ],
    )
    def test_accepts_valid_jpg_png_webp(
        self, pil_fmt: str, expected_mime: str, filename: str
    ) -> None:
        raw = _make_image_bytes(fmt=pil_fmt)
        assert detect_image_mime_from_magic_bytes(raw) == expected_mime
        res = validate_image_file(
            data=raw, filename=filename, declared_content_type=expected_mime
        )
        assert res.is_valid is True
        assert res.detected_mime == expected_mime

    def test_rejects_spoofed_text_file_with_jpg_extension(self) -> None:
        fake_bytes = b"This is actually plain text pretending to be a JPEG!"
        res = validate_image_file(
            data=fake_bytes, filename="evil.jpg", declared_content_type="image/jpeg"
        )
        assert res.is_valid is False
        assert "unsupported" in (res.error or "").lower()

    def test_rejects_oversized_image(self) -> None:
        raw = _make_image_bytes(fmt="PNG")
        res = validate_image_file(
            data=raw,
            filename="big.png",
            declared_content_type="image/png",
            max_size_bytes=50,
        )
        assert res.is_valid is False
        assert "exceeds" in (res.error or "").lower()

    def test_rejects_empty_file(self) -> None:
        res = validate_image_file(data=b"", filename="empty.png", declared_content_type="image/png")
        assert res.is_valid is False
        assert "empty" in (res.error or "").lower()

    def test_rejects_mismatched_extension_and_magic_bytes(self) -> None:
        png_bytes = _make_image_bytes(fmt="PNG")
        res = validate_image_file(
            data=png_bytes, filename="wrong.jpg", declared_content_type="image/png"
        )
        assert res.is_valid is False
        assert "extension" in (res.error or "").lower()

    def test_resizes_image_exceeding_max_dimension(self) -> None:
        large_img = _make_image_bytes(fmt="JPEG", size=(600, 300))
        service = ImageService()
        processed = service.validate_and_prepare_image(
            raw_bytes=large_img,
            filename="large.jpg",
            declared_content_type="image/jpeg",
            max_dimension=256,
        )
        assert processed.was_resized is True
        assert processed.width <= 256
        assert processed.height <= 256

    def test_corrupted_image_raises_image_service_error(self) -> None:
        # Valid PNG header followed by garbage
        corrupted = b"\x89PNG\r\n\x1a\n" + b"corrupted-not-valid-chunks" * 5
        service = ImageService()
        with pytest.raises(ImageServiceError):
            service.validate_and_prepare_image(corrupted, filename="broken.png")


class TestImageUploadEndpoint:
    def test_upload_valid_png(self, authed_client: TestClient) -> None:
        png_bytes = _make_image_bytes(fmt="PNG")
        with patch(
            "app.services.image_service.default_supabase.upload_file",
            return_value="https://storage.example.com/health-images/test.png",
        ), patch.object(
            __import__("app.services.image_service", fromlist=["image_service"]).image_service._supabase,
            "upload_file",
            return_value="https://storage.example.com/health-images/test.png",
        ):
            resp = authed_client.post(
                "/api/images/upload",
                files={"file": ("rash.png", png_bytes, "image/png")},
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["content_type"] == "image/png"
        assert body["image_url"] == "https://storage.example.com/health-images/test.png"
        assert body["width"] == 200
        assert body["height"] == 200

    def test_upload_rejects_invalid_file_type(self, authed_client: TestClient) -> None:
        resp = authed_client.post(
            "/api/images/upload",
            files={"file": ("script.jpg", b"<script>alert(1)</script>", "image/jpeg")},
        )
        assert resp.status_code == 400
