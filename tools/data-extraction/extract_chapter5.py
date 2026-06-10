#!/usr/bin/env python3
"""Extract Chapter 5 production tables from the MCRP/NTRP manual into raw CSV files."""

from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from pathlib import Path

import pdfplumber

from config import ANNEX_DIVISIONS, DEFAULT_PDF_PATH, DIVISION_TO_ANNEX, PRIORITY_DIVISIONS, RAW_CSV_DIR, FigureRef, division_for_annex

FIGURE_RE = re.compile(r"Figure\s+5-([A-Z])-(\d+)(?:\.\s*([^\n]+))?", re.I)


def annex_letters_for_divisions(division_codes: list[str]) -> set[str]:
    letters: set[str] = set()
    for code in division_codes:
        annex = DIVISION_TO_ANNEX.get(code) or next(
            (letter for letter, meta in ANNEX_DIVISIONS.items() if meta["division"] == code),
            None,
        )
        if annex:
            letters.add(annex)
    return letters


def discover_figure_pages(pdf_path: Path, annex_letters: set[str]) -> dict[str, list[tuple[int, str]]]:
    figure_pages: dict[str, list[tuple[int, str]]] = defaultdict(list)

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            for match in FIGURE_RE.finditer(text):
                annex = match.group(1).upper()
                if annex not in annex_letters:
                    continue
                number = int(match.group(2))
                title = (match.group(3) or "").strip()
                canonical = f"Figure 5-{annex}-{number}"
                figure_pages[canonical].append((page_index + 1, title))

    return figure_pages


def table_to_csv_rows(table: list[list[str | None]]) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table:
        rows.append(["" if cell is None else str(cell).replace("\n", "\\n") for cell in row])
    return rows


def extract_figure_csv(
    pdf_path: Path,
    figure: str,
    pages: list[tuple[int, str]],
    output_dir: Path,
) -> Path:
    annex_match = re.match(r"Figure 5-([A-Z])-(\d+)$", figure)
    if not annex_match:
        raise ValueError(f"Invalid figure label: {figure}")

    annex = annex_match.group(1)
    division_meta = division_for_annex(annex)
    figure_number = int(annex_match.group(2))
    figure_ref = FigureRef(annex=annex, number=figure_number, pdf_page=pages[0][0], title=pages[0][1])

    csv_path = output_dir / f"figure_5_{annex}_{figure_number}.csv"
    first_pdf_page = pages[0][0]
    all_rows: list[list[str]] = [
        ["figure", figure],
        ["figureTitle", figure_ref.title],
        ["division", division_meta["division"]],
        ["divisionName", division_meta["divisionName"]],
        ["sourcePage", figure_ref.figure_id],
        ["sourcePdfPage", str(first_pdf_page)],
        [],
        ["Work Element Description", "Unit", "Fabricate", "Erect and Strip", "Clean and Move", "Total Hours"],
    ]

    with pdfplumber.open(pdf_path) as pdf:
        for pdf_page, _title in pages:
            page = pdf.pages[pdf_page - 1]
            tables = page.extract_tables() or []
            for table in tables:
                if not table or len(table) < 2:
                    continue
                header = " ".join(str(c or "") for c in table[0]).lower()
                if "work element" not in header and "man-hour" not in header:
                    continue
                data_rows = table[2:] if len(table) > 2 and "fabricate" in " ".join(str(c or "") for c in table[1]).lower() else table[1:]
                all_rows.extend(table_to_csv_rows(data_rows))

    output_dir.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerows(all_rows)

    return csv_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF_PATH, help="Path to MCRP 3-40D.12 PDF")
    parser.add_argument(
        "--divisions",
        nargs="*",
        default=list(PRIORITY_DIVISIONS.keys()),
        help="CSI division codes to extract (default: priority rollout divisions)",
    )
    parser.add_argument("--output-dir", type=Path, default=RAW_CSV_DIR)
    args = parser.parse_args()

    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    selected_annexes = annex_letters_for_divisions(args.divisions)
    figure_pages = discover_figure_pages(args.pdf, selected_annexes)
    if not figure_pages:
        raise SystemExit("No Chapter 5 figures found for selected divisions.")

    written: list[Path] = []
    for figure in sorted(
        figure_pages.keys(),
        key=lambda value: (value.split("-")[2], int(value.split("-")[-1])),
    ):
        csv_path = extract_figure_csv(args.pdf, figure, figure_pages[figure], args.output_dir)
        written.append(csv_path)
        print(f"Wrote {csv_path}")

    print(f"Extracted {len(written)} figure CSV files to {args.output_dir}")


if __name__ == "__main__":
    main()
