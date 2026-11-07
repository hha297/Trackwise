"""Nutrition conversion unit tests — sodium grams → mg."""

from __future__ import annotations

from decimal import Decimal

from app.domain.nutrition import (
    classify_value,
    facts_from_off_nutriments,
    salt_g_from_sodium_mg,
    sodium_g_to_mg,
)


def test_missing_not_zero() -> None:
    value, status = classify_value(None)
    assert value is None
    assert status == "missing"


def test_zero_distinct_from_missing() -> None:
    value, status = classify_value(0)
    assert value == Decimal("0")
    assert status == "zero"


def test_off_sodium_grams_to_mg() -> None:
    # Known OFF defect: sodium_100g is grams, not milligrams.
    mg, status = sodium_g_to_mg(Decimal("0.5"), "measured")
    assert status == "measured"
    assert mg == Decimal("500")


def test_no_double_conversion_in_facts() -> None:
    facts = facts_from_off_nutriments({"sodium_100g": 0.4, "salt_100g": 1.0})
    sodium = next(f for f in facts if f.nutrient_code == "sodium_mg")
    salt = next(f for f in facts if f.nutrient_code == "salt_g")
    assert sodium.value == Decimal("400")
    assert sodium.unit == "mg"
    assert salt.value == Decimal("1.0")
    assert salt.unit == "g"


def test_salt_from_sodium_mg() -> None:
    salt, status = salt_g_from_sodium_mg(Decimal("400"), "measured")
    assert status == "measured"
    assert salt == Decimal("1.0")
