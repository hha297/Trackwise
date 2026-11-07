"""Static review of Phase 4 migration SQL (not applied)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20261107120000_food_intelligence_phase4_ingestion.sql"


def test_phase4_migration_file_exists() -> None:
    assert MIGRATION.is_file()


def test_phase4_migration_is_additive() -> None:
    raw = MIGRATION.read_text(encoding="utf-8")
    # Strip SQL line comments before destructive-keyword checks.
    code = "\n".join(
        line for line in raw.splitlines() if not line.lstrip().startswith("--")
    ).lower()
    assert "drop table" not in code
    assert "truncate" not in code
    assert "add column if not exists raw_payload" in code
    assert "fineli" in code and "usda" in code
    assert "partial" in code
    assert "food_source_observations_content_hash_uidx" in code
    # Phase 4.2: no redundant non-unique twin of the unique content-hash index.
    assert "food_source_observations_content_hash_idx" not in code
    assert "create index concurrent" not in code
    # Prior source values preserved in replacement check
    assert "manual" in code and "open_food_facts" in code and "system" in code


def test_phase4_migration_documents_duplicate_precheck_and_fks() -> None:
    text = MIGRATION.read_text(encoding="utf-8")
    assert "Pre-check" in text or "pre-check" in text or "Before unique index" in text
    assert "Rollback" in text or "rollback" in text
    assert "food_observation_links" in text
    assert "Transaction safety" in text or "transaction" in text.lower()
