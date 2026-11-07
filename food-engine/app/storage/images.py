"""Image validation and safe normalization (no AI packaging generation)."""

from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass
from typing import Literal

from PIL import Image, ImageOps, UnidentifiedImageError

ImageLifecycle = Literal[
    "downloaded",
    "candidate",
    "processing",
    "pending_review",
    "approved",
    "rejected",
    "archived",
]


@dataclass(frozen=True, slots=True)
class ImageValidationResult:
    ok: bool
    content_type: str | None
    width: int | None
    height: int | None
    content_hash: str | None
    technical_score: float
    identity_confidence: float
    normalized_webp: bytes | None
    error: str | None = None


_ALLOWED = {
    "image/jpeg": ("jpeg", "jpg"),
    "image/png": ("png",),
    "image/webp": ("webp",),
}


def sniff_image_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[0:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_and_normalize(
    data: bytes,
    *,
    max_bytes: int,
    min_dim: int,
    max_dim: int,
    declared_content_type: str | None = None,
    identity_confidence: float = 0.0,
) -> ImageValidationResult:
    if len(data) == 0:
        return ImageValidationResult(False, None, None, None, None, 0.0, 0.0, None, "empty")
    if len(data) > max_bytes:
        return ImageValidationResult(
            False, None, None, None, None, 0.0, 0.0, None, "too_large"
        )

    sniffed = sniff_image_type(data)
    if sniffed is None:
        return ImageValidationResult(
            False, None, None, None, None, 0.0, 0.0, None, "unsupported_signature"
        )
    if declared_content_type and declared_content_type not in _ALLOWED:
        return ImageValidationResult(
            False, sniffed, None, None, None, 0.0, 0.0, None, "unsupported_declared_type"
        )

    try:
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)
            width, height = img.size
            if width < min_dim or height < min_dim:
                return ImageValidationResult(
                    False, sniffed, width, height, None, 0.0, identity_confidence, None, "too_small"
                )
            if width > max_dim or height > max_dim:
                img.thumbnail((max_dim, max_dim))
                width, height = img.size
            if img.mode not in {"RGB", "RGBA"}:
                img = img.convert("RGB")
            elif img.mode == "RGBA":
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background

            out = io.BytesIO()
            img.save(out, format="WEBP", quality=85, method=4)
            normalized = out.getvalue()
    except UnidentifiedImageError:
        return ImageValidationResult(
            False, sniffed, None, None, None, 0.0, 0.0, None, "decode_failed"
        )
    except OSError as exc:
        return ImageValidationResult(
            False, sniffed, None, None, None, 0.0, 0.0, None, f"decode_error:{exc}"
        )

    content_hash = hashlib.sha256(data).hexdigest()
    # Simple technical score from resolution / size
    tech = min(1.0, (width * height) / (800 * 800))
    return ImageValidationResult(
        ok=True,
        content_type="image/webp",
        width=width,
        height=height,
        content_hash=content_hash,
        technical_score=round(tech, 4),
        identity_confidence=identity_confidence,
        normalized_webp=normalized,
        error=None,
    )
