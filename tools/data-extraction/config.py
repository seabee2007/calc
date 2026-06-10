"""Shared configuration for the MCRP/NTRP production-rate extraction pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

SOURCE_DOCUMENT_CODE = "MCRP 3-40D.12"
SOURCE_DOCUMENT_TITLE = "Construction Estimating"
SOURCE_DOCUMENT_FULL = "NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12"
SOURCE_EDITION = "October 2021, Change 1 October 2022"

DEFAULT_PDF_PATH = Path.home() / "Downloads" / "MCRP 3-40D.12.pdf"

RAW_CSV_DIR = REPO_ROOT / "data" / "estimating" / "production-rates" / "raw" / "csv"
RAW_JSON_DIR = REPO_ROOT / "data" / "estimating" / "production-rates" / "raw"
NEEDS_REVIEW_JSON_DIR = REPO_ROOT / "data" / "estimating" / "production-rates" / "needs-review"
AI_REVIEWED_JSON_DIR = REPO_ROOT / "data" / "estimating" / "production-rates" / "ai-reviewed"
REVIEWED_JSON_DIR = REPO_ROOT / "data" / "estimating" / "production-rates" / "reviewed"
APPROVED_JSON_DIR = REPO_ROOT / "data" / "estimating" / "production-rates" / "approved"
REJECTED_JSON_DIR = REPO_ROOT / "data" / "estimating" / "production-rates" / "rejected"
REPORTS_DIR = REPO_ROOT / "data" / "estimating" / "production-rates" / "reports"
ENV_LOCAL_PATH = REPO_ROOT / ".env.local"
GENERATED_TS_DIR = REPO_ROOT / "src" / "features" / "estimating" / "data" / "productionRates" / "generated"
SCHEMA_PATH = REPO_ROOT / "tools" / "data-extraction" / "schemas" / "productionRate.schema.json"

QA_STATUSES = ("raw", "needs_review", "ai_reviewed", "reviewed", "approved", "rejected")
# Backward compatibility alias
CONFIDENCE_VALUES = QA_STATUSES

# Chapter 5 annex letter -> CSI division metadata (from manual table of contents).
ANNEX_DIVISIONS: dict[str, dict[str, str]] = {
    "A": {"division": "01", "divisionName": "General Requirements"},
    "B": {"division": "02", "divisionName": "Existing Conditions"},
    "C": {"division": "03", "divisionName": "Concrete"},
    "D": {"division": "04", "divisionName": "Masonry"},
    "E": {"division": "05", "divisionName": "Metals"},
    "F": {"division": "06", "divisionName": "Wood, Plastics, and Composites"},
    "G": {"division": "07", "divisionName": "Thermal and Moisture Protection"},
    "H": {"division": "08", "divisionName": "Openings"},
    "J": {"division": "09", "divisionName": "Finishes"},
    "K": {"division": "10", "divisionName": "Specialties"},
    "L": {"division": "13", "divisionName": "Special Construction"},
    "M": {"division": "21", "divisionName": "Fire Suppression"},
    "N": {"division": "22", "divisionName": "Plumbing"},
    "P": {"division": "23", "divisionName": "Heating, Ventilating, and Air Conditioning"},
    "Q": {"division": "26", "divisionName": "Electrical"},
    "R": {"division": "31", "divisionName": "Earthwork"},
    "S": {"division": "32", "divisionName": "Exterior Improvements"},
    "T": {"division": "33", "divisionName": "Utilities"},
    "U": {"division": "34", "divisionName": "Transportation"},
    "V": {"division": "35", "divisionName": "Waterway and Marine Construction"},
    "W": {"division": "41", "divisionName": "Materiel Processing and Handling"},
    "X": {"division": "46", "divisionName": "Water Treatment Equipment"},
}

# Reverse lookup: CSI division code -> Chapter 5 annex letter.
DIVISION_TO_ANNEX: dict[str, str] = {
    meta["division"]: annex for annex, meta in ANNEX_DIVISIONS.items()
}

# Initial Concrete Calc rollout — extract/review these first.
PRIORITY_DIVISION_CODES: tuple[str, ...] = ("03", "06", "31", "32", "26", "22")

PRIORITY_DIVISIONS: dict[str, dict[str, str]] = {
    code: ANNEX_DIVISIONS[DIVISION_TO_ANNEX[code]] for code in PRIORITY_DIVISION_CODES
}

# Every division represented in Chapter 5 of the manual (22 annexes, 218 figures).
ALL_DIVISION_CODES: tuple[str, ...] = tuple(
    sorted({meta["division"] for meta in ANNEX_DIVISIONS.values()}, key=lambda code: int(code))
)

ALL_ANNEX_LETTERS: tuple[str, ...] = tuple(sorted(ANNEX_DIVISIONS.keys()))


@dataclass(frozen=True)
class FigureRef:
    annex: str
    number: int
    pdf_page: int
    title: str = ""

    @property
    def figure_id(self) -> str:
        return f"5-{self.annex}-{self.number}"

    @property
    def figure_label(self) -> str:
        return f"Figure {self.figure_id}"


def division_for_annex(annex: str) -> dict[str, str]:
    meta = ANNEX_DIVISIONS.get(annex.upper())
    if not meta:
        raise KeyError(f"Unknown annex letter: {annex}")
    return meta
