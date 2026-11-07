"""Duplicate / match scoring — never merge on name similarity alone."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MatchSignals:
    barcode_equal: bool
    source_external_equal: bool
    brand_equal: bool
    name_equal: bool
    package_hint_equal: bool


@dataclass(frozen=True, slots=True)
class MatchDecision:
    decision: str  # exact | likely | uncertain | distinct
    confidence: float
    reason: str


def decide_match(signals: MatchSignals) -> MatchDecision:
    if signals.barcode_equal:
        return MatchDecision("exact", 0.99, "barcode_match")
    if signals.source_external_equal:
        return MatchDecision("exact", 0.97, "source_external_id")
    if signals.brand_equal and signals.name_equal and signals.package_hint_equal:
        return MatchDecision("likely", 0.8, "brand_name_package")
    if signals.brand_equal and signals.name_equal:
        return MatchDecision("uncertain", 0.55, "brand_name_only")
    if signals.name_equal:
        return MatchDecision("uncertain", 0.35, "name_only")
    return MatchDecision("distinct", 0.0, "no_strong_signal")
