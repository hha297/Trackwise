"""Nutrition normalization — bases, units, sodium/salt. Never coerce missing → 0."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Literal

ValueStatus = Literal["missing", "zero", "measured"]
Basis = Literal["per_100g", "per_100ml", "per_serving"]


@dataclass(frozen=True, slots=True)
class NutrientFact:
    nutrient_code: str
    basis: Basis
    value: Decimal | None
    value_status: ValueStatus
    unit: str
    source_field: str | None = None


def _to_decimal(raw: object) -> Decimal | None:
    if raw is None:
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None


def classify_value(raw: object) -> tuple[Decimal | None, ValueStatus]:
    """Map a source numeric to (value, status). Missing stays None — never 0."""
    if raw is None or raw == "":
        return None, "missing"
    value = _to_decimal(raw)
    if value is None:
        return None, "missing"
    if value == 0:
        return Decimal("0"), "zero"
    return value, "measured"


def sodium_g_to_mg(sodium_g: Decimal | None, status: ValueStatus) -> tuple[Decimal | None, ValueStatus]:
    """OFF sodium_100g / sodium_serving are in grams. Convert to milligrams once."""
    if status == "missing" or sodium_g is None:
        return None, "missing"
    if status == "zero":
        return Decimal("0"), "zero"
    return (sodium_g * Decimal("1000")), "measured"


def salt_g_from_sodium_mg(sodium_mg: Decimal | None, status: ValueStatus) -> tuple[Decimal | None, ValueStatus]:
    """salt_g ≈ sodium_mg / 1000 * 2.5."""
    if status == "missing" or sodium_mg is None:
        return None, "missing"
    if status == "zero":
        return Decimal("0"), "zero"
    return (sodium_mg / Decimal("1000") * Decimal("2.5")), "measured"


def sodium_mg_from_salt_g(salt_g: Decimal | None, status: ValueStatus) -> tuple[Decimal | None, ValueStatus]:
    if status == "missing" or salt_g is None:
        return None, "missing"
    if status == "zero":
        return Decimal("0"), "zero"
    return (salt_g / Decimal("2.5") * Decimal("1000")), "measured"


OFF_NUTRIENT_MAP: dict[str, tuple[str, str]] = {
    # off_key -> (nutrient_code, unit) for per-100g fields already in target unit
    "energy-kcal_100g": ("energy_kcal", "kcal"),
    "energy-kj_100g": ("energy_kj", "kJ"),
    "proteins_100g": ("protein_g", "g"),
    "carbohydrates_100g": ("carbohydrates_g", "g"),
    "fat_100g": ("fat_g", "g"),
    "saturated-fat_100g": ("saturated_fat_g", "g"),
    "sugars_100g": ("sugars_g", "g"),
    "fiber_100g": ("fiber_g", "g"),
    "salt_100g": ("salt_g", "g"),
}


def facts_from_off_nutriments(nutriments: dict[str, object], *, basis: Basis = "per_100g") -> list[NutrientFact]:
    """Extract canonical facts from an OFF nutriments object."""
    facts: list[NutrientFact] = []
    for off_key, (code, unit) in OFF_NUTRIENT_MAP.items():
        value, status = classify_value(nutriments.get(off_key))
        facts.append(
            NutrientFact(
                nutrient_code=code,
                basis=basis,
                value=value,
                value_status=status,
                unit=unit,
                source_field=off_key,
            )
        )

    # Sodium: OFF stores grams under sodium_100g — convert to mg (do not double-convert).
    sodium_raw, sodium_status = classify_value(nutriments.get("sodium_100g"))
    sodium_mg, sodium_mg_status = sodium_g_to_mg(sodium_raw, sodium_status)
    facts.append(
        NutrientFact(
            nutrient_code="sodium_mg",
            basis=basis,
            value=sodium_mg,
            value_status=sodium_mg_status,
            unit="mg",
            source_field="sodium_100g",
        )
    )
    return facts
