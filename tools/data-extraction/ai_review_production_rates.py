#!/usr/bin/env python3
"""AI-assisted cleaning of raw production-rate records (never auto-approves)."""

from __future__ import annotations

import argparse
import json
import re
import urllib.error
import urllib.request
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import (
    AI_REVIEWED_JSON_DIR,
    ENV_LOCAL_PATH,
    RAW_CSV_DIR,
    RAW_JSON_DIR,
    REPORTS_DIR,
    SOURCE_DOCUMENT_FULL,
)
from text_utils import clean_figure_title, utc_now_iso
from validate_production_rates import validate_file

BATCH_SIZE = 12
OPENAI_MODEL = "gpt-4o-mini"
DOT_LEADER_RE = re.compile(r"\.{4,}")

HIERARCHY_FIELDS = ("figureTitle", "category", "subcategory", "activityName", "description")
TEXT_FIELDS = (
    "figureTitle",
    "category",
    "subcategory",
    "activityName",
    "description",
    "unitOfMeasure",
    "rowNotes",
)
PROTECTED_FIELDS = (
    "id",
    "sourceDocumentCode",
    "sourceDocumentTitle",
    "sourceDocumentFull",
    "sourceEdition",
    "division",
    "divisionName",
    "figure",
    "sourcePage",
    "sourcePdfPage",
    "workElementNumber",
    "workElementLineNumber",
    "manHoursPerUnit",
    "fabricateHours",
    "erectStripHours",
    "cleanMoveHours",
    "crewSize",
    "skilledTrade",
    "skilledCount",
    "laborerCount",
    "equipmentOperatorCount",
    "equipment",
    "figureCrewNotes",
    "figureNotes",
    "createdAt",
)

SYSTEM_PROMPT = """You are a production-rate data cleaning assistant for commercial construction estimating software.

You receive raw extracted records from MCRP/NTRP Chapter 5 reference tables (one figure at a time).
Your job is to PROPOSE cleaned hierarchy and text fields — never approve records.

Rules:
- Return JSON: {"records": [ ... ]} with one cleaned object per input record, same order, same id.
- Set qaStatus to "ai_reviewed" only (NEVER "approved").
- Clean figureTitle: remove dot leaders and trailing page numbers like "5-C-7".
- Split hierarchy into category, subcategory, activityName, description.
- Preserve workElementNumber, workElementLineNumber, sourcePage, sourcePdfPage exactly.
- Preserve figureNotes, rowNotes, figureCrewNotes exactly unless fixing obvious OCR spacing.
- NEVER invent or change man-hours (manHoursPerUnit, fabricateHours, erectStripHours, cleanMoveHours).
- NEVER invent units unless clearly recoverable from figure/row context.
- If you fix a wrapped unit (e.g. bare "surface"), add an extractionWarnings entry explaining the fix.
- Flag merged parent headings, missing sourcePdfPage, suspicious man-hours, missing work element numbers.
- Flag uncertain changes in extractionWarnings — do not silently guess.
- Use professional commercial construction language in activity names.
- Do not use military-facing UI terminology in cleaned text.
"""


def load_env_value(key: str) -> str | None:
    if not ENV_LOCAL_PATH.exists():
        return None
    for line in ENV_LOCAL_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, value = stripped.split("=", 1)
        if name.strip() == key:
            return value.strip().strip('"').strip("'")
    return None


def normalize_figure_arg(value: str) -> str:
    stem = value.strip()
    for suffix in (".json", ".raw", ".ai_reviewed"):
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
    if stem.lower().startswith("figure "):
        parts = stem.split()
        if len(parts) >= 3:
            return f"figure_5_{parts[1].replace('-', '_')}_{parts[2]}"
    return stem


def resolve_input_files(
    *,
    division: str | None,
    figure: str | None,
    input_path: Path | None,
) -> list[Path]:
    if input_path:
        if not input_path.exists():
            raise SystemExit(f"Input file not found: {input_path}")
        return [input_path]

    files = sorted(RAW_JSON_DIR.glob("*.json"))
    if not files:
        raise SystemExit(f"No raw JSON files found in {RAW_JSON_DIR}")

    selected: list[Path] = []
    figure_stem = normalize_figure_arg(figure) if figure else None

    for path in files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        batch_meta = payload.get("batchMeta", {})
        record_division = batch_meta.get("division") or (
            payload.get("records", [{}])[0].get("division") if payload.get("records") else None
        )
        if division and record_division != division:
            continue
        if figure_stem and path.stem != figure_stem:
            continue
        selected.append(path)

    if not selected:
        raise SystemExit("No raw figure files matched the provided filters.")
    return selected


def load_figure_context(path: Path, batch_meta: dict[str, Any]) -> str:
    csv_name = batch_meta.get("sourceCsv")
    if not csv_name:
        return ""
    csv_path = RAW_CSV_DIR / csv_name
    if not csv_path.exists():
        return ""
    lines = csv_path.read_text(encoding="utf-8").splitlines()[:40]
    return "\n".join(lines)


def record_for_ai(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record.get("id"),
        "figureTitle": record.get("figureTitle"),
        "sourcePage": record.get("sourcePage"),
        "sourcePdfPage": record.get("sourcePdfPage"),
        "workElementNumber": record.get("workElementNumber"),
        "workElementLineNumber": record.get("workElementLineNumber"),
        "category": record.get("category"),
        "subcategory": record.get("subcategory"),
        "activityName": record.get("activityName"),
        "description": record.get("description"),
        "unitOfMeasure": record.get("unitOfMeasure"),
        "manHoursPerUnit": record.get("manHoursPerUnit"),
        "fabricateHours": record.get("fabricateHours"),
        "erectStripHours": record.get("erectStripHours"),
        "cleanMoveHours": record.get("cleanMoveHours"),
        "figureNotes": record.get("figureNotes"),
        "figureCrewNotes": record.get("figureCrewNotes"),
        "rowNotes": record.get("rowNotes"),
        "extractionWarnings": record.get("extractionWarnings") or [],
    }


def call_openai(*, api_key: str, figure_context: str, batch: list[dict[str, Any]]) -> list[dict[str, Any]]:
    user_payload = {
        "figureContext": figure_context,
        "records": batch,
        "instructions": "Return cleaned records preserving ids and all numeric rates exactly.",
    }
    body = {
        "model": OPENAI_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_payload, indent=2)},
        ],
        "temperature": 0.1,
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API error ({exc.code}): {detail}") from exc

    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    records = parsed.get("records")
    if not isinstance(records, list):
        raise RuntimeError("AI response missing records array")
    return records


def merge_ai_record(original: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(original)
    for field in TEXT_FIELDS:
        value = proposed.get(field)
        if isinstance(value, str):
            merged[field] = value.strip()
        elif value is not None:
            merged[field] = value

    merged["figureTitle"] = clean_figure_title(merged.get("figureTitle") or "")

    warnings = list(original.get("extractionWarnings") or [])
    for warning in proposed.get("extractionWarnings") or []:
        if isinstance(warning, str) and warning.strip() and warning not in warnings:
            warnings.append(warning.strip())
    merged["extractionWarnings"] = warnings

    for field in PROTECTED_FIELDS:
        if field in original:
            merged[field] = original[field]

    merged["qaStatus"] = "ai_reviewed"
    merged["updatedAt"] = utc_now_iso()
    return merged


def add_validation_warnings(record: dict[str, Any]) -> None:
    warnings = record.setdefault("extractionWarnings", [])
    if record.get("sourcePdfPage") is None and "missing sourcePdfPage" not in warnings:
        warnings.append("missing sourcePdfPage")
    if not record.get("workElementNumber") and "missing workElementNumber" not in warnings:
        warnings.append("missing workElementNumber")
    if DOT_LEADER_RE.search(record.get("figureTitle") or ""):
        if "figureTitle still contains dot leaders" not in warnings:
            warnings.append("figureTitle still contains dot leaders")
    unit = (record.get("unitOfMeasure") or "").strip().lower()
    if unit == "surface" and "unitOfMeasure is wrapped/incomplete (surface)" not in warnings:
        warnings.append("unitOfMeasure is wrapped/incomplete (surface)")

    man_hours = record.get("manHoursPerUnit")
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
        msg = "man-hours breakdown does not sum to manHoursPerUnit"
        if msg not in warnings:
            warnings.append(msg)


def diff_stats(original: dict[str, Any], cleaned: dict[str, Any]) -> dict[str, bool]:
    hierarchy_changed = any(original.get(field) != cleaned.get(field) for field in HIERARCHY_FIELDS)
    unit_fix = original.get("unitOfMeasure") != cleaned.get("unitOfMeasure")
    return {
        "hierarchyChanged": hierarchy_changed,
        "unitFix": unit_fix,
        "hasWarnings": bool(cleaned.get("extractionWarnings")),
    }


def review_figure_file(
    path: Path,
    *,
    api_key: str | None,
    dry_run: bool,
    output_dir: Path,
) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("records", [])
    batch_meta = payload.get("batchMeta", {})
    figure_context = load_figure_context(path, batch_meta)

    stats = {
        "file": path.name,
        "recordsProcessed": 0,
        "recordsWithWarnings": 0,
        "recordsWithUnitFixes": 0,
        "recordsWithHierarchyChanges": 0,
        "recordsNeedingHumanReview": 0,
    }

    if dry_run:
        batch_count = (len(records) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"[dry-run] {path.name}: {len(records)} records in {batch_count} batch(es)")
        stats["recordsProcessed"] = len(records)
        stats["recordsNeedingHumanReview"] = len(records)
        return stats

    if not api_key:
        raise SystemExit("OPENAI_API_KEY not found in .env.local")

    cleaned_records: list[dict[str, Any]] = []
    for start in range(0, len(records), BATCH_SIZE):
        batch = records[start : start + BATCH_SIZE]
        ai_input = [record_for_ai(record) for record in batch]
        ai_output = call_openai(api_key=api_key, figure_context=figure_context, batch=ai_input)
        if len(ai_output) != len(batch):
            raise RuntimeError(
                f"AI returned {len(ai_output)} records for batch of {len(batch)} in {path.name}",
            )

        by_id = {item.get("id"): item for item in ai_output if item.get("id")}
        for index, original in enumerate(batch):
            proposed = by_id.get(original.get("id")) or ai_output[index]
            if proposed.get("qaStatus") == "approved":
                proposed["qaStatus"] = "ai_reviewed"
            cleaned = merge_ai_record(original, proposed)
            add_validation_warnings(cleaned)
            diff = diff_stats(original, cleaned)
            if diff["hasWarnings"]:
                stats["recordsWithWarnings"] += 1
            if diff["unitFix"]:
                stats["recordsWithUnitFixes"] += 1
            if diff["hierarchyChanged"]:
                stats["recordsWithHierarchyChanges"] += 1
            stats["recordsNeedingHumanReview"] += 1
            cleaned_records.append(cleaned)

    stats["recordsProcessed"] = len(cleaned_records)

    out_payload = deepcopy(payload)
    out_payload["records"] = cleaned_records
    out_payload.setdefault("batchMeta", {})
    out_payload["batchMeta"]["aiReviewedAt"] = datetime.now(timezone.utc).date().isoformat()
    out_payload["batchMeta"]["aiReviewModel"] = OPENAI_MODEL
    out_payload["batchMeta"]["aiReviewSource"] = str(path)

    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{path.stem}.ai_reviewed.json"
    out_path.write_text(json.dumps(out_payload, indent=2), encoding="utf-8")

    result = validate_file(out_path, expected_status="ai_reviewed")
    if not result["valid"]:
        print(f"Warning: {out_path.name} has validation issues ({len(result['errors'])} records)")

    print(
        f"{out_path.name}: {stats['recordsProcessed']} records — "
        f"{stats['recordsWithWarnings']} warnings, "
        f"{stats['recordsWithHierarchyChanges']} hierarchy changes",
    )
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--division", help="CSI division code filter (e.g. 03)")
    parser.add_argument("--figure", help="Figure stem filter (e.g. figure_5_C_7)")
    parser.add_argument("--input", type=Path, help="Single raw JSON input file")
    parser.add_argument(
        "--output",
        type=Path,
        default=AI_REVIEWED_JSON_DIR,
        help="Output directory for ai-reviewed JSON",
    )
    parser.add_argument("--dry-run", action="store_true", help="List work without calling OpenAI")
    args = parser.parse_args()

    files = resolve_input_files(
        division=args.division,
        figure=args.figure,
        input_path=args.input,
    )
    api_key = load_env_value("OPENAI_API_KEY")

    report = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "sourceDocument": SOURCE_DOCUMENT_FULL,
        "dryRun": args.dry_run,
        "filesProcessed": 0,
        "recordsProcessed": 0,
        "recordsWithWarnings": 0,
        "recordsWithUnitFixes": 0,
        "recordsWithHierarchyChanges": 0,
        "recordsNeedingHumanReview": 0,
        "files": [],
    }

    for path in files:
        file_stats = review_figure_file(
            path,
            api_key=api_key,
            dry_run=args.dry_run,
            output_dir=args.output,
        )
        report["filesProcessed"] += 1
        report["recordsProcessed"] += file_stats["recordsProcessed"]
        report["recordsWithWarnings"] += file_stats["recordsWithWarnings"]
        report["recordsWithUnitFixes"] += file_stats["recordsWithUnitFixes"]
        report["recordsWithHierarchyChanges"] += file_stats["recordsWithHierarchyChanges"]
        report["recordsNeedingHumanReview"] += file_stats["recordsNeedingHumanReview"]
        report["files"].append(file_stats)

    if not args.dry_run:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        report_path = REPORTS_DIR / "ai-review-report.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Report written to {report_path}")

    print(
        f"AI review complete: {report['filesProcessed']} file(s), "
        f"{report['recordsProcessed']} record(s), "
        f"{report['recordsNeedingHumanReview']} needing human review",
    )


if __name__ == "__main__":
    main()
