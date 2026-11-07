"""Mapped nutrition facts for Fineli/USDA-style dicts."""

from __future__ import annotations

from app.domain.nutrition import facts_from_mapped_nutrition


def test_mapped_nutrition_preserves_missing() -> None:
    facts = facts_from_mapped_nutrition({"protein_g": 1.5})
    by_code = {f.nutrient_code: f for f in facts}
    assert by_code["protein_g"].value_status == "measured"
    assert by_code["fat_g"].value_status == "missing"
    assert by_code["fat_g"].value is None


def test_mapped_nutrition_zero_is_zero() -> None:
    facts = facts_from_mapped_nutrition({"sodium_mg": 0})
    by_code = {f.nutrient_code: f for f in facts}
    assert by_code["sodium_mg"].value_status == "zero"
