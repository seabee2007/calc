#!/usr/bin/env python3
"""Convert raw figure CSV files into normalized JSON records."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import date
from pathlib import Path

from config import RAW_CSV_DIR, RAW_JSON_DIR, SOURCE_DOCUMENT_FULL, SOURCE_EDITION
from parse_table_row import parse_production_table_row
from text_utils import clean_figure_title
from validate_production_rates import validate_record


def read_figure_csv(csv_path: Path) -> tuple[dict[str, str], list[list[str]]]:
    metadata: dict[str, str] = {}
    rows: list[list[str]] = []
    with csv_path.open(encoding="utf-8") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if not row:
                continue
            if len(row) == 2 and row[0] in {
                "figure",
                "figureTitle",
                "division",
                "divisionName",
                "sourcePage",
                "sourcePdfPage",
            }:
                metadata[row[0]] = row[1]
                continue
            if row[0] == "Work Element Description":
                continue
            rows.append([cell.replace("\\n", "\n") for cell in row])
    return metadata, rows


def normalize_csv_file(csv_path: Path) -> dict:
    metadata, rows = read_figure_csv(csv_path)
    figure = metadata.get("figure", "")
    records = []

    pdf_page_raw = metadata.get("sourcePdfPage")
    source_pdf_page = int(pdf_page_raw) if pdf_page_raw and pdf_page_raw.isdigit() else None
    cleaned_title = clean_figure_title(metadata.get("figureTitle", ""))

    for row in rows:
        parsed = parse_production_table_row(
            row,
            figure=figure,
            figure_title=cleaned_title,
            division=metadata.get("division", ""),
            division_name=metadata.get("divisionName", ""),
            source_page=metadata.get("sourcePage", figure.replace("Figure ", "")),
            source_pdf_page=source_pdf_page,
        )
        records.extend(parsed)

    annex_warning = None
    if metadata.get("division") == "10":
        annex_warning = (
            "Annex K covers divisions 10, 11, and 12. Verify row-level division assignment during review."
        )

    return {
        "batchMeta": {
            "sourceDocumentCode": "MCRP 3-40D.12",
            "sourceDocumentTitle": "Construction Estimating",
            "sourceDocumentFull": SOURCE_DOCUMENT_FULL,
            "sourceEdition": SOURCE_EDITION,
            "division": metadata.get("division", ""),
            "divisionName": metadata.get("divisionName", ""),
            "figure": figure,
            "figureTitle": cleaned_title,
            "extractedAt": date.today().isoformat(),
            "sourceCsv": csv_path.name,
            "annexKWarning": annex_warning,
        },
        "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=RAW_CSV_DIR)
    parser.add_argument("--output-dir", type=Path, default=RAW_JSON_DIR)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    csv_files = sorted(args.input_dir.glob("*.csv"))
    if not csv_files:
        raise SystemExit(f"No CSV files found in {args.input_dir}")

    total_records = 0
    for csv_path in csv_files:
        payload = normalize_csv_file(csv_path)
        errors = []
        for record in payload["records"]:
            result = validate_record(record)
            if not result["valid"]:
                errors.extend(result["errors"])

        out_path = args.output_dir / f"{csv_path.stem}.json"
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        total_records += len(payload["records"])
        status = "OK" if not errors else f"{len(errors)} schema issues"
        print(f"Wrote {out_path} ({len(payload['records'])} records, {status})")

    print(f"Normalized {len(csv_files)} files / {total_records} records into {args.output_dir}")


if __name__ == "__main__":
    main()
