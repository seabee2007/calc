#!/usr/bin/env python3
"""Promote normalized records between pipeline workflow folders."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from config import (
    AI_REVIEWED_JSON_DIR,
    APPROVED_JSON_DIR,
    NEEDS_REVIEW_JSON_DIR,
    QA_STATUSES,
    REJECTED_JSON_DIR,
    REVIEWED_JSON_DIR,
)
from text_utils import utc_now_iso
from validate_production_rates import validate_file

STAGE_DIRS = {
    "needs_review": NEEDS_REVIEW_JSON_DIR,
    "ai_reviewed": AI_REVIEWED_JSON_DIR,
    "reviewed": REVIEWED_JSON_DIR,
    "approved": APPROVED_JSON_DIR,
    "rejected": REJECTED_JSON_DIR,
}


def promote_file(
    source: Path,
    destination_dir: Path,
    *,
    target_status: str,
    reviewed_by: str | None = None,
) -> Path:
    payload = json.loads(source.read_text(encoding="utf-8"))
    now = utc_now_iso()
    for record in payload.get("records", []):
        record["qaStatus"] = target_status
        record["updatedAt"] = now
        if target_status == "approved":
            record["extractionWarnings"] = []

    payload.setdefault("batchMeta", {})
    payload["batchMeta"]["promotedAt"] = date.today().isoformat()
    if reviewed_by:
        payload["batchMeta"]["reviewedBy"] = reviewed_by
        if target_status == "approved":
            payload["batchMeta"]["approvedBy"] = reviewed_by

    destination_dir.mkdir(parents=True, exist_ok=True)
    stem = source.stem.replace(".raw", "").replace(".needs_review", "").replace(".reviewed", "")
    out_path = destination_dir / f"{stem}.{target_status}.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    result = validate_file(out_path, expected_status=target_status)
    if not result["valid"]:
        out_path.unlink(missing_ok=True)
        raise ValueError(json.dumps(result["errors"][:5], indent=2))

    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Source JSON file")
    parser.add_argument("--stage", choices=list(STAGE_DIRS.keys()), required=True)
    parser.add_argument("--reviewed-by", default="", help="Reviewer name")
    args = parser.parse_args()

    if args.stage not in QA_STATUSES:
        raise SystemExit(f"Invalid stage: {args.stage}")

    out_path = promote_file(
        args.source,
        STAGE_DIRS[args.stage],
        target_status=args.stage,
        reviewed_by=args.reviewed_by or None,
    )
    print(f"Promoted {args.source} -> {out_path}")


if __name__ == "__main__":
    main()
