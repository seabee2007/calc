# QC Alerts Link Report

## File Changed

- `src/components/dashboard/QcAlertsCard.tsx`

## Link Destination

`/projects?folder=qc_closeout`

This matches the existing **Review QC** button on the same card and opens the Projects list filtered to the QC & closeout folder, where QC records and related project documentation are managed.

No new routes were added.

## UI Details

- Header uses `flex items-center justify-between` with title on the left and link on the right.
- Link label: **QC docs** with `ArrowRight` icon (same pattern as **Full analysis** on Today's Placement Conditions).
- Classes: `text-sm text-cyan-400 hover:underline inline-flex items-center gap-1 shrink-0`.

## Unchanged

- Dashboard data logic (`OperationsDashboard`, `buildQcDashboardStats`).
- QC records logic.
- Routes and planner navigation.

## Validation

- `npm run build` — passed.
