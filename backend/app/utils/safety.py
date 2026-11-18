"""Safety utilities: prompt injection detection and medical response safety validation."""

import re
from dataclasses import dataclass, field

MEDICAL_DISCLAIMER = (
    "Medical Disclaimer: This information is provided by an AI health assistant for "
    "general educational purposes only and is not a medical diagnosis, prescription, "
    "or substitute for professional medical advice. Always consult a qualified "
    "healthcare provider for medical concerns."
)

# Patterns indicative of prompt injection / jailbreak attempts
_PROMPT_INJECTION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "ignore_instructions",
        re.compile(
            r"\b(?:ignore|disregard|forget|override|bypass)\b.{0,40}\b(?:previous|prior|above|all|system)\b.{0,30}\b(?:instructions?|rules?|prompts?|guidelines?|directions?)\b",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "ignore_previous_short",
        re.compile(
            r"\b(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior|above)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "system_prompt_extraction",
        re.compile(
            r"\b(?:reveal|show|print|output|repeat|dump|tell\s+me|what\s+is)\b.{0,35}\b(?:system\s+prompt|hidden\s+instructions?|developer\s+message|initial\s+instructions?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "role_hijack",
        re.compile(
            r"\b(?:you\s+are\s+now|act\s+as\s+if\s+you\s+are|pretend\s+to\s+be|switch\s+to)\b.{0,45}\b(?:unrestricted|jailbroken|dan\b|evil|licensed\s+doctor\s+who\s+prescribes|no\s+rules|no\s+restrictions)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "delimiter_injection",
        re.compile(
            r"(?:<\s*/?\s*system\s*>|\[\s*SYSTEM\s*\]|###\s*SYSTEM\s*INSTRUCTION|BEGIN\s+SYSTEM\s+PROMPT)",
            re.IGNORECASE,
        ),
    ),
    (
        "safety_bypass_request",
        re.compile(
            r"\b(?:bypass|disable|turn\s+off|remove)\b.{0,30}\b(?:safety|guardrails?|filters?|restrictions?|disclaimers?)\b",
            re.IGNORECASE,
        ),
    ),
]

# Patterns that indicate an AI response crossed the line into diagnosing or prescribing
_DIAGNOSIS_CLAIM_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "direct_diagnosis",
        re.compile(
            r"\b(?:i\s+diagnose\s+you\s+with|my\s+diagnosis\s+is|you\s+definitely\s+have|"
            r"you\s+certainly\s+have|you\s+undoubtedly\s+have|this\s+is\s+definitely\s+(?:a\s+)?|"
            r"confirmed\s+diagnosis\s+of|you\s+are\s+diagnosed\s+with)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "definitive_you_have",
        re.compile(
            r"\b(?:you\s+have\s+(?:cancer|diabetes|pneumonia|appendicitis|meningitis|"
            r"a\s+heart\s+attack|a\s+stroke|a\s+fracture|broken\s+bone|sepsis|"
            r"melanoma|tuberculosis|covid-?19|asthma|hypertension|depression|bipolar))\b",
            re.IGNORECASE,
        ),
    ),
    (
        "prescription_dosage",
        re.compile(
            r"\b(?:i\s+prescribe|take\s+\d+\s*(?:mg|mcg|ml|tablets?|capsules?|pills?)\s+(?:of\s+)?[a-z]+|"
            r"start\s+taking\s+\d+\s*(?:mg|mcg|ml))\b",
            re.IGNORECASE,
        ),
    ),
    (
        "discourage_medical_care",
        re.compile(
            r"\b(?:do\s+not\s+(?:see|visit|consult|go\s+to)\s+a\s+doctor|"
            r"don'?t\s+(?:bother\s+seeing|need\s+to\s+see)\s+a\s+doctor|"
            r"no\s+need\s+for\s+(?:a\s+doctor|medical\s+attention|hospital)|"
            r"stop\s+taking\s+your\s+prescribed\s+medication)\b",
            re.IGNORECASE,
        ),
    ),
]

# Safe replacements for flagged phrases if rewriting is applied
_SOFTEN_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bi\s+diagnose\s+you\s+with\b", re.IGNORECASE), "these symptoms may be associated with"),
    (re.compile(r"\bmy\s+diagnosis\s+is\b", re.IGNORECASE), "a possible consideration to discuss with a doctor is"),
    (re.compile(r"\byou\s+definitely\s+have\b", re.IGNORECASE), "you may possibly be experiencing"),
    (re.compile(r"\byou\s+certainly\s+have\b", re.IGNORECASE), "your symptoms could possibly relate to"),
    (re.compile(r"\byou\s+undoubtedly\s+have\b", re.IGNORECASE), "your symptoms might be related to"),
    (re.compile(r"\bthis\s+is\s+definitely\b", re.IGNORECASE), "this may possibly be"),
    (re.compile(r"\bi\s+prescribe\b", re.IGNORECASE), "a healthcare provider may discuss options such as"),
    (
        re.compile(r"\bdo\s+not\s+(?:see|visit|consult|go\s+to)\s+a\s+doctor\b", re.IGNORECASE),
        "consider consulting a healthcare professional",
    ),
    (
        re.compile(r"\bdon'?t\s+(?:bother\s+seeing|need\s+to\s+see)\s+a\s+doctor\b", re.IGNORECASE),
        "consider consulting a healthcare professional",
    ),
    (
        re.compile(r"\bstop\s+taking\s+your\s+prescribed\s+medication\b", re.IGNORECASE),
        "speak with your prescribing doctor before making any changes to your medication",
    ),
]

_DISCLAIMER_INDICATORS = (
    "not a medical diagnosis",
    "medical disclaimer",
    "not a substitute for professional medical advice",
)


@dataclass
class PromptInjectionResult:
    """Result of prompt injection screening."""

    is_injection: bool
    matched_rules: list[str] = field(default_factory=list)


@dataclass
class ResponseSafetyResult:
    """Result of validating an AI-generated health response."""

    is_safe: bool
    flags: list[str] = field(default_factory=list)
    sanitized_response: str = ""
    disclaimer_added: bool = False


def detect_prompt_injection(text: str) -> PromptInjectionResult:
    """Detect common prompt injection and jailbreak attempts in user input."""
    if not text or not isinstance(text, str):
        return PromptInjectionResult(is_injection=False)

    matched: list[str] = []
    for rule_name, pattern in _PROMPT_INJECTION_PATTERNS:
        if pattern.search(text):
            matched.append(rule_name)

    return PromptInjectionResult(
        is_injection=len(matched) > 0,
        matched_rules=matched,
    )


def ensure_medical_disclaimer(response_text: str) -> tuple[str, bool]:
    """Ensure the response contains a clear medical disclaimer. Returns (text, was_added)."""
    if not response_text:
        return MEDICAL_DISCLAIMER, True

    lowered = response_text.lower()
    if any(indicator in lowered for indicator in _DISCLAIMER_INDICATORS):
        return response_text, False

    return f"{response_text.rstrip()}\n\n---\n*{MEDICAL_DISCLAIMER}*", True


def validate_response_safety(response_text: str) -> ResponseSafetyResult:
    """Inspect an AI response for unsafe medical claims and return a softened, safe version."""
    if not response_text or not isinstance(response_text, str):
        return ResponseSafetyResult(
            is_safe=False,
            flags=["empty_response"],
            sanitized_response=(
                "I could not generate reliable health information for this query right now. "
                "Please consult a qualified healthcare professional for personalized guidance.\n\n"
                f"---\n*{MEDICAL_DISCLAIMER}*"
            ),
            disclaimer_added=True,
        )

    flags: list[str] = []
    for rule_name, pattern in _DIAGNOSIS_CLAIM_PATTERNS:
        if pattern.search(response_text):
            flags.append(rule_name)

    sanitized = response_text
    if flags:
        for pattern, replacement in _SOFTEN_REPLACEMENTS:
            sanitized = pattern.sub(replacement, sanitized)

        # If a specific dosage prescription was detected, neutralize dosage instruction
        if "prescription_dosage" in flags:
            sanitized = re.sub(
                r"\b(?:take|start\s+taking)\s+\d+\s*(?:mg|mcg|ml|tablets?|capsules?|pills?)\s+(?:of\s+)?([a-zA-Z0-9-]+)",
                r"consult a doctor or pharmacist before using \1",
                sanitized,
                flags=re.IGNORECASE,
            )

        # If definitive "you have <serious condition>" was detected, soften it
        if "definitive_you_have" in flags:
            sanitized = re.sub(
                r"\byou\s+have\s+(cancer|diabetes|pneumonia|appendicitis|meningitis|"
                r"a\s+heart\s+attack|a\s+stroke|a\s+fracture|broken\s+bone|sepsis|"
                r"melanoma|tuberculosis|covid-?19|asthma|hypertension|depression|bipolar)\b",
                r"your symptoms could possibly be associated with \1 (only a qualified clinician can evaluate this)",
                sanitized,
                flags=re.IGNORECASE,
            )

    sanitized, disclaimer_added = ensure_medical_disclaimer(sanitized)

    return ResponseSafetyResult(
        is_safe=len(flags) == 0,
        flags=flags,
        sanitized_response=sanitized,
        disclaimer_added=disclaimer_added,
    )
