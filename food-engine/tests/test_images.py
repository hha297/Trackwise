from __future__ import annotations

import io

from PIL import Image

from app.storage.images import sniff_image_type, validate_and_normalize


def _png_bytes(w: int = 200, h: int = 200) -> bytes:
    img = Image.new("RGB", (w, h), color=(20, 120, 40))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_sniff_png() -> None:
    data = _png_bytes()
    assert sniff_image_type(data) == "image/png"


def test_validate_normalizes_to_webp() -> None:
    result = validate_and_normalize(
        _png_bytes(),
        max_bytes=2_000_000,
        min_dim=50,
        max_dim=1024,
        identity_confidence=0.7,
    )
    assert result.ok
    assert result.content_type == "image/webp"
    assert result.normalized_webp is not None
    assert result.normalized_webp[:4] == b"RIFF"


def test_reject_tiny_image() -> None:
    result = validate_and_normalize(
        _png_bytes(10, 10),
        max_bytes=2_000_000,
        min_dim=50,
        max_dim=1024,
    )
    assert not result.ok
    assert result.error == "too_small"
