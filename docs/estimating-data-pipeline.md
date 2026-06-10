# Estimating data extraction pipeline

This pipeline converts Chapter 5 production tables from **NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12 — Construction Estimating** (October 2021, Change 1 October 2022) into reviewable production-rate datasets for the Concrete Calc estimating engine.

> **Important:** Source production data is reference material, not a rigid production standard. Every imported rate requires estimator judgment before use in bids, schedules, or proposals.

## Design principles

1. **Never hardcode unverified PDF values in application code.**
2. **Raw extraction is machine output only** — do not manually edit `raw/` files.
3. **Only `qaStatus: "approved"` records** may feed seed generation or the estimator UI.
4. **Safety gate** — `npm run generate:production-rates` fails if any non-approved record is present.
5. **Existing curated files** under `manualRates/` can be bootstrapped into `approved/` via `npm run bootstrap:production-rates`.

## Directory layout

```text
tools/data-extraction/                 Python extraction + validation tools
  extract_chapter5.py                  PDF → raw CSV (one file per figure)
  normalize_raw.py                     raw CSV → raw JSON
  validate_records.py                  JSON schema validation helpers
  promote_records.py                   raw/reviewed → reviewed/approved
  schemas/productionRate.schema.json

data/estimating/production-rates/
  raw/csv/                             Machine-extracted CSV per figure
  raw/                                 Normalized JSON (`qaStatus: raw|needs_review`)
  needs-review/                        Parser-flagged rows
  reviewed/                            Human-reviewed JSON (`qaStatus: reviewed`)
  approved/                            Estimator-approved JSON (`qaStatus: approved`)
  rejected/                            Rejected rows (audit trail)

src/features/estimating/data/productionRates/generated/
  generatedProductionRates.ts          Approved ProductionRate[] bundle
  generatedProductionRateIndex.ts      Approved library index (UI picker)

src/features/estimating/data/productionRates/
  productionRateTypes.ts               Pipeline TypeScript types
  validateExtractedProductionRates.ts  TS validation + approved-only guard
  mapExtractedToReviewedRate.ts        Maps approved JSON → existing seed shape

scripts/generateProductionRateSeeds.ts   approved JSON → TS seeds (+ optional SQL)
```

## Division coverage

The manual’s Chapter 5 production figures cover **22 annexes** mapped to these CSI divisions:

| Annex | Division | Name |
|-------|----------|------|
| A | 01 | General Requirements |
| B | 02 | Existing Conditions |
| C | 03 | Concrete |
| D | 04 | Masonry |
| E | 05 | Metals |
| F | 06 | Wood, Plastics, and Composites |
| G | 07 | Thermal and Moisture Protection |
| H | 08 | Openings |
| J | 09 | Finishes |
| K | 10 | Specialties (also includes Div 11/12 figures) |
| L | 13 | Special Construction |
| M | 21 | Fire Suppression |
| N | 22 | Plumbing |
| P | 23 | HVAC |
| Q | 26 | Electrical |
| R | 31 | Earthwork |
| S | 32 | Exterior Improvements |
| T | 33 | Utilities |
| U | 34 | Transportation |
| V | 35 | Waterway and Marine Construction |
| W | 41 | Materiel Processing and Handling |
| X | 46 | Water Treatment Equipment |

**Priority divisions** (review first): 03, 06, 22, 26, 31, 32.

The same extract → review → approve workflow applies to every division above.

## 1. Extract raw CSV from the PDF

### Prerequisites

- Python 3.12+
- Source PDF (default path: `%USERPROFILE%/Downloads/MCRP 3-40D.12.pdf`)

```powershell
cd calc
python -m pip install -r tools/data-extraction/requirements.txt

# Priority divisions only (default)
python tools/data-extraction/extract_chapter5.py --pdf "C:\Users\terre\Downloads\MCRP 3-40D.12.pdf"

# All manual divisions (~218 figures)
python tools/data-extraction/extract_chapter5.py --pdf "C:\Users\terre\Downloads\MCRP 3-40D.12.pdf" --all-divisions
```

Options:

- `--all-divisions` — extract every Chapter 5 annex in the manual
- `--divisions 03 31` — limit extraction to specific CSI divisions
- `--output-dir data/estimating/production-rates/raw/csv`

Output: one CSV per figure, e.g. `figure_5_C_7.csv`.

## 2. Normalize to JSON (raw stage)

```powershell
python tools/data-extraction/normalize_raw.py
```

Output: `data/estimating/production-rates/raw/figure_5_C_7.raw.json`

Each record includes:

- Source metadata (`sourceDocumentCode`, `figure`, `sourcePage`)
- Parsed activity fields (`activityName`, `unitOfMeasure`, `manHoursPerUnit`, …)
- `confidence`: `raw` or `needs_review`
- `extractionWarnings` when parsing was uncertain

## 3. Review workflow

### AI-assisted review (recommended)

```powershell
npm run ai-review:production-rates -- --figure figure_5_C_7
npm run validate:production-rates
npm run promote:production-rates -- --figure figure_5_C_7 --approve
```

AI output lands in `data/estimating/production-rates/ai-reviewed/` with `qaStatus: "ai_reviewed"`.
Only human promotion to `approved/` may feed the estimator. See [production-rate-review-workflow.md](./production-rate-review-workflow.md).

### Human review checklist

For each record in raw JSON:

1. Confirm MasterFormat work element number and line number.
2. Confirm activity description matches the manual row.
3. Confirm unit of measure.
4. Confirm man-hours per unit (usually the **Total Hours** column).
5. Add crew/equipment notes if present in the figure footnotes.
6. Fix or reject rows with `needs_review` confidence.

Save corrected files to `data/estimating/production-rates/reviewed/`.

### Promote to reviewed

```powershell
python tools/data-extraction/promote_records.py data/estimating/production-rates/raw/figure_5_C_7.raw.json --stage reviewed --reviewed-by "your-name"
```

### Promote to approved

After final estimator sign-off:

```powershell
python tools/data-extraction/promote_records.py data/estimating/production-rates/reviewed/figure_5_C_7.reviewed.json --stage approved --reviewed-by "your-name"
```

Only `approved` JSON may be consumed downstream.

## 4. Validation rules

Enforced in both Python (`validate_records.py`) and TypeScript (`validateExtractedProductionRates.ts`):

| Field | Rule |
|-------|------|
| `activityName` | Required |
| `unitOfMeasure` | Required |
| `division` | Required, 2-digit CSI code |
| `sourcePage` | Required |
| `manHoursPerUnit` | Numeric or `null` |
| `confidence` | `raw`, `needs_review`, `reviewed`, or `approved` |

Stage guards:

- Raw normalization allows `raw` / `needs_review`
- Reviewed folder requires `reviewed`
- Approved folder requires `approved`
- Seed generation rejects anything except `approved`

## 5. Regenerate TypeScript seeds

```powershell
npx tsx scripts/generateProductionRateSeeds.ts
```

Optional Supabase seed SQL:

```powershell
npx tsx scripts/generateProductionRateSeeds.ts --sql
```

Generated files:

- `src/features/estimating/data/generated/division03ConcreteRates.generated.ts`
- `supabase/seeds/production_rates/*.sql` (when `--sql` is passed)

**Do not edit generated files manually.** Update approved JSON and regenerate.

## 6. Estimator safety guard

The production estimator must never load raw JSON directly.

Use:

```typescript
import { assertApprovedProductionRateFile } from '@/features/estimating/data/productionRates/validateExtractedProductionRates';
```

This throws if any record is not `confidence: "approved"`.

## Source metadata

| Field | Value |
|-------|-------|
| Document codes | NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12 |
| Title | Construction Estimating |
| Edition | October 2021, Change 1 October 2022 |
| Primary data | Chapter 5 annex production figures |

## Troubleshooting

| Issue | Action |
|-------|--------|
| Missing figure CSV | Re-run extraction for that division; verify PDF page contains a production table |
| Misaligned units/hours | Mark record `needs_review`; fix manually before approval |
| Duplicate IDs after mapping | Ensure unique `workElementNumber` + `workElementLineNumber` pairs |
| Seed build fails validation | Approved JSON must map to valid `ReviewedRateFile` entries (see existing `manualRates` examples) |

## npm scripts

```powershell
npm run extract:production-rates      # PDF → raw CSV (all divisions)
npm run normalize:production-rates    # CSV → raw JSON
npm run validate:production-rates     # Validate raw folder
npm run bootstrap:production-rates    # Curated Div 03/31 → approved JSON
npm run generate:production-rates     # approved → generated TS (safety gate)
```

## Related docs

- [production-rate-review-workflow.md](./production-rate-review-workflow.md)
- [production-rate-library-integration.md](./production-rate-library-integration.md)
- Existing curated rates: `src/features/estimating/data/manualRates/`
- Estimating blueprint: `docs/estimating-engine-blueprint.md`
