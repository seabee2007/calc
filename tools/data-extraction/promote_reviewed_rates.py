#!/usr/bin/env python3
"""Human-only promotion of AI-reviewed or reviewed records to approved."""

from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from config import (
    AI_REVIEWED_JSON_DIR,
    ALL_DIVISION_CODES,
    APPROVED_JSON_DIR,
    REJECTED_JSON_DIR,
    REPORTS_DIR,
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


def file_division(path: Path, payload: dict[str, Any]) -> str | None:
    batch_meta = payload.get("batchMeta", {})
    division = batch_meta.get("division")
    if division:
        return str(division)
    records = payload.get("records") or []
    if records:
        return records[0].get("division")
    return None


def resolve_source_files(
    *,
    source_dir: Path,
    division: str | None,
    figure: str | None,
    divisions: tuple[str, ...] | None = None,
) -> list[Path]:
    if not source_dir.exists():
        return []

    files = sorted(source_dir.glob("*.json"))
    if not files:
        return []

    selected: list[Path] = []
    figure_stem = normalize_figure_arg(figure) if figure else None
    allowed_divisions = set(divisions) if divisions else None

    for path in files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        record_division = file_division(path, payload)
        stem = path.stem.replace(".ai_reviewed", "").replace(".reviewed", "")

        if allowed_divisions is not None:
            if record_division not in allowed_divisions:
                continue
        elif division and record_division != division:
            continue
        if figure_stem and stem != figure_stem:
            continue
        selected.append(path)

    return selected


def approval_blockers(record: dict[str, Any], *, allow_warnings: bool) -> list[str]:
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


def evaluate_record_for_approval(
    record: dict[str, Any],
    *,
    allow_warnings: bool,
) -> tuple[dict[str, Any] | None, list[str]]:
    cleaned = dict(record)
    cleaned["figureTitle"] = clean_figure_title(record.get("figureTitle") or "")
    blockers = approval_blockers(cleaned, allow_warnings=allow_warnings)
    validation = validate_record(cleaned)
    blockers.extend(validation["errors"])
    if blockers:
        return None, blockers
    return cleaned, []


def evaluate_file_for_approval(
    source: Path,
    *,
    allow_warnings: bool,
) -> dict[str, Any]:
    payload = json.loads(source.read_text(encoding="utf-8"))
    records = payload.get("records") or []
    division = file_division(source, payload)

    approved_records: list[dict[str, Any]] = []
    blocked_records: list[dict[str, Any]] = []

    for record in records:
        cleaned, blockers = evaluate_record_for_approval(record, allow_warnings=allow_warnings)
        if cleaned is None:
            blocked_records.append(
                {
                    "id": record.get("id"),
                    "activityName": record.get("activityName"),
                    "blockers": blockers,
                }
            )
        else:
            approved_records.append(cleaned)

    return {
        "source": source,
        "payload": payload,
        "division": division,
        "approved_records": approved_records,
        "blocked_records": blocked_records,
    }


def write_approved_file(
    evaluation: dict[str, Any],
    *,
    reviewed_by: str | None,
) -> Path:
    payload = evaluation["payload"]
    now = utc_now_iso()
    records = evaluation["approved_records"]

    for record in records:
        record["qaStatus"] = "approved"
        record["extractionWarnings"] = []
        record["updatedAt"] = now

    out_payload = dict(payload)
    out_payload["records"] = records
    out_payload.setdefault("batchMeta", {})
    out_payload["batchMeta"]["approvedAt"] = date.today().isoformat()
    if reviewed_by:
        out_payload["batchMeta"]["approvedBy"] = reviewed_by

    source: Path = evaluation["source"]
    stem = source.stem.replace(".ai_reviewed", "").replace(".reviewed", "")
    APPROVED_JSON_DIR.mkdir(parents=True, exist_ok=True)
    out_path = APPROVED_JSON_DIR / f"{stem}.approved.json"
    out_path.write_text(json.dumps(out_payload, indent=2), encoding="utf-8")

    result = validate_file(out_path, expected_status="approved")
    if not result["valid"]:
        out_path.unlink(missing_ok=True)
        raise SystemExit(f"Approved validation failed for {out_path.name}")

    return out_path


def promote_to_approved(
    source: Path,
    *,
    allow_warnings: bool,
    reviewed_by: str | None,
    partial: bool = False,
) -> Path | None:
    evaluation = evaluate_file_for_approval(source, allow_warnings=allow_warnings)

    if not evaluation["payload"].get("records"):
        return None

    if not evaluation["approved_records"]:
        if partial:
            return None
        blocked = evaluation["blocked_records"]
        sample = blocked[:3]
        details = "\n".join(
            f"  - {item.get('id')}: {item['blockers'][0]}" for item in sample if item.get("blockers")
        )
        raise SystemExit(
            f"Refusing to approve {source.name}: {len(blocked)} record(s) blocked.\n{details}",
        )

    if evaluation["blocked_records"] and not partial:
        blocked = evaluation["blocked_records"]
        sample = blocked[:3]
        details = "\n".join(
            f"  - {item.get('id')}: {item['blockers'][0]}" for item in sample if item.get("blockers")
        )
        raise SystemExit(
            f"Refusing to approve {source.name}: {len(blocked)} record(s) blocked.\n{details}",
        )

    return write_approved_file(evaluation, reviewed_by=reviewed_by)


def promote_all_divisions(
    *,
    source_dir: Path,
    allow_warnings: bool,
    reviewed_by: str | None,
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "sourceStage": source_dir.name,
        "allowWarnings": allow_warnings,
        "divisionsProcessed": list(ALL_DIVISION_CODES),
        "filesPromoted": 0,
        "recordsPromoted": 0,
        "filesSkipped": 0,
        "recordsBlocked": 0,
        "warningsByDivision": {code: 0 for code in ALL_DIVISION_CODES},
        "promotedFiles": [],
        "skippedFiles": [],
    }

    files = resolve_source_files(source_dir=source_dir, division=None, figure=None, divisions=ALL_DIVISION_CODES)

    for path in files:
        evaluation = evaluate_file_for_approval(path, allow_warnings=allow_warnings)
        records = evaluation["payload"].get("records") or []
        division = evaluation["division"] or "unknown"
        blocked_count = len(evaluation["blocked_records"])
        approved_count = len(evaluation["approved_records"])

        if blocked_count:
            if division in report["warningsByDivision"]:
                report["warningsByDivision"][division] += blocked_count
            report["recordsBlocked"] += blocked_count

        if not records:
            report["filesSkipped"] += 1
            report["skippedFiles"].append(
                {"file": path.name, "division": division, "reason": "zero records"},
            )
            continue

        if not approved_count:
            report["filesSkipped"] += 1
            report["skippedFiles"].append(
                {
                    "file": path.name,
                    "division": division,
                    "reason": "all records blocked",
                    "recordsBlocked": blocked_count,
                },
            )
            continue

        out_path = write_approved_file(evaluation, reviewed_by=reviewed_by)
        report["filesPromoted"] += 1
        report["recordsPromoted"] += approved_count
        report["promotedFiles"].append(
            {
                "file": path.name,
                "division": division,
                "output": out_path.name,
                "recordsPromoted": approved_count,
                "recordsBlocked": blocked_count,
            },
        )
        print(
            f"Approved {path.name} -> {out_path.name} "
            f"({approved_count} record(s), {blocked_count} blocked)",
        )

    return report


def print_promotion_report(report: dict[str, Any]) -> None:
    print("\n=== Promotion Report ===")
    print(f"Files promoted:  {report['filesPromoted']}")
    print(f"Records promoted: {report['recordsPromoted']}")
    print(f"Files skipped:   {report['filesSkipped']}")
    print(f"Records blocked: {report['recordsBlocked']}")
    print("\nBlocked records by division:")
    for division in ALL_DIVISION_CODES:
        count = report["warningsByDivision"].get(division, 0)
        if count:
            print(f"  Division {division}: {count}")


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
        "--all-divisions",
        action="store_true",
        help="Promote all valid ai-reviewed files across every supported Chapter 5 division",
    )
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

    if args.all_divisions and (args.division or args.figure):
        raise SystemExit("--all-divisions cannot be combined with --division or --figure")

    if args.all_divisions and not args.approve:
        raise SystemExit("--all-divisions requires --approve")

    source_dir = SOURCE_DIRS[args.from_stage]
    reviewed_by = args.reviewed_by or None

    if args.all_divisions:
        report = promote_all_divisions(
            source_dir=source_dir,
            allow_warnings=args.allow_warnings,
            reviewed_by=reviewed_by,
        )
        print_promotion_report(report)
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        report_path = REPORTS_DIR / "promotion-report.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nReport written to {report_path}")
        return

    files = resolve_source_files(
        source_dir=source_dir,
        division=args.division,
        figure=args.figure,
    )
    if not files:
        raise SystemExit("No files matched the provided filters.")

    for path in files:
        if args.approve:
            out = promote_to_approved(
                path,
                allow_warnings=args.allow_warnings,
                reviewed_by=reviewed_by,
                partial=False,
            )
            if out:
                print(f"Approved {path.name} -> {out}")
        elif args.mark_reviewed:
            out = promote_to_reviewed(path, reviewed_by=reviewed_by)
            print(f"Marked reviewed {path.name} -> {out}")
        elif args.reject:
            out = reject_file(path, reviewed_by=reviewed_by)
            print(f"Rejected {path.name} -> {out}")


if __name__ == "__main__":
    main()
