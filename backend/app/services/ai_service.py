"""Core Google Gemini AI service using google-genai SDK and Interactions API."""

import base64
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from google import genai

from app.config import settings
from app.utils.safety import MEDICAL_DISCLAIMER

logger = logging.getLogger(__name__)

HEALTH_ASSISTANT_SYSTEM_PROMPT = """You are a knowledgeable, empathetic AI health information assistant. You help users understand their health concerns and make informed decisions about seeking care.

RULES:
1. NEVER claim to provide a medical diagnosis.
2. NEVER prescribe specific medications or dosages.
3. NEVER discourage seeking professional medical care.
4. ALWAYS use uncertainty language ("may", "could", "possibly").
5. ALWAYS recommend professional consultation for serious symptoms.
6. ALWAYS be transparent about limitations.
7. For every health concern, structure your response with these sections (adapt as needed):
   - Understanding Your Concern: Acknowledge what the user described
   - Possible Explanations: General causes (use "may include", "could be related to")
   - What You Can Do Now: Safe, general self-care suggestions
   - Recommended Precautions: What to watch for
   - What to Avoid: Common mistakes
   - When to See a Doctor: Clear guidance on when professional care is needed
   - Emergency Warning Signs: Red flags requiring immediate attention
8. Be conversational and clear, not clinical or robotic.
9. Ask follow-up questions when you need more context, but don't over-ask.
10. If you cannot provide reliable information, say so honestly.
11. Cite reputable sources (WHO, NHS, MedlinePlus) when relevant.

You are NOT a doctor. You provide health information and guidance to help users make informed decisions."""

IMAGE_ANALYSIS_SYSTEM_PROMPT = (
    HEALTH_ASSISTANT_SYSTEM_PROMPT
    + "\n\nADDITIONAL IMAGE SAFETY RULES:\n"
    + "- NEVER claim to diagnose cancer, melanoma, fractures, broken bones, internal injuries, or infections from a photo.\n"
    + "- Visual photos have major limitations (lighting, angle, depth, lack of clinical tests).\n"
    + "- If the image is blurry, dark, or unclear, state clearly that image quality limits observation and advise an in-person clinical check.\n"
    + "- Always advise seeing a qualified healthcare professional for any persistent, worsening, painful, or concerning visual finding."
)

_SECTION_NAMES = (
    "Understanding Your Concern",
    "Possible Explanations",
    "What You Can Do Now",
    "Recommended Precautions",
    "What to Avoid",
    "When to See a Doctor",
    "Emergency Warning Signs",
)


@dataclass
class AIResponse:
    """Structured result returned by AIService."""

    text: str
    interaction_id: Optional[str] = None
    sections: dict[str, str] = field(default_factory=dict)
    model: str = ""
    is_fallback: bool = False
    error: Optional[str] = None


class AIService:
    """Wrapper around google-genai Client using the Interactions API (`gemini-4-hydrogen`)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self._api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self._model = model or settings.GEMINI_MODEL or "gemini-4-hydrogen"
        self._client: Optional[genai.Client] = None

    @property
    def model(self) -> str:
        return self._model

    def _get_client(self) -> genai.Client:
        """Lazily initialize the google-genai Client."""
        if self._client is None:
            api_key = self._api_key or settings.GEMINI_API_KEY
            if not api_key:
                raise RuntimeError("GEMINI_API_KEY is not configured.")
            self._client = genai.Client(api_key=api_key)
        return self._client

    @staticmethod
    def _extract_text_from_interaction(interaction: Any) -> str:
        """Extract assistant text cleanly from a google-genai Interactions API response."""
        if interaction is None:
            return ""

        # google-genai >= 3.x exposes `output_text` directly on Interaction
        output_text = getattr(interaction, "output_text", None)
        if isinstance(output_text, str) and output_text.strip():
            return output_text.strip()

        # google-genai >= 2.x/3.x also exposes `steps` (filter out thought steps)
        steps = getattr(interaction, "steps", None)
        if steps:
            collected_steps: list[str] = []
            for step in steps:
                step_type = getattr(step, "type", None) or (
                    step.get("type") if isinstance(step, dict) else None
                )
                if step_type == "thought":
                    continue
                step_text = getattr(step, "text", None) or (
                    step.get("text") if isinstance(step, dict) else None
                )
                if isinstance(step_text, str) and step_text.strip():
                    collected_steps.append(step_text.strip())
                    continue
                step_content = getattr(step, "content", None) or (
                    step.get("content") if isinstance(step, dict) else None
                )
                if isinstance(step_content, str) and step_content.strip():
                    collected_steps.append(step_content.strip())
                elif isinstance(step_content, list):
                    for part in step_content:
                        part_text = getattr(part, "text", None) or (
                            part.get("text") if isinstance(part, dict) else None
                        )
                        if isinstance(part_text, str) and part_text.strip():
                            collected_steps.append(part_text.strip())
            if collected_steps:
                return "\n\n".join(collected_steps)

        # Legacy / mock Interactions API exposes `outputs` list with text items
        outputs = getattr(interaction, "outputs", None)
        if outputs:
            collected: list[str] = []
            for item in outputs:
                text = getattr(item, "text", None)
                if isinstance(text, str) and text.strip():
                    collected.append(text.strip())
                    continue
                if isinstance(item, dict):
                    item_text = item.get("text")
                    if isinstance(item_text, str) and item_text.strip():
                        collected.append(item_text.strip())
                        continue
                    content = item.get("content")
                    if isinstance(content, str) and content.strip():
                        collected.append(content.strip())
                content_attr = getattr(item, "content", None)
                if isinstance(content_attr, str) and content_attr.strip():
                    collected.append(content_attr.strip())
                elif isinstance(content_attr, list):
                    for part in content_attr:
                        part_text = getattr(part, "text", None) or (
                            part.get("text") if isinstance(part, dict) else None
                        )
                        if isinstance(part_text, str) and part_text.strip():
                            collected.append(part_text.strip())
            if collected:
                return "\n\n".join(collected)

        # Direct text attribute fallback if present
        direct_text = getattr(interaction, "text", None)
        if isinstance(direct_text, str) and direct_text.strip():
            return direct_text.strip()

        return ""

    @staticmethod
    def parse_structured_sections(response_text: str) -> dict[str, str]:
        """Parse recognized structured health response sections from markdown text."""
        if not response_text:
            return {}

        sections: dict[str, str] = {}
        pattern = re.compile(
            r"(?:^|\n)(?:#{1,4}\s*|\*\*)("
            + "|".join(re.escape(name) for name in _SECTION_NAMES)
            + r")(?:\*\*)?:?\s*",
            re.IGNORECASE,
        )
        matches = list(pattern.finditer(response_text))
        for idx, match in enumerate(matches):
            header = match.group(1).strip()
            canonical = next(
                (name for name in _SECTION_NAMES if name.lower() == header.lower()),
                header,
            )
            start = match.end()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(response_text)
            body = response_text[start:end].strip()
            if body:
                sections[canonical] = body
        return sections

    def generate_health_response(
        self,
        prompt: str,
        previous_interaction_id: Optional[str] = None,
        system_instruction: Optional[str] = None,
    ) -> AIResponse:
        """Call Gemini Interactions API (`client.interactions.create`) for text health guidance."""
        try:
            client = self._get_client()
            kwargs: dict[str, Any] = {
                "model": self._model,
                "input": prompt,
                "system_instruction": system_instruction or HEALTH_ASSISTANT_SYSTEM_PROMPT,
            }
            if previous_interaction_id:
                kwargs["previous_interaction_id"] = previous_interaction_id

            interaction = client.interactions.create(**kwargs)
            text = self._extract_text_from_interaction(interaction)
            interaction_id = getattr(interaction, "id", None)

            if not text:
                logger.warning("Gemini Interactions API returned empty output.")
                return self._fallback_response("empty_model_output")

            sections = self.parse_structured_sections(text)
            return AIResponse(
                text=text,
                interaction_id=str(interaction_id) if interaction_id else None,
                sections=sections,
                model=self._model,
                is_fallback=False,
            )
        except Exception as exc:
            # Never log prompt/health text — log only exception class
            logger.error("AI health response failed with %s", type(exc).__name__)
            return self._fallback_response(type(exc).__name__)

    def analyze_image(
        self,
        prompt: str,
        image_bytes: bytes,
        mime_type: str,
        previous_interaction_id: Optional[str] = None,
    ) -> AIResponse:
        """Call Gemini Interactions API (`client.interactions.create`) with multimodal image + text input."""
        try:
            client = self._get_client()
            encoded_image = base64.b64encode(image_bytes).decode("ascii")
            multimodal_input = [
                {"type": "text", "text": prompt},
                {
                    "type": "image",
                    "data": encoded_image,
                    "mime_type": mime_type,
                },
            ]

            kwargs: dict[str, Any] = {
                "model": self._model,
                "input": multimodal_input,
                "system_instruction": IMAGE_ANALYSIS_SYSTEM_PROMPT,
            }
            if previous_interaction_id:
                kwargs["previous_interaction_id"] = previous_interaction_id

            interaction = client.interactions.create(**kwargs)
            text = self._extract_text_from_interaction(interaction)
            interaction_id = getattr(interaction, "id", None)

            if not text:
                logger.warning("Gemini multimodal Interactions API returned empty output.")
                return self._fallback_response("empty_multimodal_output", is_image=True)

            sections = self.parse_structured_sections(text)
            return AIResponse(
                text=text,
                interaction_id=str(interaction_id) if interaction_id else None,
                sections=sections,
                model=self._model,
                is_fallback=False,
            )
        except Exception as exc:
            logger.error("AI image analysis failed with %s", type(exc).__name__)
            return self._fallback_response(type(exc).__name__, is_image=True)

    def _fallback_response(self, reason: str, is_image: bool = False) -> AIResponse:
        """Graceful non-diagnostic fallback when the AI service is temporarily unavailable."""
        if is_image:
            text = (
                "### Unable to Analyze Image Right Now\n\n"
                "I'm temporarily unable to process this image. Even when available, an AI tool "
                "cannot replace an in-person visual examination by a doctor or dermatologist.\n\n"
                "**Recommended Next Steps:**\n"
                "- Please try again in a few moments, ensuring the image is clear and well-lit.\n"
                "- Consult a qualified healthcare professional if the area is painful, spreading, "
                "changing rapidly, or causing concern.\n"
                "- For urgent or severe symptoms, contact emergency services (**112** or **108** in India).\n\n"
                f"---\n*{MEDICAL_DISCLAIMER}*"
            )
        else:
            text = (
                "### Understanding Your Concern\n"
                "Thank you for sharing your health question. I am temporarily unable to generate "
                "a full AI response right now.\n\n"
                "### What You Can Do Now\n"
                "- Please try submitting your question again in a moment.\n"
                "- Keep note of when your symptoms started, how severe they are, and anything that makes them better or worse.\n\n"
                "### When to See a Doctor\n"
                "If your symptoms are persistent, worsening, or worrying you, please consult a qualified healthcare professional. "
                "If you are experiencing severe or sudden emergency symptoms, call **112** or **108** immediately.\n\n"
                f"---\n*{MEDICAL_DISCLAIMER}*"
            )

        return AIResponse(
            text=text,
            interaction_id=None,
            sections=self.parse_structured_sections(text),
            model=self._model,
            is_fallback=True,
            error=reason,
        )


ai_service = AIService()
