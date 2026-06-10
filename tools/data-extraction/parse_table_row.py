"""Parse Chapter 5 production table cells into normalized records."""

from __future__ import annotations

import re
from typing import Any

from config import SOURCE_DOCUMENT_CODE

MF_CODE_RE = re.compile(r"^(\d{2}\s+\d{2}\s+\d{2}\.\d{2})")
LINE_ITEM_RE = re.compile(r"\((\d{4})\)\s*([^\(]+?)(?=\(\d{4}\)|$)", re.S)
NUMERIC_RE = re.compile(r"^[\d.*]+$")


def _parse_number(value: str | None) -> float | None:
    if value is None:
        return None
    cleaned = value.strip().replace(",", "")
    if not cleaned or cleaned == "*":
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _split_lines(value: str | None) -> list[str]:
    if not value:
        return []
    return [line.strip() for line in value.split("\n") if line.strip()]


def _normalize_unit(raw: str) -> str:
    unit = " ".join(raw.split())
    mapping = {
        "SF of contact surface": "SF of contact surface",
        "SF of contact": "SF of contact surface",
        "CYD": "CYD",
        "Loose CYD": "Loose CYD",
        "Bank CYD": "Bank CYD",
        "Each": "Each",
        "EA": "Each",
    }
    return mapping.get(unit, unit)


def _parse_line_items(description_cell: str) -> tuple[str | None, str | None, list[dict[str, str]]]:
    lines = _split_lines(description_cell)
    work_element_number: str | None = None
    activity_name: str | None = None
    items: list[dict[str, str]] = []

    body = description_cell
    mf_match = MF_CODE_RE.search(body)
    if mf_match:
        work_element_number = mf_match.group(1)
        body = body[mf_match.end() :].strip()
        pre_line = body.split("(0000)")[0].split("(0010)")[0].strip()
        if pre_line:
            activity_name = " ".join(pre_line.split())

    for line_match in LINE_ITEM_RE.finditer(description_cell):
        items.append(
            {
                "workElementLineNumber": line_match.group(1),
                "description": " ".join(line_match.group(2).split()),
            }
        )

    if not items and lines:
        items.append({"workElementLineNumber": None, "description": " ".join(lines)})

    return work_element_number, activity_name, items


def _align_units(unit_cell: str, count: int) -> list[str]:
    units = _split_lines(unit_cell)
    if len(units) == count:
        return units
    if len(units) == 1 and count > 1:
        return units * count
    if len(units) > count:
        merged: list[str] = []
        buffer = ""
        for unit in units:
            buffer = f"{buffer} {unit}".strip()
            if buffer.lower() in {"sf", "lf", "cy", "cyd", "each", "ton", "lb", "acre", "feet", "foot", "sy", "cf"}:
                merged.append(buffer)
                buffer = ""
            elif "surface" in buffer.lower() and len(merged) >= count - 1:
                merged.append(buffer)
                buffer = ""
        if buffer:
            merged.append(buffer)
        if len(merged) >= count:
            return merged[:count]
    while len(units) < count:
        units.append(units[-1] if units else "Each")
    return units[:count]


def _align_numbers(number_cell: str | None, count: int) -> list[float | None]:
    values = [_parse_number(v) for v in _split_lines(number_cell or "")]
    while len(values) < count:
        values.append(None)
    return values[:count]


def parse_production_table_row(
    row: list[Any],
    *,
    figure: str,
    figure_title: str,
    division: str,
    division_name: str,
    source_page: str,
    source_pdf_page: int | None,
) -> list[dict[str, Any]]:
    if not row or len(row) < 2:
        return []

    description_cell = (row[0] or "").strip()
    if not description_cell or description_cell.lower().startswith("work element"):
        return []

    unit_cell = (row[1] or "").strip()
    fabricate_cell = row[2] if len(row) > 2 else None
    erect_cell = row[3] if len(row) > 3 else None
    clean_cell = row[4] if len(row) > 4 else None
    total_cell = row[5] if len(row) > 5 else row[-1]

    work_element_number, activity_name, items = _parse_line_items(description_cell)
    if not items:
        return []

    units = _align_units(unit_cell, len(items))
    totals = _align_numbers(str(total_cell or ""), len(items))
    fabricates = _align_numbers(str(fabricate_cell or ""), len(items))
    erects = _align_numbers(str(erect_cell or ""), len(items))
    cleans = _align_numbers(str(clean_cell or ""), len(items))

    records: list[dict[str, Any]] = []
    for idx, item in enumerate(items):
        man_hours = totals[idx]
        warnings: list[str] = []
        confidence = "raw"

        if man_hours is None:
            confidence = "needs_review"
            warnings.append("Missing numeric man-hours per unit")

        if not item.get("workElementLineNumber"):
            confidence = "needs_review"
            warnings.append("Missing work element line number")

        if not work_element_number:
            confidence = "needs_review"
            warnings.append("Missing MasterFormat work element number")

        record_activity = activity_name or item["description"]
        record_description = item["description"] if activity_name else None

        records.append(
            {
                "sourceDocumentCode": SOURCE_DOCUMENT_CODE,
                "division": division,
                "divisionName": division_name,
                "figure": figure,
                "figureTitle": figure_title or None,
                "workElementNumber": work_element_number,
                "workElementLineNumber": item.get("workElementLineNumber"),
                "activityName": record_activity,
                "description": record_description,
                "unitOfMeasure": _normalize_unit(units[idx]),
                "manHoursPerUnit": man_hours,
                "crewSize": None,
                "skilledTrade": None,
                "laborerCount": None,
                "equipment": None,
                "notes": None,
                "sourcePage": source_page,
                "sourcePdfPage": source_pdf_page,
                "confidence": confidence,
                "fabricateHours": fabricates[idx],
                "erectStripHours": erects[idx],
                "cleanMoveHours": cleans[idx],
                "extractionWarnings": warnings,
            }
        )

    return records
