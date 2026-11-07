"""Barcode normalization helpers."""

from __future__ import annotations

import re

_NON_DIGIT = re.compile(r"[^0-9]")


def normalize_barcode(raw: str | None) -> str | None:
    if raw is None:
        return None
    digits = _NON_DIGIT.sub("", raw.strip())
    if not digits:
        return None
    return digits


def is_plausible_gtin(normalized: str | None) -> bool:
    if not normalized:
        return False
    return len(normalized) in {8, 12, 13, 14}
