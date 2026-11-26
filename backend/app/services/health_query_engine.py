"""10-step health query workflow engine wrapping emergency screening, AI, and safety checks."""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from app.services.ai_service import AIService, ai_service as default_ai_service
from app.services.emergency_service import EmergencyScreenResult, screen_for_emergency
from app.services.prompt_builder import PromptBuilder, prompt_builder as default_prompt_builder
from app.utils.safety import (
    MEDICAL_DISCLAIMER,
    detect_prompt_injection,
    ensure_medical_disclaimer,
    validate_response_safety,
)
from app.utils.sanitizers import sanitize_text

logger = logging.getLogger(__name__)

# Common symptom vocabulary for lightweight deterministic extraction (Step 2)
_SYMPTOM_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("fever", re.compile(r"\b(?:fever|high\s+temp(?:erature)?|chills|feverish)\b", re.IGNORECASE)),
    ("headache", re.compile(r"\b(?:headache|migraine|head\s+ache|throbbing\s+head)\b", re.IGNORECASE)),
    ("cough", re.compile(r"\b(?:cough(?:ing)?|dry\s+cough|wet\s+cough)\b", re.IGNORECASE)),
    ("sore throat", re.compile(r"\b(?:sore\s+throat|throat\s+pain|scratchy\s+throat)\b", re.IGNORECASE)),
    ("fatigue", re.compile(r"\b(?:fatigue|tired(?:ness)?|exhausted|low\s+energy|weakness)\b", re.IGNORECASE)),
    ("nausea", re.compile(r"\b(?:nausea|nauseous|vomiting|throwing\s+up|queasy)\b", re.IGNORECASE)),
    ("stomach pain", re.compile(r"\b(?:stomach\s+(?:pain|ache|cramps?)|abdominal\s+pain|belly\s+ache)\b", re.IGNORECASE)),
    ("diarrhea", re.compile(r"\b(?:diarrhea|diarrhoea|loose\s+stools?|watery\s+stools?)\b", re.IGNORECASE)),
    ("dizziness", re.compile(r"\b(?:dizz(?:y|iness)|lightheaded(?:ness)?|vertigo)\b", re.IGNORECASE)),
    ("rash", re.compile(r"\b(?:rash|hives|itchy\s+skin|red\s+spots?|skin\s+irritation)\b", re.IGNORECASE)),
    ("joint pain", re.compile(r"\b(?:joint\s+pain|knee\s+pain|back\s+pain|body\s+aches?|muscle\s+pain)\b", re.IGNORECASE)),
    ("shortness of breath", re.compile(r"\b(?:short(?:ness)?\s+of\s+breath|breathless(?:ness)?|wheezing)\b", re.IGNORECASE)),
    ("chest discomfort", re.compile(r"\b(?:chest\s+(?:pain|discomfort|tightness|pressure))\b", re.IGNORECASE)),
    ("insomnia", re.compile(r"\b(?:insomnia|trouble\s+sleeping|can'?t\s+sleep|poor\s+sleep)\b", re.IGNORECASE)),
    ("anxiety", re.compile(r"\b(?:anxiety|anxious|panic|stressed|palpitations)\b", re.IGNORECASE)),
    ("congestion", re.compile(r"\b(?:runny\s+nose|stuffy\s+nose|nasal\s+congestion|sinus\s+pressure)\b", re.IGNORECASE)),
)

_DURATION_INDICATOR_RE = re.compile(
    r"\b(?:\d+\s*(?:minutes?|hours?|days?|weeks?|months?|years?)|since\s+(?:yesterday|today|morning|last\s+night)|for\s+(?:a\s+few|several)\s+(?:days?|hours?|weeks?))\b",
    re.IGNORECASE,
)


@dataclass
class HealthQueryResult:
    """Complete result from the 10-step health query engine."""

    response_text: str
    emergency: EmergencyScreenResult
    interaction_id: Optional[str] = None
    detected_symptoms: list[str] = field(default_factory=list)
    sections: dict[str, str] = field(default_factory=dict)
    safety_flags: list[str] = field(default_factory=list)
    needs_followup: bool = False
    prompt_injection_blocked: bool = False
    is_fallback: bool = False

    def to_metadata(self) -> dict[str, Any]:
        return {
            "is_emergency": self.emergency.is_emergency,
            "emergency_category": self.emergency.category,
            "emergency_severity": self.emergency.severity,
            "interaction_id": self.interaction_id,
            "detected_symptoms": self.detected_symptoms,
            "sections": list(self.sections.keys()),
            "safety_flags": self.safety_flags,
            "needs_followup": self.needs_followup,
            "prompt_injection_blocked": self.prompt_injection_blocked,
            "is_fallback": self.is_fallback,
            "disclaimer_included": True,
        }


class HealthQueryEngine:
    """Executes the structured 10-step health query pipeline."""

    def __init__(
        self,
        ai_service: Optional[AIService] = None,
        prompt_builder: Optional[PromptBuilder] = None,
    ) -> None:
        self._ai = ai_service or default_ai_service
        self._prompt_builder = prompt_builder or default_prompt_builder

    def _step1_parse_concern(self, raw_message: str) -> str:
        """Step 1: Sanitize and normalize user concern."""
        return sanitize_text(raw_message, max_length=5000)

    def _step2_identify_symptoms(
        self,
        current_message: str,
        history: Optional[list[dict[str, Any]]] = None,
    ) -> list[str]:
        """Step 2: Identify mentioned symptoms across current message and recent user history."""
        texts = [current_message]
        if history:
            for msg in history[-6:]:
                if msg.get("role") == "user" and msg.get("content"):
                    texts.append(str(msg["content"]))

        combined = " ".join(texts)
        found: list[str] = []
        for symptom_name, pattern in _SYMPTOM_PATTERNS:
            if pattern.search(combined) and symptom_name not in found:
                found.append(symptom_name)
        return found

    def _step3_check_followup_needed(
        self,
        message: str,
        symptoms: list[str],
        history: Optional[list[dict[str, Any]]] = None,
    ) -> bool:
        """Step 3: Determine if clarifying follow-up questions would add useful context."""
        # If there is already an ongoing multi-turn discussion, avoid over-asking
        user_turns = sum(1 for m in (history or []) if m.get("role") == "user")
        if user_turns >= 2:
            return False

        word_count = len(message.split())
        has_duration = bool(_DURATION_INDICATOR_RE.search(message))
        # Very short symptom report without duration/context benefits from gentle follow-up
        return bool(symptoms) and word_count < 15 and not has_duration

    def _step4_screen_emergency(self, message: str) -> EmergencyScreenResult:
        """Step 4: Run deterministic emergency check BEFORE calling AI."""
        return screen_for_emergency(message)

    @staticmethod
    def _find_previous_interaction_id(
        history: Optional[list[dict[str, Any]]],
    ) -> Optional[str]:
        """Retrieve the latest Gemini interaction_id from prior assistant messages."""
        if not history:
            return None
        for msg in reversed(history):
            if msg.get("role") == "assistant":
                meta = msg.get("metadata") or {}
                if isinstance(meta, dict) and meta.get("interaction_id"):
                    return str(meta["interaction_id"])
        return None

    def process_query(
        self,
        user_message: str,
        conversation_history: Optional[list[dict[str, Any]]] = None,
        user_profile: Optional[dict[str, Any]] = None,
        image_url: Optional[str] = None,
        language: Optional[str] = "en",
    ) -> HealthQueryResult:
        """Execute all 10 steps and return a validated HealthQueryResult."""
        # Step 1: Parse user concern
        parsed_message = self._step1_parse_concern(user_message)

        # Step 2: Identify symptoms from message + history
        detected_symptoms = self._step2_identify_symptoms(parsed_message, conversation_history)

        # Step 3: Check if follow-up context is needed
        needs_followup = self._step3_check_followup_needed(
            parsed_message, detected_symptoms, conversation_history
        )

        # Step 4: Run deterministic emergency_service check BEFORE AI
        emergency = self._step4_screen_emergency(parsed_message)
        if emergency.is_emergency:
            logger.info("Emergency screened deterministically: category=%s", emergency.category)
            return HealthQueryResult(
                response_text=emergency.response,
                emergency=emergency,
                detected_symptoms=detected_symptoms,
                needs_followup=False,
            )

        # Prompt injection guardrail before building AI prompt
        injection_check = detect_prompt_injection(parsed_message)
        if injection_check.is_injection:
            logger.warning(
                "Prompt injection attempt blocked: rules=%s", injection_check.matched_rules
            )
            safe_refusal = (
                "I can only assist with general health information and wellness guidance within my safety guidelines. "
                "I cannot change my instructions, bypass safety rules, or act as a licensed physician.\n\n"
                "If you have a health symptom or wellness question you'd like to discuss, please feel free to describe it!\n\n"
                f"---\n*{MEDICAL_DISCLAIMER}*"
            )
            return HealthQueryResult(
                response_text=safe_refusal,
                emergency=emergency,
                detected_symptoms=detected_symptoms,
                safety_flags=injection_check.matched_rules,
                prompt_injection_blocked=True,
            )

        # Step 5: Build context from conversation history & user profile
        previous_interaction_id = self._find_previous_interaction_id(conversation_history)
        prompt = self._prompt_builder.build_health_query_prompt(
            user_message=parsed_message,
            conversation_history=conversation_history,
            user_profile=user_profile,
            detected_symptoms=detected_symptoms,
            needs_followup=needs_followup,
            has_previous_interaction=bool(previous_interaction_id),
            language=language,
        )
        if image_url:
            prompt += (
                "\n\nNote: The user also attached a reference image to this message. "
                "For visual inspection of images, remind them they can use the dedicated Image Analysis tool."
            )

        # Step 6: Call AI with structured prompt (Gemini Interactions API)
        ai_result = self._ai.generate_health_response(
            prompt=prompt,
            previous_interaction_id=previous_interaction_id,
        )

        # Retry without stale interaction_id if a chained interaction failed
        if ai_result.is_fallback and previous_interaction_id:
            logger.info("Retrying health query without previous_interaction_id")
            fallback_prompt = self._prompt_builder.build_health_query_prompt(
                user_message=parsed_message,
                conversation_history=conversation_history,
                user_profile=user_profile,
                detected_symptoms=detected_symptoms,
                needs_followup=needs_followup,
                has_previous_interaction=False,
                language=language,
            )
            if image_url:
                fallback_prompt += (
                    "\n\nNote: The user also attached a reference image to this message. "
                    "For visual inspection of images, remind them they can use the dedicated Image Analysis tool."
                )
            ai_result = self._ai.generate_health_response(
                prompt=fallback_prompt,
                previous_interaction_id=None,
            )

        # Step 7: Parse structured response sections
        sections = ai_result.sections or self._ai.parse_structured_sections(ai_result.text)

        # Step 8: Validate safety (no diagnosis claims, no prescription dosages)
        safety_result = validate_response_safety(ai_result.text)
        if not safety_result.is_safe:
            logger.warning("AI response softened by safety filter: flags=%s", safety_result.flags)

        # Step 9: Format final response with guaranteed medical disclaimer
        final_text, _ = ensure_medical_disclaimer(safety_result.sanitized_response)

        # Step 10: Return structured result with metadata
        return HealthQueryResult(
            response_text=final_text,
            emergency=emergency,
            interaction_id=ai_result.interaction_id,
            detected_symptoms=detected_symptoms,
            sections=sections,
            safety_flags=safety_result.flags,
            needs_followup=needs_followup,
            is_fallback=ai_result.is_fallback,
        )


health_query_engine = HealthQueryEngine()
