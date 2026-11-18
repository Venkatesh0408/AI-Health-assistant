"""Safety-critical deterministic emergency screening service (runs BEFORE AI)."""

import re
from dataclasses import dataclass, field
from typing import Optional

from app.utils.safety import MEDICAL_DISCLAIMER

EMERGENCY_NUMBERS_INDIA = {
    "national_emergency": "112",
    "ambulance": "108",
    "police": "100",
    "aasra_helpline": "9152987821",
    "icall_helpline": "9152987821",
    "vandrevala_foundation": "1860-2662-345",
}


@dataclass
class EmergencyScreenResult:
    """Result of deterministic emergency screening."""

    is_emergency: bool
    category: Optional[str] = None
    severity: str = "none"  # none | high | critical
    response: str = ""
    matched_triggers: list[str] = field(default_factory=list)
    emergency_numbers: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return {
            "is_emergency": self.is_emergency,
            "category": self.category,
            "severity": self.severity,
            "message": self.response if self.is_emergency else None,
            "emergency_numbers": self.emergency_numbers if self.is_emergency else {},
        }


# Negation prefixes immediately preceding a symptom trigger (e.g., "no chest pain")
_NEGATION_PREFIX_RE = re.compile(
    r"\b(?:no|not|without|never|haven't|havent|don't|dont|denied|denies|negative\s+for)\s+(?:having\s+|experiencing\s+|feeling\s+|any\s+)?$",
    re.IGNORECASE,
)

# Explicit benign false-positive contexts that should not trigger false emergencies
_BENIGN_EXCLUSION_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "cardiac": [
        re.compile(r"\b(?:chest\s+workout|bench\s+press|push-?ups?|muscle\s+soreness\s+after\s+(?:gym|workout))\b", re.IGNORECASE),
        re.compile(r"\bheart\s+(?:skipped|skips)\s+a\s+beat\s+when\s+i\s+saw\b", re.IGNORECASE),
    ],
    "bleeding": [
        re.compile(r"\b(?:minor|tiny|small)\s+(?:paper\s+cut|scratch|scrape|nosebleed\s+that\s+stopped)\b", re.IGNORECASE),
    ],
    "neurological": [
        re.compile(r"\b(?:mild|normal|usual|slight|minor|tension)\s+headache\b", re.IGNORECASE),
    ],
    "respiratory": [
        re.compile(r"\b(?:out\s+of\s+breath\s+after\s+(?:running|jogging|climbing\s+stairs|working\s+out|exercise))\b", re.IGNORECASE),
    ],
}


@dataclass(frozen=True)
class _CategoryRule:
    category: str
    severity: str
    keywords: tuple[str, ...]
    patterns: tuple[re.Pattern[str], ...]


_CATEGORY_RULES: tuple[_CategoryRule, ...] = (
    # Mental health checked with highest care & compassionate crisis response
    _CategoryRule(
        category="mental_health",
        severity="critical",
        keywords=(
            "want to kill myself",
            "going to kill myself",
            "kill myself",
            "end my life",
            "ending my life",
            "commit suicide",
            "suicidal thoughts",
            "suicidal ideation",
            "feeling suicidal",
            "i am suicidal",
            "want to die",
            "don't want to live",
            "dont want to live",
            "better off dead",
            "hurt myself",
            "harm myself",
            "self-harm",
            "cutting myself",
            "overdose on pills",
            "jump off a bridge",
            "hang myself",
        ),
        patterns=(
            re.compile(r"\b(?:thinking\s+(?:of|about)|plan(?:ning)?\s+to|want\s+to)\s+(?:suicide|die|end\s+it\s+all|kill\s+myself|harm\s+myself|hurt\s+myself)\b", re.IGNORECASE),
            re.compile(r"\b(?:no\s+reason\s+to\s+live|can'?t\s+go\s+on\s+living|wish\s+i\s+were\s+dead)\b", re.IGNORECASE),
        ),
    ),
    _CategoryRule(
        category="cardiac",
        severity="critical",
        keywords=(
            "heart attack",
            "cardiac arrest",
            "crushing chest pain",
            "severe chest pain",
            "chest pain radiating",
            "chest tightness radiating",
            "pressure in my chest",
            "squeezing in my chest",
            "pain radiating to left arm",
            "pain spreading to jaw",
            "chest pain and sweating",
            "chest pain and shortness of breath",
            "sudden chest pain",
        ),
        patterns=(
            re.compile(r"\b(?:chest\s+(?:pain|pressure|tightness|heaviness|squeezing))\b.{0,45}\b(?:left\s+arm|jaw|neck|back|shoulder|sweat(?:ing)?|nausea|short(?:ness)?\s+of\s+breath|dizzy|crushing|severe|sudden)\b", re.IGNORECASE | re.DOTALL),
            re.compile(r"\b(?:severe|intense|crushing|sharp|sudden|unbearable)\s+chest\s+(?:pain|pressure|tightness)\b", re.IGNORECASE),
            re.compile(r"\bchest\s+pain\b(?!.*\b(?:mild|minor|sore\s+from|gym|workout)\b)", re.IGNORECASE),
        ),
    ),
    _CategoryRule(
        category="respiratory",
        severity="critical",
        keywords=(
            "can't breathe",
            "cannot breathe",
            "cant breathe",
            "unable to breathe",
            "stopped breathing",
            "not breathing",
            "gasping for air",
            "choking",
            "turning blue",
            "blue lips",
            "bluish lips",
            "severe shortness of breath",
            "struggling to breathe",
            "suffocating",
            "asthma attack not responding",
        ),
        patterns=(
            re.compile(r"\b(?:can'?t|cannot|unable\s+to|hardly|barely|struggling\s+to)\s+(?:breathe|catch\s+(?:my|their|his|her)\s+breath)\b", re.IGNORECASE),
            re.compile(r"\b(?:lips?|face|fingers?|nails?)\s+(?:are\s+)?(?:turning\s+|looking\s+)?blue\b", re.IGNORECASE),
            re.compile(r"\bsevere\s+(?:breathing\s+difficulty|difficulty\s+breathing|respiratory\s+distress|asthma\s+attack)\b", re.IGNORECASE),
        ),
    ),
    _CategoryRule(
        category="neurological",
        severity="critical",
        keywords=(
            "having a stroke",
            "signs of stroke",
            "face drooping",
            "facial drooping",
            "slurred speech",
            "sudden slurred speech",
            "one side of my face",
            "paralysis on one side",
            "sudden weakness on one side",
            "sudden numbness on one side",
            "worst headache of my life",
            "thunderclap headache",
            "having a seizure",
            "active seizure",
            "convulsions",
            "sudden loss of vision",
            "sudden confusion and inability to speak",
        ),
        patterns=(
            re.compile(r"\b(?:face|mouth)\s+(?:is\s+)?drooping\b", re.IGNORECASE),
            re.compile(r"\b(?:sudden|acute)\s+(?:numbness|weakness|paralysis)\s+(?:in|on)\s+(?:one\s+side|left\s+side|right\s+side|my\s+arm|my\s+face)\b", re.IGNORECASE),
            re.compile(r"\b(?:seizure|seizing|convulsing|fitting)\b", re.IGNORECASE),
            re.compile(r"\b(?:worst|most\s+severe|explosive|sudden\s+severe)\s+headache\b", re.IGNORECASE),
            re.compile(r"\b(?:stiff\s+neck)\b.{0,40}\b(?:high\s+fever|confusion|rash|severe\s+headache)\b", re.IGNORECASE | re.DOTALL),
        ),
    ),
    _CategoryRule(
        category="allergic",
        severity="critical",
        keywords=(
            "anaphylaxis",
            "anaphylactic shock",
            "throat closing",
            "throat is closing",
            "throat swelling",
            "swollen tongue",
            "tongue swelling",
            "lips swelling and trouble breathing",
            "severe allergic reaction",
            "swelling of face and throat",
            "epipen",
        ),
        patterns=(
            re.compile(r"\b(?:throat|airway|tongue|uvula)\s+(?:is\s+)?(?:swelling|swollen|closing\s+up|tightening)\b", re.IGNORECASE),
            re.compile(r"\ballergic\s+reaction\b.{0,45}\b(?:breath(?:ing)?|swell(?:ing|en)|hives\s+all\s+over|dizzy|faint|throat)\b", re.IGNORECASE | re.DOTALL),
        ),
    ),
    _CategoryRule(
        category="consciousness",
        severity="critical",
        keywords=(
            "unconscious",
            "unresponsive",
            "won't wake up",
            "wont wake up",
            "cannot wake up",
            "passed out and not waking",
            "collapsed and unresponsive",
            "lost consciousness",
            "loss of consciousness",
            "fainted and hit head",
            "no pulse",
            "not responding",
        ),
        patterns=(
            re.compile(r"\b(?:collapsed|passed\s+out|fainted|blacked\s+out)\b.{0,45}\b(?:unresponsive|not\s+breathing|not\s+waking|won'?t\s+wake|hit\s+(?:head|their\s+head|my\s+head)|seizure|bleeding)\b", re.IGNORECASE | re.DOTALL),
            re.compile(r"\b(?:person|he|she|they|someone|baby|child)\s+(?:is\s+)?(?:unconscious|unresponsive|not\s+waking\s+up)\b", re.IGNORECASE),
        ),
    ),
    _CategoryRule(
        category="bleeding",
        severity="critical",
        keywords=(
            "severe bleeding",
            "uncontrolled bleeding",
            "bleeding heavily",
            "won't stop bleeding",
            "wont stop bleeding",
            "spurting blood",
            "gushing blood",
            "coughing up blood",
            "vomiting blood",
            "throwing up blood",
            "heavy internal bleeding",
            "bleeding out",
            "massive blood loss",
        ),
        patterns=(
            re.compile(r"\b(?:bleeding)\b.{0,35}\b(?:heavily|uncontrollably|profusely|non-?stop|won'?t\s+stop|soaking\s+through)\b", re.IGNORECASE),
            re.compile(r"\b(?:vomiting|throwing\s+up|coughing\s+up)\s+(?:a\s+lot\s+of\s+)?blood\b", re.IGNORECASE),
            re.compile(r"\b(?:large\s+amounts?\s+of\s+blood|bright\s+red\s+blood\s+pouring)\b", re.IGNORECASE),
        ),
    ),
    _CategoryRule(
        category="poisoning",
        severity="critical",
        keywords=(
            "swallowed poison",
            "drank bleach",
            "drank chemical",
            "ingested poison",
            "drug overdose",
            "accidental overdose",
            "took too many pills",
            "overdosed",
            "snake bite",
            "snakebite",
            "venomous bite",
            "carbon monoxide poisoning",
            "chemical burn in eyes",
            "pesticide poisoning",
        ),
        patterns=(
            re.compile(r"\b(?:swallowed|drank|ingested|ate)\s+(?:bleach|acid|poison|pesticide|rat\s+poison|detergent|cleaning\s+(?:fluid|agent)|too\s+many\s+(?:pills|tablets|medicines?))\b", re.IGNORECASE),
            re.compile(r"\b(?:overdos(?:ed|ing)|poison(?:ed|ing))\b", re.IGNORECASE),
        ),
    ),
    _CategoryRule(
        category="trauma",
        severity="critical",
        keywords=(
            "severe head injury",
            "head trauma",
            "car accident",
            "road accident",
            "major accident",
            "compound fracture",
            "bone sticking out",
            "stab wound",
            "stabbed",
            "gunshot wound",
            "shot",
            "severe burn",
            "third degree burn",
            "electrocuted",
            "electric shock",
            "drowning",
            "near drowning",
            "spinal injury",
            "broken neck",
            "crushed limb",
        ),
        patterns=(
            re.compile(r"\b(?:severe|major|serious|deep)\s+(?:head\s+injury|burn|burns|wound|laceration|trauma|fracture|accident)\b", re.IGNORECASE),
            re.compile(r"\b(?:fell\s+from\s+(?:a\s+)?(?:height|roof|balcony|ladder)|hit\s+by\s+a\s+(?:car|truck|vehicle))\b", re.IGNORECASE),
        ),
    ),
)


def _is_negated(text: str, match_start: int) -> bool:
    """Return True if the matched span is immediately preceded by a negation phrase."""
    window = text[max(0, match_start - 40) : match_start]
    return bool(_NEGATION_PREFIX_RE.search(window))


def _is_benign_exclusion(category: str, text: str) -> bool:
    patterns = _BENIGN_EXCLUSION_PATTERNS.get(category, [])
    return any(p.search(text) for p in patterns)


def _build_emergency_response(category: str) -> str:
    """Return a clear, actionable emergency response with Indian emergency contacts."""
    if category == "mental_health":
        return (
            "### Immediate Support Is Available — You Are Not Alone\n\n"
            "It sounds like you may be going through an overwhelming or painful moment right now. "
            "Your life matters, and compassionate, confidential help is available immediately.\n\n"
            "**Please reach out right now:**\n"
            "- **AASRA Suicide Prevention Helpline (24x7, India):** **9152987821**\n"
            "- **iCall Psychosocial Helpline:** **9152987821**\n"
            "- **Vandrevala Foundation (24x7):** **1860-2662-345**\n"
            "- **National Emergency Number (India):** **112**\n"
            "- **Ambulance Services:** **108**\n\n"
            "**What you can do right now:**\n"
            "1. Call one of the numbers above or reach out to a trusted friend, family member, or doctor.\n"
            "2. If you are in immediate physical danger, call **112** or go to the nearest hospital emergency department.\n"
            "3. Stay in a safe place and distance yourself from anything that could cause harm.\n\n"
            f"---\n*{MEDICAL_DISCLAIMER}*"
        )

    category_guidance: dict[str, tuple[str, list[str]]] = {
        "cardiac": (
            "Possible Cardiac Emergency Detected",
            [
                "Call **112** or **108** (Ambulance) immediately — do not drive yourself to the hospital.",
                "Sit down and rest in a comfortable position; loosen any tight clothing.",
                "Stay with someone if possible and unlock your door for emergency responders.",
                "If the person becomes unresponsive and stops breathing, begin CPR if trained and follow dispatcher instructions.",
            ],
        ),
        "respiratory": (
            "Possible Severe Breathing Emergency Detected",
            [
                "Call **112** or **108** (Ambulance) immediately.",
                "Sit upright and try to stay as calm as possible; loosen tight clothing around the neck and chest.",
                "If choking and unable to cough or speak, perform abdominal thrusts (Heimlich maneuver) if trained.",
                "If a prescribed rescue inhaler is available for known asthma, follow the emergency action plan while awaiting medical help.",
            ],
        ),
        "neurological": (
            "Possible Neurological / Stroke Emergency Detected",
            [
                "Call **112** or **108** (Ambulance) immediately — time is critical.",
                "Note the exact time symptoms started, as emergency doctors will need this.",
                "Do not give food, drinks, or medication by mouth if swallowing or alertness is affected.",
                "If someone is having a seizure, protect their head, clear nearby hard objects, do NOT restrain them or put anything in their mouth, and roll them gently onto their side once movements stop.",
            ],
        ),
        "allergic": (
            "Possible Severe Allergic Reaction (Anaphylaxis) Detected",
            [
                "Call **112** or **108** (Ambulance) immediately.",
                "If an epinephrine auto-injector (EpiPen) has been prescribed for this person, use it as directed right away.",
                "Have the person lie flat with legs elevated unless breathing is difficult (in which case sitting up may help).",
                "Remove exposure to the suspected allergen if safe to do so and monitor breathing closely.",
            ],
        ),
        "consciousness": (
            "Possible Loss of Consciousness Emergency Detected",
            [
                "Call **112** or **108** (Ambulance) immediately.",
                "Check for responsiveness and normal breathing.",
                "If breathing normally and no spinal injury is suspected, place the person gently in the recovery position (on their side).",
                "If not breathing normally, begin CPR immediately if trained and follow the emergency dispatcher's instructions.",
            ],
        ),
        "bleeding": (
            "Possible Severe Bleeding Emergency Detected",
            [
                "Call **112** or **108** (Ambulance) immediately.",
                "Apply firm, continuous direct pressure to an external wound using a clean cloth or sterile gauze.",
                "Do not remove soaked cloths — add fresh layers on top and keep pressing.",
                "If vomiting or coughing up blood, seek immediate emergency hospital care and avoid eating or drinking.",
            ],
        ),
        "poisoning": (
            "Possible Poisoning or Overdose Emergency Detected",
            [
                "Call **112** or **108** (Ambulance) immediately.",
                "Do NOT induce vomiting unless explicitly instructed by a poison control specialist or emergency doctor.",
                "Keep the container, substance label, or medication bottle ready to show emergency responders.",
                "If the person is unconscious or having trouble breathing, inform the dispatcher immediately.",
            ],
        ),
        "trauma": (
            "Possible Severe Trauma / Injury Emergency Detected",
            [
                "Call **112** or **108** (Ambulance) immediately.",
                "Ensure the scene is safe before approaching.",
                "Avoid moving the person unnecessarily, especially if head, neck, or spinal injury is suspected.",
                "Control any visible external bleeding with firm direct pressure using a clean cloth and keep the person warm until help arrives.",
            ],
        ),
    }

    title, steps = category_guidance.get(
        category,
        (
            "Potential Medical Emergency Detected",
            [
                "Call **112** or **108** (Ambulance) immediately.",
                "Go to the nearest hospital emergency department without delay.",
            ],
        ),
    )

    steps_md = "\n".join(f"{idx}. {step}" for idx, step in enumerate(steps, start=1))
    return (
        f"### URGENT: {title}\n\n"
        "Based on what you described, this could be a life-threatening emergency that requires "
        "**immediate professional medical attention**. Do not wait for an AI response.\n\n"
        "**Emergency Numbers (India):**\n"
        "- **National Emergency:** **112**\n"
        "- **Ambulance:** **108**\n"
        "- **Mental Health Crisis (AASRA):** **9152987821**\n\n"
        f"**Immediate Steps:**\n{steps_md}\n\n"
        f"---\n*{MEDICAL_DISCLAIMER}*"
    )


def screen_for_emergency(message: str) -> EmergencyScreenResult:
    """Deterministically screen user text for emergency indicators BEFORE calling AI.

    Returns an EmergencyScreenResult indicating whether an emergency was detected,
    its category, severity, and an immediate safety response with emergency numbers.
    """
    if not message or not isinstance(message, str):
        return EmergencyScreenResult(is_emergency=False)

    normalized = re.sub(r"\s+", " ", message.strip())
    if not normalized:
        return EmergencyScreenResult(is_emergency=False)

    lowered = normalized.lower()

    for rule in _CATEGORY_RULES:
        if _is_benign_exclusion(rule.category, normalized):
            continue

        matched_triggers: list[str] = []

        # Exact substring keyword checks with word-boundary / negation awareness
        for kw in rule.keywords:
            kw_pattern = re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE)
            for match in kw_pattern.finditer(lowered):
                if not _is_negated(lowered, match.start()):
                    matched_triggers.append(kw)
                    break

        # Regex pattern checks with negation awareness
        for pattern in rule.patterns:
            for match in pattern.finditer(normalized):
                if not _is_negated(normalized, match.start()):
                    matched_triggers.append(pattern.pattern[:48])
                    break

        if matched_triggers:
            return EmergencyScreenResult(
                is_emergency=True,
                category=rule.category,
                severity=rule.severity,
                response=_build_emergency_response(rule.category),
                matched_triggers=matched_triggers,
                emergency_numbers=dict(EMERGENCY_NUMBERS_INDIA),
            )

    return EmergencyScreenResult(is_emergency=False)
