"""Text cleanup and hierarchy parsing for Chapter 5 production tables."""

from __future__ import annotations

import re
from datetime import datetime, timezone

MF_CODE_RE = re.compile(r"^(\d{2}\s+\d{2}\s+\d{2}\.\d{2})")
LINE_ITEM_RE = re.compile(r"\((\d{4})\)\s*([^\(]+?)(?=\(\d{4}\)|$)", re.S)
DOT_LEADER_RE = re.compile(r"\.{2,}.*$")
TRAILING_PAGE_RE = re.compile(r"\s+\d-[A-Z]-\d+\s*$")

VALID_UNITS = {
    "sf",
    "sy",
    "lf",
    "cy",
    "cyd",
    "cf",
    "each",
    "ea",
    "ton",
    "lb",
    "acre",
    "feet",
    "foot",
    "mbf",
    "loose cyd",
    "bank cyd",
    "sf of contact surface",
    "sf of contact",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def clean_figure_title(title: str) -> str:
    if not title:
        return ""
    cleaned = DOT_LEADER_RE.sub("", title).strip()
    cleaned = TRAILING_PAGE_RE.sub("", cleaned).strip()
    return " ".join(cleaned.split())


def build_record_id(division: str, work_element_number: str | None, line_number: str | None) -> str:
    mf = (work_element_number or "00 00 00.00").replace(" ", "-")
    line = line_number or "0000"
    return f"{mf}-{line}"


def _collapse_ws(value: str) -> str:
    return " ".join(value.split())


def _looks_like_dimension(text: str) -> bool:
    lowered = text.lower()
    if re.search(r"\d", text) and any(token in lowered for token in ("inch", "feet", "foot", "high", "wide", "deep", "diameter", "thick")):
        return True
    return len(text.split()) <= 4 and bool(re.search(r"\d", text))


def parse_activity_hierarchy(description_cell: str, line_text: str) -> dict[str, str | None]:
    mf_match = MF_CODE_RE.search(description_cell)
    category: str | None = None
    if mf_match:
        body = description_cell[mf_match.end() :].strip()
        pre_line = body.split("(0000)")[0].split("(0010)")[0].strip()
        if pre_line:
            category = _collapse_ws(pre_line)

    line_body = _collapse_ws(line_text)
    subcategory = line_body
    description: str | None = None

    if "," in line_body:
        parts = [part.strip() for part in line_body.split(",") if part.strip()]
        if len(parts) >= 2 and _looks_like_dimension(parts[-1]):
            description = parts[-1]
            subcategory = ", ".join(parts[:-1])
        elif len(parts) >= 2:
            subcategory = parts[0]
            description = ", ".join(parts[1:])
    elif _looks_like_dimension(line_body):
        description = line_body
        subcategory = category

    if description and subcategory and description.lower() in subcategory.lower():
        description = None

    if subcategory and description:
        activity_name = f"{subcategory}, {description}"
    else:
        activity_name = subcategory or category or line_body

    return {
        "category": category,
        "subcategory": subcategory,
        "activityName": activity_name,
        "description": description,
    }


def normalize_unit(raw: str, *, context_units: list[str] | None = None) -> tuple[str, list[str]]:
    warnings: list[str] = []
    unit = _collapse_ws(raw)
    lowered = unit.lower()

    aliases = {
        "sf of contact": "SF of contact surface",
        "sf of contact surface": "SF of contact surface",
        "ea": "Each",
        "each": "Each",
        "cy": "CYD",
        "cyd": "CYD",
        "loose cyd": "Loose CYD",
        "bank cyd": "Bank CYD",
    }
    if lowered in aliases:
        return aliases[lowered], warnings

    if lowered == "surface":
        for candidate in reversed(context_units or []):
            candidate_clean = _collapse_ws(candidate)
            if "contact" in candidate_clean.lower():
                return "SF of contact surface", warnings
        warnings.append('Unit "surface" is incomplete — needs manual review')
        return unit, warnings

    if lowered not in VALID_UNITS and "contact" not in lowered:
        warnings.append(f'Unrecognized unit "{unit}"')

    return unit, warnings
