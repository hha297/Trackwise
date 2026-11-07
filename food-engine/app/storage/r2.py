"""Cloudflare R2 S3-compatible client — public vs private bucket separation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import BinaryIO, Literal

import boto3
from botocore.client import BaseClient
from botocore.config import Config

from app.core.config import Settings

logger = logging.getLogger(__name__)

BucketKind = Literal["public", "private"]


@dataclass(frozen=True, slots=True)
class StoredObject:
    bucket: str
    key: str
    content_type: str
    size: int
    etag: str | None
    public_url: str | None


class R2Storage:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._public = self._client(
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
        )
        self._private = self._client(
            settings.r2_private_access_key_id,
            settings.r2_private_secret_access_key,
        )

    def _client(self, key_id: str | None, secret: str | None) -> BaseClient | None:
        if not self._settings.r2_endpoint or not key_id or not secret:
            return None
        return boto3.client(
            "s3",
            endpoint_url=self._settings.r2_endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=secret,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    def ensure_private_bucket(self) -> bool:
        """Create private bucket if missing. Returns True if bucket exists/usable."""
        client = self._private
        if client is None:
            return False
        name = self._settings.r2_private_bucket
        try:
            client.head_bucket(Bucket=name)
            logger.info("r2_private_bucket_exists name=%s", name)
            return True
        except Exception as head_exc:
            logger.info(
                "r2_private_bucket_head_miss name=%s err=%s",
                name,
                type(head_exc).__name__,
            )
        try:
            client.create_bucket(Bucket=name)
            try:
                client.put_public_access_block(
                    Bucket=name,
                    PublicAccessBlockConfiguration={
                        "BlockPublicAcls": True,
                        "IgnorePublicAcls": True,
                        "BlockPublicPolicy": True,
                        "RestrictPublicBuckets": True,
                    },
                )
            except Exception:
                logger.warning("r2_public_access_block_unsupported name=%s", name)
            logger.info("r2_private_bucket_created name=%s", name)
            return True
        except Exception as create_exc:
            logger.error(
                "r2_private_bucket_create_failed name=%s err=%s — create via Cloudflare dashboard",
                name,
                type(create_exc).__name__,
            )
            return False

    def put_bytes(
        self,
        *,
        kind: BucketKind,
        key: str,
        body: bytes,
        content_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredObject:
        if kind == "public":
            client = self._public
            bucket = self._settings.r2_public_bucket
            if client is None:
                raise RuntimeError("Public R2 client not configured")
        else:
            client = self._private
            bucket = self._settings.r2_private_bucket
            if client is None:
                raise RuntimeError("Private R2 client not configured")

        extra: dict[str, object] = {"ContentType": content_type}
        if metadata:
            extra["Metadata"] = metadata
        resp = client.put_object(Bucket=bucket, Key=key, Body=body, **extra)
        public_url = None
        if kind == "public":
            public_url = f"{self._settings.r2_public_url.rstrip('/')}/{key}"
        return StoredObject(
            bucket=bucket,
            key=key,
            content_type=content_type,
            size=len(body),
            etag=resp.get("ETag"),
            public_url=public_url,
        )

    def get_bytes(self, *, kind: BucketKind, key: str) -> bytes:
        client = self._public if kind == "public" else self._private
        bucket = (
            self._settings.r2_public_bucket
            if kind == "public"
            else self._settings.r2_private_bucket
        )
        if client is None:
            raise RuntimeError("R2 client not configured")
        obj = client.get_object(Bucket=bucket, Key=key)
        stream: BinaryIO = obj["Body"]
        return stream.read()

    def head_exists(self, *, kind: BucketKind, key: str) -> bool:
        client = self._public if kind == "public" else self._private
        bucket = (
            self._settings.r2_public_bucket
            if kind == "public"
            else self._settings.r2_private_bucket
        )
        if client is None:
            return False
        try:
            client.head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False
