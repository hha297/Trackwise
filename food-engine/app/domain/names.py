"""Locale-aware name helpers — never blind capitalize()."""

from __future__ import annotations

import re
import unicodedata

_WS = re.compile(r"\s+")


def normalize_search_name(original: str | None) -> str | None:
    """Lowercase NFKC fold for search — preserves digits/codes; does not title-case."""
    if original is None:
        return None
    text = unicodedata.normalize("NFKC", original).strip()
    if not text:
        return None
    text = _WS.sub(" ", text)
    return text.casefold()


def display_name_preserved(original: str | None) -> str | None:
    """Keep original brand/product casing for display."""
    if original is None:
        return None
    text = unicodedata.normalize("NFC", original).strip()
    text = _WS.sub(" ", text)
    return text or None
