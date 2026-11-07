from __future__ import annotations

from app.domain.barcodes import is_plausible_gtin, normalize_barcode
from app.domain.duplicates import MatchSignals, decide_match
from app.domain.names import display_name_preserved, normalize_search_name


def test_normalize_barcode_digits() -> None:
    assert normalize_barcode(" 12-345 ") == "12345"
    assert normalize_barcode("abc") is None


def test_plausible_gtin() -> None:
    assert is_plausible_gtin("3017620422003")
    assert not is_plausible_gtin("123")


def test_name_preserves_brand_case() -> None:
    assert display_name_preserved("  Coca-Cola  Zero  ") == "Coca-Cola Zero"
    assert normalize_search_name("Coca-Cola Zero") == "coca-cola zero"


def test_duplicate_barcode_is_exact() -> None:
    d = decide_match(
        MatchSignals(
            barcode_equal=True,
            source_external_equal=False,
            brand_equal=False,
            name_equal=False,
            package_hint_equal=False,
        )
    )
    assert d.decision == "exact"


def test_name_only_is_uncertain() -> None:
    d = decide_match(
        MatchSignals(
            barcode_equal=False,
            source_external_equal=False,
            brand_equal=False,
            name_equal=True,
            package_hint_equal=False,
        )
    )
    assert d.decision == "uncertain"
