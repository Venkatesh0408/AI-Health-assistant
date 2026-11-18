"""Contextual prompt builder for health queries, image analysis, and summaries."""

from datetime import date, datetime
from typing import Any, Optional

from app.utils.sanitizers import sanitize_text

HEALTH_QUERY_TEMPLATE = """{profile_block}{history_block}{context_notes}
User's current health question:
\"\"\"{user_message}\"\"\"

Respond clearly, empathetically, and safely following your system instructions. Include relevant structured sections and never provide a definitive medical diagnosis or prescribe specific medication dosages."""

FOLLOWUP_QUERY_TEMPLATE = """{profile_block}{history_block}{context_notes}
The user shared a brief or general concern:
\"\"\"{user_message}\"\"\"

Acknowledge their concern empathetically, provide helpful general health information with uncertainty language, and ask 2-3 focused, respectful clarifying questions (such as duration, severity, or accompanying symptoms) to help give more tailored guidance."""

IMAGE_ANALYSIS_TEMPLATE = """{profile_block}The user uploaded a health-related image and asked:
\"\"\"{question}\"\"\"

Provide educational, non-diagnostic observations about the image following these strict rules:
1. NEVER claim to diagnose cancer, melanoma, fractures, infections, or any medical condition from a photo.
2. If the image is blurry, dark, low-resolution, or unclear, state that honestly and explain how better lighting/focus helps — still advise professional in-person evaluation.
3. Describe general visual characteristics cautiously using uncertainty language ("appears", "could potentially", "may").
4. Provide safe general next steps, precautions, when to see a doctor, and emergency warning signs.
5. Remind the user that visual inspection via photo cannot replace an in-person clinical exam."""

HEALTH_SUMMARY_TEMPLATE = """{profile_block}Below is a structured overview of the user's recent logged health records:

{records_block}

Please provide a clear, encouraging, educational Health Information Summary organized into:
- Overview of Recent Entries
- Notable Patterns or Observations (using cautious language: "may", "appears")
- General Wellness & Tracking Tips
- Questions to Consider Discussing with a Doctor
- When to Seek Medical Attention

Do NOT diagnose any condition or prescribe any treatment. Include a clear medical disclaimer."""


def _calculate_age(dob_value: Any) -> Optional[int]:
    """Compute age in years from a date or ISO date string."""
    if not dob_value:
        return None
    dob: Optional[date] = None
    if isinstance(dob_value, datetime):
        dob = dob_value.date()
    elif isinstance(dob_value, date):
        dob = dob_value
    elif isinstance(dob_value, str):
        try:
            dob = date.fromisoformat(dob_value[:10])
        except ValueError:
            return None
    if dob is None:
        return None
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age if 0 <= age <= 130 else None


class PromptBuilder:
    """Builds sanitized, context-aware prompts for different health AI workflows."""

    def build_profile_context(self, user_profile: Optional[dict[str, Any]]) -> str:
        """Build a concise, sanitized profile context block (age, conditions, allergies)."""
        if not user_profile or not isinstance(user_profile, dict):
            return ""

        parts: list[str] = []
        age = _calculate_age(user_profile.get("date_of_birth"))
        if age is not None:
            parts.append(f"Age: {age}")

        gender = user_profile.get("gender")
        if gender and gender != "prefer_not_to_say":
            parts.append(f"Gender: {sanitize_text(str(gender), max_length=40)}")

        conditions = user_profile.get("medical_conditions") or []
        if isinstance(conditions, list) and conditions:
            clean_conditions = [
                sanitize_text(str(c), max_length=80) for c in conditions[:15] if str(c).strip()
            ]
            if clean_conditions:
                parts.append(f"Known conditions: {', '.join(clean_conditions)}")

        allergies = user_profile.get("allergies") or []
        if isinstance(allergies, list) and allergies:
            clean_allergies = [
                sanitize_text(str(a), max_length=80) for a in allergies[:15] if str(a).strip()
            ]
            if clean_allergies:
                parts.append(f"Known allergies: {', '.join(clean_allergies)}")

        if not parts:
            return ""

        return "User background context (self-reported):\n- " + "\n- ".join(parts) + "\n\n"

    def build_history_context(
        self,
        history: Optional[list[dict[str, Any]]],
        max_messages: int = 8,
    ) -> str:
        """Format recent conversation messages into a bounded context snippet."""
        if not history:
            return ""

        recent = history[-max_messages:]
        lines: list[str] = []
        for msg in recent:
            role = str(msg.get("role", "user")).lower()
            if role not in ("user", "assistant"):
                continue
            label = "User" if role == "user" else "Assistant"
            content = sanitize_text(str(msg.get("content", "")), max_length=600)
            if content:
                lines.append(f"{label}: {content}")

        if not lines:
            return ""

        return "Recent conversation context:\n" + "\n".join(lines) + "\n\n"

    def build_health_query_prompt(
        self,
        user_message: str,
        conversation_history: Optional[list[dict[str, Any]]] = None,
        user_profile: Optional[dict[str, Any]] = None,
        detected_symptoms: Optional[list[str]] = None,
        needs_followup: bool = False,
        has_previous_interaction: bool = False,
    ) -> str:
        """Build the prompt for a health chat turn."""
        clean_message = sanitize_text(user_message, max_length=4000)
        profile_block = self.build_profile_context(user_profile)
        # When continuing an Interactions API thread via previous_interaction_id,
        # keep history minimal to avoid redundant token usage.
        history_block = (
            ""
            if has_previous_interaction
            else self.build_history_context(conversation_history)
        )

        context_notes = ""
        if detected_symptoms:
            clean_symptoms = [sanitize_text(s, max_length=60) for s in detected_symptoms[:10]]
            context_notes = f"Symptoms mentioned so far: {', '.join(clean_symptoms)}\n\n"

        template = FOLLOWUP_QUERY_TEMPLATE if needs_followup else HEALTH_QUERY_TEMPLATE
        return template.format(
            profile_block=profile_block,
            history_block=history_block,
            context_notes=context_notes,
            user_message=clean_message,
        )

    def build_image_analysis_prompt(
        self,
        question: str,
        user_profile: Optional[dict[str, Any]] = None,
    ) -> str:
        """Build the prompt for multimodal health image analysis."""
        clean_question = sanitize_text(question, max_length=1500)
        profile_block = self.build_profile_context(user_profile)
        return IMAGE_ANALYSIS_TEMPLATE.format(
            profile_block=profile_block,
            question=clean_question,
        )

    def build_health_summary_prompt(
        self,
        records: list[dict[str, Any]],
        user_profile: Optional[dict[str, Any]] = None,
    ) -> str:
        """Build the prompt for summarizing recent user health records."""
        profile_block = self.build_profile_context(user_profile)
        lines: list[str] = []
        for rec in records[:30]:
            rec_type = sanitize_text(str(rec.get("record_type", "note")), max_length=40)
            recorded_at = str(rec.get("recorded_at", ""))[:19]
            data = rec.get("data") or {}
            if isinstance(data, dict):
                pairs = [
                    f"{sanitize_text(str(k), max_length=40)}: {sanitize_text(str(v), max_length=120)}"
                    for k, v in list(data.items())[:10]
                ]
                data_str = "; ".join(pairs)
            else:
                data_str = sanitize_text(str(data), max_length=200)
            lines.append(f"- [{recorded_at}] ({rec_type}) {data_str}")

        records_block = "\n".join(lines) if lines else "No recent records available."
        return HEALTH_SUMMARY_TEMPLATE.format(
            profile_block=profile_block,
            records_block=records_block,
        )


prompt_builder = PromptBuilder()
