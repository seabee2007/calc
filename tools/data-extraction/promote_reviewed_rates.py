#!/usr/bin/env python3
"""Human-only promotion of AI-reviewed or reviewed records to approved."""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

from config import (
    AI_REVIEWED_JSON_DIR,
    APPROVED_JSON_DIR,
    REJECTED_JSON_DIR,
    REVIEWED_JSON_DIR,
)
from text_utils import clean_figure_title, utc_now_iso
from validate_production_rates import validate_file, validate_record

DOT_LEADER_RE = re.compile(r"\.{4,}")

SOURCE_DIRS = {
    "ai-reviewed": AI_REVIEWED_JSON_DIR,
    "reviewed": REVIEWED_JSON_DIR,
}


def normalize_figure_arg(value: str) -> str:
    stem = value.strip()
    for suffix in (".json", ".ai_reviewed", ".reviewed", ".approved"):
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
    return stem


def resolve_source_files(
    *,
    source_dir: Path,
    division: str | None,
    figure: str | None,
) -> list[Path]:
    files = sorted(source_dir.glob("*.json"))
    if not files:
        raise SystemExit(f"No JSON files found in {source_dir}")

    selected: list[Path] = []
    figure_stem = normalize_figure_arg(figure) if figure else None

    for path in files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        batch_meta = payload.get("batchMeta", {})
        record_division = batch_meta.get("division") or (
            payload.get("records", [{}])[0].get("division") if payload.get("records") else None
        )
        stem = path.stem.replace(".ai_reviewed", "").replace(".reviewed", "")
        if division and record_division != division:
            continue
        if figure_stem and stem != figure_stem:
            continue
        selected.append(path)

    if not selected:
        raise SystemExit("No files matched the provided filters.")
    return selected


def approval_blockers(record: dict, *, allow_warnings: bool) -> list[str]:
    blockers: list[str] = []
    figure_title = record.get("figureTitle") or ""
    if DOT_LEADER_RE.search(figure_title):
        blockers.append("figureTitle contains dot leaders")
    cleaned_title = clean_figure_title(figure_title)
    if cleaned_title != figure_title.strip():
        blockers.append("figureTitle is not clean")
    if record.get("sourcePdfPage") is None:
        blockers.append("missing sourcePdfPage")
    unit = (record.get("unitOfMeasure") or "").strip().lower()
    if unit == "surface":
        blockers.append('unitOfMeasure cannot be "surface"')
    warnings = record.get("extractionWarnings") or []
    if warnings and not allow_warnings:
        blockers.append(f"extractionWarnings present ({len(warnings)})")
    return blockers


def promote_to_approved(
    source: Path,
    *,
    allow_warnings: bool,
    reviewed_by: str | None,
) -> Path:
    payload = json.loads(source.read_text(encoding="utf-8"))
    now = utc_now_iso()
    blockers_by_id: dict[str, list[str]] = {}

    for record in payload.get("records", []):
        record["figureTitle"] = clean_figure_title(record.get("figureTitle") or "")
        blockers = approval_blockers(record, allow_warnings=allow_warnings)
        validation = validate_record(record)
        blockers.extend(validation["errors"])
        if blockers:
            blockers_by_id[str(record.get("id"))] = blockers

    if blockers_by_id:
        sample = list(blockers_by_id.items())[:3]
        details = "\n".join(f"  - {record_id}: {issues[0]}" for record_id, issues in sample)
        raise SystemExit(
            f"Refusing to approve {source.name}: {len(blockers_by_id)} record(s) blocked.\n{details}",
        )

    for record in payload.get("records", []):
        record["qaStatus"] = "approved"
        record["extractionWarnings"] = []
        record["updatedAt"] = now

    payload.setdefault("batchMeta", {})
    payload["batchMeta"]["approvedAt"] = date.today().isoformat()
    if reviewed_by:
        payload["batchMeta"]["approvedBy"] = reviewed_by

    stem = source.stem.replace(".ai_reviewed", "").replace(".reviewed", "")
    APPROVED_JSON_DIR.mkdir(parents=True, exist_ok=True)
    out_path = APPROVED_JSON_DIR / f"{stem}.approved.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    result = validate_file(out_path, expected_status="approved")
    if not result["valid"]:
        out_path.unlink(missing_ok=True)
        raise SystemExit(f"Approved validation failed for {out_path.name}")

    return out_path


def promote_to_reviewed(source: Path, *, reviewed_by: str | None) -> Path:
    payload = json.loads(source.read_text(encoding="utf-8"))
    now = utc_now_iso()
    for record in payload.get("records", []):
        record["qaStatus"] = "reviewed"
        record["updatedAt"] = now

    payload.setdefault("batchMeta", {})
    payload["batchMeta"]["reviewedAt"] = date.today().isoformat()
    if reviewed_by:
        payload["batchMeta"]["reviewedBy"] = reviewed_by

    stem = source.stem.replace(".ai_reviewed", "")
    REVIEWED_JSON_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REVIEWED_JSON_DIR / f"{stem}.reviewed.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    result = validate_file(out_path, expected_status="reviewed")
    if not result["valid"]:
        out_path.unlink(missing_ok=True)
        raise SystemExit(f"Reviewed validation failed for {out_path.name}")

    return out_path


def reject_file(source: Path, *, reviewed_by: str | None) -> Path:
    payload = json.loads(source.read_text(encoding="utf-8"))
    now = utc_now_iso()
    for record in payload.get("records", []):
        record["qaStatus"] = "rejected"
        record["updatedAt"] = now

    payload.setdefault("batchMeta", {})
    payload["batchMeta"]["rejectedAt"] = date.today().isoformat()
    if reviewed_by:
        payload["batchMeta"]["rejectedBy"] = reviewed_by

    stem = source.stem.replace(".ai_reviewed", "").replace(".reviewed", "")
    REJECTED_JSON_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REJECTED_JSON_DIR / f"{stem}.rejected.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--division", help="CSI division code filter (e.g. 03)")
    parser.add_argument("--figure", help="Figure stem filter (e.g. figure_5_C_7)")
    parser.add_argument(
        "--from",
        dest="from_stage",
        choices=list(SOURCE_DIRS.keys()),
        default="ai-reviewed",
        help="Source workflow folder",
    )
    parser.add_argument("--approve", action="store_true", help="Promote to approved (human sign-off)")
    parser.add_argument("--mark-reviewed", action="store_true", help="Promote ai-reviewed to reviewed")
    parser.add_argument("--reject", action="store_true", help="Move records to rejected")
    parser.add_argument(
        "--allow-warnings",
        action="store_true",
        help="Allow approval when extractionWarnings are present",
    )
    parser.add_argument("--reviewed-by", default="", help="Reviewer name for audit metadata")
    args = parser.parse_args()

    if not args.approve and not args.mark_reviewed and not args.reject:
        raise SystemExit("Specify --approve, --mark-reviewed, or --reject")

    source_dir = SOURCE_DIRS[args.from_stage]
    files = resolve_source_files(
        source_dir=source_dir,
        division=args.division,
        figure=args.figure,
    )

    reviewed_by = args.reviewed_by or None
    for path in files:
        if args.approve:
            out = promote_to_approved(path, allow_warnings=args.allow_warnings, reviewed_by=reviewed_by)
            print(f"Approved {path.name} -> {out}")
        elif args.mark_reviewed:
            out = promote_to_reviewed(path, reviewed_by=reviewed_by)
            print(f"Marked reviewed {path.name} -> {out}")
        elif args.reject:
            out = reject_file(path, reviewed_by=reviewed_by)
            print(f"Rejected {path.name} -> {out}")


if __name__ == "__main__":
    main()
