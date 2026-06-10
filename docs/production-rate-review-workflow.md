# Production Rate Review Workflow

Human review is required before any MCRP/NTRP Chapter 5 extraction can power the Concrete Calc estimator.
AI may propose cleaned records, but **only human-approved records** may feed the estimator.

## Folder stages

| Folder | `qaStatus` | Purpose |
|--------|------------|---------|
| `data/estimating/production-rates/raw/` | `raw` | Machine extraction output — **never edit manually** |
| `data/estimating/production-rates/needs-review/` | `needs_review` | Rows flagged by parser for human correction |
| `data/estimating/production-rates/ai-reviewed/` | `ai_reviewed` | AI-cleaned proposals — **not trusted yet** |
| `data/estimating/production-rates/reviewed/` | `reviewed` | Human-verified, awaiting estimator sign-off |
| `data/estimating/production-rates/approved/` | `approved` | Estimator-approved; feeds seed generation |
| `data/estimating/production-rates/rejected/` | `rejected` | Rejected rows kept for audit |

## Revised pipeline with AI

```text
raw/ → ai-reviewed/ → reviewed/ → approved/ → generated app rates
```

## AI review (one figure at a time)

```powershell
npm run ai-review:production-rates -- --figure figure_5_C_7
npm run validate:production-rates
```

Inspect output:

```text
data/estimating/production-rates/ai-reviewed/figure_5_C_7.ai_reviewed.json
data/estimating/production-rates/reports/ai-review-report.json
```

When clean, promote with human sign-off:

```powershell
npm run promote:production-rates -- --figure figure_5_C_7 --approve
npm run generate:production-rates
npm run build
```

Division rollout (after verifying one Concrete figure):

```powershell
npm run ai-review:production-rates -- --division 03
```

## Review checklist (per record)

1. **Figure title** — no dot leaders (`....`) or TOC page numbers
2. **Hierarchy** — `category`, `subcategory`, `activityName`, `description` split correctly
3. **Work element** — `workElementNumber` + `workElementLineNumber` match the manual row
4. **Unit** — no bare `surface`; use `SF of contact surface` when appropriate
5. **Man-hours** — `manHoursPerUnit` matches Total Hours column (direct labor only)
6. **Hour breakdown** — if present, `fabricate + erect/strip + clean ≈ total` within 0.001
7. **Notes** — crew minimums, multipliers, environmental assumptions captured in `figureNotes` / `figureCrewNotes` / `rowNotes`
8. **Annex K** — verify division 10/11/12 assignment when reviewing Specialty figures

## Promote commands

```powershell
# AI review
python tools/data-extraction/ai_review_production_rates.py --figure figure_5_C_7

# Human approval (strict gate)
python tools/data-extraction/promote_reviewed_rates.py --figure figure_5_C_7 --approve

# Optional: mark ai-reviewed as human-reviewed first
python tools/data-extraction/promote_reviewed_rates.py --figure figure_5_C_7 --mark-reviewed

# Reject
python tools/data-extraction/promote_reviewed_rates.py --figure figure_5_C_7 --reject
```

Legacy manual promote (still supported):

```powershell
python tools/data-extraction/promote_records.py data/estimating/production-rates/raw/figure_5_C_7.json --stage needs_review --reviewed-by "your-name"
```

## Approved record requirements

- `sourcePdfPage` present
- `extractionWarnings` empty
- `unitOfMeasure` not `surface`
- `figureTitle` clean (no dot leaders)
- `qaStatus: "approved"`

## Dev UI (development builds only)

Open `/dev/production-rate-review` to compare raw vs AI-reviewed records side by side, edit fields, and approve selected records. Approved records are written to `approved/` and still require `npm run generate:production-rates`.

## Safety gates

- AI output uses `qaStatus: "ai_reviewed"` — never `approved`
- `generate:production-rates` reads **approved/** only
- Production Rate Library modal shows **approved generated seeds only**
- Raw, needs_review, ai_reviewed, and reviewed records never appear in the estimator

## Priority review order

1. Division 03 Concrete
2. Division 31 Earthwork
3. Division 06 Wood, Plastics, and Composites
4. Division 32 Exterior Improvements
5. Division 26 Electrical
6. Division 22 Plumbing

Then expand through divisions 09, 04, 05, 07, 08, 10/11/12, 13, 21, 23, 33, 34, 35, 41, 46.

## Warning

Source production data is **reference estimating data**, not a rigid production standard. Approved rates still require estimator judgment and site-specific adjustment in the field.
