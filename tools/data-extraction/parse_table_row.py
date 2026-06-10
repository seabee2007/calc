"""Parse Chapter 5 production table cells into normalized records."""

from __future__ import annotations

import re
from typing import Any

from config import (
    SOURCE_DOCUMENT_CODE,
    SOURCE_DOCUMENT_FULL,
    SOURCE_DOCUMENT_TITLE,
    SOURCE_EDITION,
)
from text_utils import (
    MF_CODE_RE,
    LINE_ITEM_RE,
    build_record_id,
    clean_figure_title,
    normalize_unit,
    parse_activity_hierarchy,
    utc_now_iso,
)


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


def _parse_line_items(description_cell: str) -> tuple[str | None, list[dict[str, str | None]]]:
    work_element_number: str | None = None
    items: list[dict[str, str | None]] = []

    mf_match = MF_CODE_RE.search(description_cell)
    if mf_match:
        work_element_number = mf_match.group(1)

    for line_match in LINE_ITEM_RE.finditer(description_cell):
        items.append(
            {
                "workElementLineNumber": line_match.group(1),
                "lineText": " ".join(line_match.group(2).split()),
            }
        )

    if not items:
        lines = _split_lines(description_cell)
        if lines:
            items.append({"workElementLineNumber": None, "lineText": " ".join(lines)})

    return work_element_number, items


def _align_units(unit_cell: str, count: int) -> list[str]:
    units = _split_lines(unit_cell)
    if len(units) == count:
        return units
    if len(units) == 1 and count > 1:
        return units * count

    merged: list[str] = []
    buffer = ""
    for unit in units:
        buffer = f"{buffer} {unit}".strip()
        if buffer.lower() in {"sf", "lf", "cy", "cyd", "each", "ea", "ton", "lb", "acre", "feet", "foot", "sy", "cf"}:
            merged.append(buffer)
            buffer = ""
        elif "contact" in buffer.lower():
            merged.append(buffer)
            buffer = ""
        elif buffer.lower() == "surface" and merged and "contact" in merged[-1].lower():
            merged.append("surface")
            buffer = ""
    if buffer:
        merged.append(buffer)

    while len(merged) < count:
        merged.append(merged[-1] if merged else "Each")
    return merged[:count]


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
    figure_notes: list[str] | None = None,
    figure_crew_notes: list[str] | None = None,
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

    work_element_number, items = _parse_line_items(description_cell)
    if not items:
        return []

    units = _align_units(unit_cell, len(items))
    totals = _align_numbers(str(total_cell or ""), len(items))
    fabricates = _align_numbers(str(fabricate_cell or ""), len(items))
    erects = _align_numbers(str(erect_cell or ""), len(items))
    cleans = _align_numbers(str(clean_cell or ""), len(items))

    cleaned_title = clean_figure_title(figure_title)
    timestamp = utc_now_iso()
    records: list[dict[str, Any]] = []

    for idx, item in enumerate(items):
        line_text = item.get("lineText") or ""
        hierarchy = parse_activity_hierarchy(description_cell, line_text)
        unit_raw = units[idx]
        unit, unit_warnings = normalize_unit(unit_raw, context_units=units[: idx + 1])

        man_hours = totals[idx]
        fabricate = fabricates[idx]
        erect = erects[idx]
        clean = cleans[idx]

        warnings: list[str] = list(unit_warnings)
        qa_status = "raw"

        if man_hours is None:
            qa_status = "needs_review"
            warnings.append("Missing numeric man-hours per unit")
        if not item.get("workElementLineNumber"):
            qa_status = "needs_review"
            warnings.append("Missing work element line number")
        if not work_element_number:
            qa_status = "needs_review"
            warnings.append("Missing MasterFormat work element number")
        if unit.lower() == "surface":
            qa_status = "needs_review"

        if (
            fabricate is not None
            and erect is not None
            and clean is not None
            and man_hours is not None
            and abs((fabricate + erect + clean) - man_hours) > 0.001
        ):
            warnings.append("Fabricate + erect/strip + clean/move does not sum to total man-hours")

        line_number = item.get("workElementLineNumber")
        record_id = build_record_id(division, work_element_number, line_number)

        records.append(
            {
                "id": record_id,
                "sourceDocumentCode": SOURCE_DOCUMENT_CODE,
                "sourceDocumentTitle": SOURCE_DOCUMENT_TITLE,
                "sourceDocumentFull": SOURCE_DOCUMENT_FULL,
                "sourceEdition": SOURCE_EDITION,
                "division": division,
                "divisionName": division_name,
                "figure": figure,
                "figureTitle": cleaned_title or None,
                "sourcePage": source_page,
                "sourcePdfPage": source_pdf_page,
                "workElementNumber": work_element_number,
                "workElementLineNumber": line_number,
                "category": hierarchy.get("category"),
                "subcategory": hierarchy.get("subcategory"),
                "activityName": hierarchy.get("activityName") or line_text,
                "description": hierarchy.get("description"),
                "unitOfMeasure": unit,
                "manHoursPerUnit": man_hours,
                "fabricateHours": fabricate,
                "erectStripHours": erect,
                "cleanMoveHours": clean,
                "crewSize": None,
                "skilledTrade": None,
                "skilledCount": None,
                "laborerCount": None,
                "equipmentOperatorCount": None,
                "equipment": None,
                "figureCrewNotes": figure_crew_notes or None,
                "figureNotes": figure_notes or None,
                "rowNotes": None,
                "qaStatus": qa_status,
                "extractionWarnings": warnings,
                "createdAt": timestamp,
                "updatedAt": timestamp,
            }
        )

    return records
