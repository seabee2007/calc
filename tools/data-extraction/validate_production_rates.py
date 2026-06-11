#!/usr/bin/env python3
"""Validate normalized production-rate records across pipeline stages."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from config import (
    AI_REVIEWED_JSON_DIR,
    APPROVED_JSON_DIR,
    NEEDS_REVIEW_JSON_DIR,
    RAW_JSON_DIR,
    REJECTED_JSON_DIR,
    REVIEWED_JSON_DIR,
    SCHEMA_PATH,
)
from jsonschema import Draft202012Validator

QA_STATUSES = ("raw", "needs_review", "ai_reviewed", "reviewed", "approved", "rejected")
DOT_LEADER_RE = re.compile(r"\.{4,}")

PIPELINE_DIRS: tuple[tuple[Path, str | None], ...] = (
    (RAW_JSON_DIR, None),
    (NEEDS_REVIEW_JSON_DIR, "needs_review"),
    (AI_REVIEWED_JSON_DIR, "ai_reviewed"),
    (REVIEWED_JSON_DIR, "reviewed"),
    (APPROVED_JSON_DIR, "approved"),
    (REJECTED_JSON_DIR, "rejected"),
)


def load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def validate_record(record: dict[str, Any], *, expected_status: str | None = None) -> dict[str, Any]:
    validator = Draft202012Validator(load_schema())
    errors = [error.message for error in validator.iter_errors(record)]

    required_always = [
        ("division", "division is required"),
        ("divisionName", "divisionName is required"),
        ("figure", "figure is required"),
        ("figureTitle", "figureTitle is required"),
        ("sourcePage", "sourcePage is required"),
        ("activityName", "activityName is required"),
        ("unitOfMeasure", "unitOfMeasure is required"),
    ]
    for field, message in required_always:
        value = record.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            errors.append(message)

    figure_title = record.get("figureTitle") or ""
    if DOT_LEADER_RE.search(figure_title):
        errors.append("figureTitle cannot contain dot leaders")

    unit = (record.get("unitOfMeasure") or "").strip().lower()
    if unit == "surface":
        errors.append('unitOfMeasure cannot be "surface"')

    man_hours = record.get("manHoursPerUnit")
    if man_hours is not None and not isinstance(man_hours, (int, float)):
        errors.append("manHoursPerUnit must be numeric or null")

    qa_status = record.get("qaStatus")
    if qa_status not in QA_STATUSES:
        errors.append(f"qaStatus must be one of: {', '.join(QA_STATUSES)}")
    elif expected_status and qa_status != expected_status:
        errors.append(f"qaStatus must be {expected_status} for this folder")

    if qa_status == "approved":
        if record.get("sourcePdfPage") is None:
            errors.append("approved records require sourcePdfPage")
        if record.get("extractionWarnings"):
            errors.append("approved records cannot have extractionWarnings")
        activity = (record.get("activityName") or "").strip()
        if not activity or len(activity) < 3:
            errors.append("approved records must have a clean activityName")

        fabricate = record.get("fabricateHours")
        erect = record.get("erectStripHours")
        clean = record.get("cleanMoveHours")
        if (
            isinstance(man_hours, (int, float))
            and fabricate is not None
            and erect is not None
            and clean is not None
            and abs((fabricate + erect + clean) - man_hours) > 0.001
        ):
            errors.append("approved man-hours must equal fabricate + erect/strip + clean within 0.001")

    return {"valid": len(errors) == 0, "errors": errors}


def validate_file(path: Path, *, expected_status: str | None = None) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("records", [])
    file_errors: list[dict[str, Any]] = []

    for index, record in enumerate(records):
        result = validate_record(record, expected_status=expected_status)
        if not result["valid"]:
            file_errors.append(
                {
                    "index": index,
                    "id": record.get("id"),
                    "activityName": record.get("activityName"),
                    "errors": result["errors"],
                }
            )

    return {
        "file": str(path),
        "valid": len(file_errors) == 0,
        "recordCount": len(records),
        "errors": file_errors,
    }


def infer_expected_status(directory: Path) -> str | None:
    name = directory.name
    if name == "raw":
        return None
    if name == "needs-review":
        return "needs_review"
    if name == "ai-reviewed":
        return "ai_reviewed"
    if name == "reviewed":
        return "reviewed"
    if name == "approved":
        return "approved"
    if name == "rejected":
        return "rejected"
    return None


def validate_directory(directory: Path) -> int:
    expected = infer_expected_status(directory)
    files = sorted(directory.glob("*.json"))
    if not files:
        print(f"{directory.name}/: no JSON files (skipped)")
        return 0

    invalid_files = 0
    print(f"\n== {directory.name}/ ==")
    for path in files:
        if directory.name == "rejected" and path.name.startswith("adobe-chapter5."):
            print(f"{path.name}: skipped (Adobe recovery workflow file)")
            continue
        result = validate_file(path, expected_status=expected)
        status = "OK" if result["valid"] else f"{len(result['errors'])} invalid records"
        print(f"{path.name}: {result['recordCount']} records — {status}")
        if not result["valid"]:
            invalid_files += 1
            for err in result["errors"][:3]:
                print(f"  - [{err.get('id')}] {err['errors'][0]}")

    print(f"Validated {len(files)} file(s) in {directory}")
    return invalid_files


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dir",
        type=Path,
        default=RAW_JSON_DIR,
        help="Directory containing normalized JSON files",
    )
    parser.add_argument(
        "--all-stages",
        action="store_true",
        help="Validate every pipeline folder (raw through rejected)",
    )
    args = parser.parse_args()

    if args.all_stages:
        invalid_total = 0
        for directory, _expected in PIPELINE_DIRS:
            if directory.exists():
                invalid_total += validate_directory(directory)
        if invalid_total:
            raise SystemExit(f"Validation failed for {invalid_total} file(s) across pipeline stages")
        print("\nAll pipeline stages validated successfully.")
        return

    invalid_files = validate_directory(args.dir)
    if invalid_files:
        raise SystemExit(f"Validation failed for {invalid_files} file(s)")


if __name__ == "__main__":
    main()
