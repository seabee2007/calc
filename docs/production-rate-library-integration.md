# Production Rate Library Integration

## Overview

The Production Rate Library exposes **approved only** NTRP/MCRP Chapter 5 rates inside the estimate line-item editor.

```
approved JSON → generate:production-rates → generated/*.ts → productionRateLibrary.ts → UI picker
```

Raw JSON is never imported by the app.

## Generated outputs

| File | Purpose |
|------|---------|
| `generated/generatedProductionRates.ts` | `ProductionRate[]` for construction-activity path |
| `generated/generatedProductionRateIndex.ts` | Library entries + internal `qaStatus` for safety gate |

Regenerate after approving new JSON:

```powershell
npm run generate:production-rates
```

The generator **fails** if any non-approved record would enter generated output.

## UI entry point

`ProductionRateLibraryModal` is opened from **Estimate → Manual line item → Labor → Browse production rates**.

Features:
- Search by keyword
- Filter by division, category, unit
- Shows source figure/page and man-hours per unit
- Displays reference-value disclaimer

## Applying a rate

When the user selects a rate:

| Field | Value |
|-------|-------|
| `labor.productionRate` | `manHoursPerUnit` |
| `labor.ntrpProductionRateId` | approved record `id` |
| `labor.productionRateSourceFigure` | e.g. `Figure 5-C-7` |
| `labor.productionRateSourcePage` | e.g. `5-C-7` |
| `unit` | `unitOfMeasure` when set |

Estimate math is unchanged:

```
labor hours = quantity × productionRate (man-hours/unit) × difficulty/location factors
```

Construction-activity path still uses:

```
calculatedManHours = quantity × manHoursPerUnit × productionFactor
```

## Supabase

Migration `20260625000000_production_rate_sources.sql` adds:

- `production_rate_sources` — document registry
- Extended `production_rates` columns: `category`, `subcategory`, `activity_name`, `qa_status`, hour breakdown, notes

Runtime UI currently reads generated TypeScript bundles. `fetchProductionRates()` in `activityRepository.ts` is ready for DB-backed loading when seeds are pushed to Supabase.

## Safety gate

`productionRateLibrary.ts` throws if `GENERATED_PRODUCTION_RATE_INDEX` contains any record where `qaStatus !== 'approved'`.

## Bootstrap (interim)

Until full raw→approved review is complete for all divisions:

```powershell
npm run bootstrap:production-rates   # Div 03 + 31 from curated manualRates
npm run generate:production-rates
```
