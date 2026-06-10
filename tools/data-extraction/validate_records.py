"""Validate extracted production-rate records against the pipeline schema."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from config import CONFIDENCE_VALUES, SCHEMA_PATH


def load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def validate_record(
    record: dict[str, Any],
    *,
    allow_confidence: set[str] | None = None,
) -> dict[str, Any]:
    validator = Draft202012Validator(load_schema())
    errors = [error.message for error in validator.iter_errors(record)]

    if not record.get("activityName", "").strip():
        errors.append("activityName is required")
    if not record.get("unitOfMeasure", "").strip():
        errors.append("unitOfMeasure is required")
    if not record.get("division", "").strip():
        errors.append("division is required")
    if not record.get("sourcePage", "").strip():
        errors.append("sourcePage is required")

    confidence = record.get("confidence")
    if confidence not in CONFIDENCE_VALUES:
        errors.append(f"confidence must be one of {', '.join(CONFIDENCE_VALUES)}")
    elif allow_confidence is not None and confidence not in allow_confidence:
        errors.append(f"confidence '{confidence}' is not allowed in this stage")

    man_hours = record.get("manHoursPerUnit")
    if man_hours is not None and not isinstance(man_hours, (int, float)):
        errors.append("manHoursPerUnit must be numeric or null")

    return {"valid": len(errors) == 0, "errors": errors}


def validate_file(path: Path, *, allow_confidence: set[str] | None = None) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("records", [])
    all_errors: list[dict[str, Any]] = []

    for index, record in enumerate(records):
        result = validate_record(record, allow_confidence=allow_confidence)
        if not result["valid"]:
            all_errors.append({"index": index, "errors": result["errors"], "activityName": record.get("activityName")})

    return {
        "file": str(path),
        "valid": len(all_errors) == 0,
        "recordCount": len(records),
        "errors": all_errors,
    }
