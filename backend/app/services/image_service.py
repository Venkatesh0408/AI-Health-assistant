"""Image validation, resizing, storage upload, and multimodal AI analysis service."""

import io
import logging
import uuid
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from PIL import Image, ImageStat, UnidentifiedImageError

from app.config import settings
from app.services.ai_service import AIService, ai_service as default_ai_service
from app.services.emergency_service import screen_for_emergency
from app.services.prompt_builder import prompt_builder
from app.services.supabase_service import SupabaseService, supabase_service as default_supabase
from app.utils.safety import (
    MEDICAL_DISCLAIMER,
    detect_prompt_injection,
    ensure_medical_disclaimer,
    validate_response_safety,
)
from app.utils.sanitizers import sanitize_filename, sanitize_text
from app.utils.validators import ImageValidationResult, validate_image_file

logger = logging.getLogger(__name__)

_MIME_TO_PIL_FORMAT = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}

_MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class ImageServiceError(Exception):
    """Domain error for image validation or processing failures."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class ProcessedImage:
    """Validated and (if necessary) resized image payload ready for storage or AI."""

    data: bytes
    content_type: str
    width: int
    height: int
    was_resized: bool = False
    quality_warning: Optional[str] = None


class ImageService:
    """Handles image upload validation, resizing, storage, and safe multimodal analysis."""

    def __init__(
        self,
        ai_service: Optional[AIService] = None,
        supabase_service: Optional[SupabaseService] = None,
    ) -> None:
        self._ai = ai_service or default_ai_service
        self._supabase = supabase_service or default_supabase

    def validate_and_prepare_image(
        self,
        raw_bytes: bytes,
        filename: Optional[str] = None,
        declared_content_type: Optional[str] = None,
        max_dimension: Optional[int] = None,
    ) -> ProcessedImage:
        """Validate magic bytes, size, and Pillow decodability; resize if > max_dimension."""
        validation: ImageValidationResult = validate_image_file(
            data=raw_bytes,
            filename=filename,
            declared_content_type=declared_content_type,
        )
        if not validation.is_valid or not validation.detected_mime:
            raise ImageServiceError(validation.error or "Invalid image file.", status_code=400)

        max_dim = max_dimension or settings.MAX_IMAGE_DIMENSION or 4096

        try:
            with Image.open(io.BytesIO(raw_bytes)) as img:
                img.verify()
            with Image.open(io.BytesIO(raw_bytes)) as img:
                img.load()
                width, height = img.size
                quality_warning = self._assess_image_quality(img)
                was_resized = False
                output_bytes = raw_bytes

                if width > max_dim or height > max_dim:
                    img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                    width, height = img.size
                    was_resized = True

                    pil_format = _MIME_TO_PIL_FORMAT.get(validation.detected_mime, "JPEG")
                    if pil_format == "JPEG" and img.mode in ("RGBA", "P", "LA"):
                        img = img.convert("RGB")

                    buf = io.BytesIO()
                    save_kwargs: dict[str, Any] = {}
                    if pil_format in ("JPEG", "WEBP"):
                        save_kwargs["quality"] = 90
                    img.save(buf, format=pil_format, **save_kwargs)
                    output_bytes = buf.getvalue()

                return ProcessedImage(
                    data=output_bytes,
                    content_type=validation.detected_mime,
                    width=width,
                    height=height,
                    was_resized=was_resized,
                    quality_warning=quality_warning,
                )
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise ImageServiceError(
                "Could not decode image file. Please upload a valid JPG, PNG, or WebP image.",
                status_code=400,
            ) from exc

    @staticmethod
    def _assess_image_quality(img: Image.Image) -> Optional[str]:
        """Detect very low resolution or extremely dark/overexposed images."""
        width, height = img.size
        if width < 100 or height < 100:
            return "The uploaded image has very low resolution, which limits visual clarity."
        try:
            gray = img.convert("L")
            mean_brightness = ImageStat.Stat(gray).mean[0]
            if mean_brightness < 25:
                return "The uploaded image appears very dark, which may limit visual assessment."
            if mean_brightness > 245:
                return "The uploaded image appears heavily overexposed, which may obscure details."
        except Exception:
            return None
        return None

    def upload_user_image(
        self,
        user_id: str,
        raw_bytes: bytes,
        filename: Optional[str] = None,
        declared_content_type: Optional[str] = None,
    ) -> dict[str, Any]:
        """Validate, resize if needed, and upload image to Supabase Storage under user_id/."""
        processed = self.validate_and_prepare_image(
            raw_bytes=raw_bytes,
            filename=filename,
            declared_content_type=declared_content_type,
        )

        ext = _MIME_TO_EXT.get(processed.content_type, ".jpg")
        safe_base = sanitize_filename(filename or f"image{ext}", max_length=60)
        if not safe_base.lower().endswith(ext):
            safe_base = f"{safe_base.rsplit('.', 1)[0]}{ext}"
        storage_path = f"{user_id}/{uuid.uuid4().hex}_{safe_base}"

        image_url = self._supabase.upload_file(
            bucket=settings.SUPABASE_IMAGES_BUCKET,
            storage_path=storage_path,
            file_bytes=processed.data,
            content_type=processed.content_type,
        )

        return {
            "image_url": image_url,
            "image_path": storage_path,
            "content_type": processed.content_type,
            "size_bytes": len(processed.data),
            "width": processed.width,
            "height": processed.height,
        }

    def _fetch_image_bytes(self, user_id: str, image_url_or_path: str) -> tuple[bytes, str]:
        """Fetch image bytes from Supabase Storage (if user-owned path) or HTTP URL."""
        # If it looks like a relative storage path (e.g. "<user_id>/..."), download via Supabase
        if not image_url_or_path.lower().startswith(("http://", "https://")):
            if not image_url_or_path.startswith(f"{user_id}/"):
                raise ImageServiceError("Access denied to requested image path.", status_code=403)
            raw = self._supabase.download_file(settings.SUPABASE_IMAGES_BUCKET, image_url_or_path)
            processed = self.validate_and_prepare_image(raw)
            return processed.data, processed.content_type

        # Allow fetching from Supabase signed/public URL
        try:
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                resp = client.get(image_url_or_path)
                resp.raise_for_status()
                raw = resp.content
        except Exception as exc:
            logger.warning("Failed to download image URL for analysis: %s", type(exc).__name__)
            raise ImageServiceError(
                "Unable to retrieve the image for analysis. Please re-upload the image.",
                status_code=400,
            ) from exc

        processed = self.validate_and_prepare_image(raw)
        return processed.data, processed.content_type

    def analyze_user_image(
        self,
        user_id: str,
        image_url: str,
        question: str,
        conversation_id: Optional[str] = None,
        user_profile: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Run emergency screen, prompt injection check, multimodal AI analysis, and save record."""
        clean_question = sanitize_text(question, max_length=2000)

        # Deterministic emergency check on the user's question first
        emergency = screen_for_emergency(clean_question)
        if emergency.is_emergency:
            record = self._supabase.create_image_analysis(
                user_id=user_id,
                image_path=image_url,
                question=clean_question,
                analysis=emergency.response,
                conversation_id=conversation_id,
                metadata={
                    "is_emergency": True,
                    "emergency_category": emergency.category,
                    "disclaimer_included": True,
                },
            )
            return {**record, "image_url": image_url}

        # Prompt injection check
        injection = detect_prompt_injection(clean_question)
        if injection.is_injection:
            safe_msg = (
                "I can only provide general, non-diagnostic health information about images within my safety rules. "
                "Please ask a straightforward health question about the image.\n\n"
                f"---\n*{MEDICAL_DISCLAIMER}*"
            )
            record = self._supabase.create_image_analysis(
                user_id=user_id,
                image_path=image_url,
                question=clean_question,
                analysis=safe_msg,
                conversation_id=conversation_id,
                metadata={
                    "prompt_injection_blocked": True,
                    "safety_flags": injection.matched_rules,
                    "disclaimer_included": True,
                },
            )
            return {**record, "image_url": image_url}

        image_bytes, mime_type = self._fetch_image_bytes(user_id, image_url)

        # Check image quality to inform the prompt if needed
        quality_note = None
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                quality_note = self._assess_image_quality(img)
        except Exception:
            quality_note = None

        prompt = prompt_builder.build_image_analysis_prompt(
            question=clean_question,
            user_profile=user_profile,
        )
        if quality_note:
            prompt += f"\n\nImage quality note: {quality_note}"

        ai_result = self._ai.analyze_image(
            prompt=prompt,
            image_bytes=image_bytes,
            mime_type=mime_type,
        )

        safety = validate_response_safety(ai_result.text)
        final_analysis, _ = ensure_medical_disclaimer(safety.sanitized_response)
        if quality_note and "image quality" not in final_analysis.lower():
            final_analysis = f"> **Image Quality Note:** {quality_note}\n\n{final_analysis}"

        metadata: dict[str, Any] = {
            "mime_type": mime_type,
            "interaction_id": ai_result.interaction_id,
            "safety_flags": safety.flags,
            "quality_warning": quality_note,
            "is_fallback": ai_result.is_fallback,
            "disclaimer_included": True,
        }

        record = self._supabase.create_image_analysis(
            user_id=user_id,
            image_path=image_url,
            question=clean_question,
            analysis=final_analysis,
            conversation_id=conversation_id,
            metadata=metadata,
        )
        return {**record, "image_url": image_url}


image_service = ImageService()
