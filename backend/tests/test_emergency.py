"""Tests for deterministic emergency screening across all 9 categories and false positives."""

import pytest

from app.services.emergency_service import screen_for_emergency


class TestEmergencyCategories:
    @pytest.mark.parametrize(
        "message,expected_category",
        [
            ("I am having crushing chest pain radiating to my left arm and sweating", "cardiac"),
            ("My father might be having a heart attack right now", "cardiac"),
            ("I can't breathe and my lips are turning blue", "respiratory"),
            ("My child is choking and gasping for air", "respiratory"),
            ("My mother has sudden face drooping and slurred speech", "neurological"),
            ("He is having a seizure right now with convulsions", "neurological"),
            ("My throat is closing up and my tongue is swollen from an allergic reaction", "allergic"),
            ("I think this is anaphylaxis after eating peanuts", "allergic"),
            ("My friend collapsed and is unconscious and won't wake up", "consciousness"),
            ("There is severe bleeding from my leg and it won't stop bleeding", "bleeding"),
            ("I started vomiting blood ten minutes ago", "bleeding"),
            ("My toddler swallowed bleach from under the sink", "poisoning"),
            ("Someone was bitten by a venomous snake, snakebite on ankle", "poisoning"),
            ("Severe head injury after a car accident with a deep wound", "trauma"),
            ("I feel hopeless and I want to kill myself tonight", "mental_health"),
            ("I am having suicidal thoughts and don't want to live anymore", "mental_health"),
            ("Mere chhati me dard ho raha hai", "cardiac"),
            ("Enaku nenju vali romba athigama iruku", "cardiac"),
            ("Mujhe saas nahi aa rahi hai", "respiratory"),
            ("Moochu thinaral erpadugirathu", "respiratory"),
            ("Main atmahatya karna chahta hoon", "mental_health"),
        ],
    )
    def test_detects_all_emergency_categories(
        self, message: str, expected_category: str
    ) -> None:
        result = screen_for_emergency(message)
        assert result.is_emergency is True
        assert result.category == expected_category
        assert result.severity == "critical"
        assert "112" in result.response
        assert "108" in result.response
        assert "9152987821" in result.response

    def test_mental_health_response_is_compassionate_and_has_aasra(self) -> None:
        result = screen_for_emergency("I am feeling suicidal and thinking of ending my life")
        assert result.is_emergency is True
        assert result.category == "mental_health"
        assert "AASRA" in result.response
        assert "9152987821" in result.response
        assert "not alone" in result.response.lower()


class TestEmergencyFalsePositivesAndEdgeCases:
    @pytest.mark.parametrize(
        "message",
        [
            "I have a mild headache since this morning",
            "I got a mild tension headache from staring at my laptop",
            "I have a runny nose and slight sore throat",
            "My stomach feels a bit bloated after dinner",
            "I got a tiny paper cut on my finger",
            "I have chest workout muscle soreness after bench press at the gym",
            "I am out of breath after running 5km today",
            "I have a slight fever of 99.5F and feel tired",
            "I have no chest pain and no shortness of breath, just a mild cough",
            "I am not suicidal, just stressed about exams",
            "My knee aches slightly when walking up stairs",
        ],
    )
    def test_non_emergency_messages_do_not_trigger_false_positive(self, message: str) -> None:
        result = screen_for_emergency(message)
        assert result.is_emergency is False
        assert result.category is None
        assert result.severity == "none"

    @pytest.mark.parametrize("empty_input", ["", "   ", "\n\t"])
    def test_empty_and_whitespace_inputs(self, empty_input: str) -> None:
        result = screen_for_emergency(empty_input)
        assert result.is_emergency is False
