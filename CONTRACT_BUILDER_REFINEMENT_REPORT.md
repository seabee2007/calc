# Contract Builder Refinement Report

Sprint completed: Contract Builder intake, formatting, prefill, and layout UX improvements.

## Files changed

| File | Change |
|------|--------|
| `src/features/documents/ui/contractPrefill.ts` | Jobsite resolution helper, legacy zip fallback, jobsite fingerprint |
| `src/features/documents/ui/contractPrefill.test.ts` | New unit tests for zip prefill |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Prefill re-run key, preview collapse, placeholder softening, work-hours load |
| `src/features/documents/ui/panels/IntakePanel.tsx` | Currency inputs, work-hours pair, stacked mode badge |
| `src/features/documents/ui/panels/PreviewPanel.tsx` | Muted italic styling for "Not provided" |
| `src/features/documents/ui/contractInput.ts` | Derive `workHours` from start/end times |
| `src/features/documents/ui/contractAnswersUtils.ts` | Split legacy `workHours` on draft load |
| `src/features/documents/ui/previewDisplay.ts` | Preview-only placeholder helper |
| `src/features/documents/engine/questionnaire/residentialQuestions.ts` | `workStartTime` / `workEndTime` questions |
| `src/utils/currencyInput.ts` | Shared USD parse/format utilities |

## ZIP import fix

**Root cause:** Prefill mapping was already correct (`jobsite_zip` → `propertyAddressZip`), but two gaps prevented reliable zip import:

1. **Stale prefill lock** — `prefillRunKeyRef` keyed only on project ID + proposal IDs. If the first prefill ran before jobsite data was complete in the store, zip (and other address fields) were never re-applied when the project record enriched.
2. **Missing zip on partial structured address** — Some projects had street/city/state without `jobsite_zip` populated, while a legacy placement-order jobsite string contained the zip.

**Fix:**

- Added `resolveProjectJobsiteAddress()` with `sanitizeUSAddress` and a narrow fallback to `placementOrder.jobsiteAddress` via `parseLegacyUSAddress` when zip is missing.
- Uses `resolveClientAddressForProposal()` for owner mailing address.
- Extended prefill `runKey` with `jobsitePrefillFingerprint()` and reset the ref when `projectId` changes.
- Added unit tests confirming zip maps to property and owner fields.

## Currency formatting

- New `currencyInput.ts` utilities: `parseCurrencyInput`, `formatCurrencyDisplay`, `formatCurrencyInputValue`.
- Applied to `contractPrice`, `estimatedTotal`, and `depositAmount` in IntakePanel.
- Values stored as numbers; display shows `$1,250.00` on blur; raw number shown while focused.
- Deposit auto-calculation and engine pricing math unchanged.

## Working hours field

- Replaced single `workHours` text question with `workStartTime` and `workEndTime` (`type="time"`).
- IntakePanel renders a paired "Normal working hours" block with helper text.
- `contractInput` builds `schedule.workHours` as `"06:00 - 18:00"` (defaults when unset).
- Saved drafts with legacy `workHours` strings are split into start/end on load via `normalizeContractAnswers()`.

## Preview collapse behavior

- `isPreviewOpen` local state (desktop default open, mobile default collapsed).
- Collapsed: builder expands to `max-w-5xl`; preview column hidden.
- Open: two-column grid `minmax(360px,0.9fr) / minmax(600px,1.6fr)`.
- Floating toggle button with chevron icons and "Show preview" / "Hide preview" labels; fixed position, vertically centered on desktop.
- State is not persisted to DB.

## Mode card verification

- Recommended badge moved below the Standard title in a vertical stack (no overlap with title or description).
- Equal-height cards preserved (`h-full`, `sm:items-stretch`).

## Preview placeholder cleanup

- `softenPreviewPlaceholders()` replaces `[owner.fullName]`-style tokens with "Not provided" in the live preview only.
- Engine `templateRenderer` unchanged — export/PDF still use bracket markers for missing fields.
- Compliance validation unaffected.

## Verification

- `npm test -- --run src/features/documents/ui/contractPrefill.test.ts` — 5 passed
- `npm run build` — succeeded

## Remaining issues / follow-ups

- Preview collapse toggle position may need fine-tuning on very wide monitors (uses viewport-based `right` calc).
- Default work hours (`06:00 - 18:00`) appear in contract preview even when the user has not filled the time fields; intentional for professional preview but could be made opt-in.
- Projects on databases without `jobsite_zip` column still cannot prefill zip until migration `20250525130000_project_jobsite_address.sql` is applied.
- Export PDF still shows `[path]` markers for missing values (by design); only the in-app preview is softened.
