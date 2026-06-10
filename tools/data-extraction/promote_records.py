#!/usr/bin/env python3
"""Promote extracted records between raw, reviewed, and approved workflow folders."""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import date
from pathlib import Path

from config import APPROVED_JSON_DIR, RAW_JSON_DIR, REVIEWED_JSON_DIR
from validate_records import validate_file


def promote_file(source: Path, destination_dir: Path, *, target_confidence: str, reviewed_by: str | None = None) -> Path:
    payload = json.loads(source.read_text(encoding="utf-8"))
    for record in payload.get("records", []):
        record["confidence"] = target_confidence

    payload.setdefault("batchMeta", {})
    payload["batchMeta"]["promotedAt"] = date.today().isoformat()
    if reviewed_by:
        payload["batchMeta"]["reviewedBy"] = reviewed_by

    temp_path = source.with_suffix(".promote.tmp.json")
    temp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    try:
        allow_confidence = {target_confidence}
        validation = validate_file(temp_path, allow_confidence=allow_confidence)
        if not validation["valid"]:
            raise ValueError(json.dumps(validation["errors"][:5], indent=2))
    finally:
        temp_path.unlink(missing_ok=True)

    destination_dir.mkdir(parents=True, exist_ok=True)
    suffix = source.name.replace(".raw.json", "").replace(".reviewed.json", "").replace(".approved.json", "")
    out_name = f"{suffix}.{target_confidence}.json"
    out_path = destination_dir / out_name
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Source JSON file")
    parser.add_argument(
        "--stage",
        choices=["reviewed", "approved"],
        required=True,
        help="Target workflow stage",
    )
    parser.add_argument("--reviewed-by", default="", help="Reviewer name for reviewed/approved batches")
    args = parser.parse_args()

    allow_confidence = {"reviewed"} if args.stage == "reviewed" else {"approved"}
    out_path = promote_file(
        args.source,
        REVIEWED_JSON_DIR if args.stage == "reviewed" else APPROVED_JSON_DIR,
        target_confidence=args.stage,
        reviewed_by=args.reviewed_by or None,
    )
    print(f"Promoted {args.source} -> {out_path}")


if __name__ == "__main__":
    main()
