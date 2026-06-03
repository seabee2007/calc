# Dropdown and Proposal Badge Regression Fix Report

## Scope
Fixed two UI-only regressions:
- Contract & Document Builder dropdown displayed multiple visually identical residential remodel template options.
- Proposal cards displayed two badge-style indicators in the card header.

No Supabase schema, document engine logic, document rendering logic, pricing math, RLS/auth logic, or proposal status update logic was changed.

## Root causes
### Document template dropdown duplicates
The builder dropdown is populated from registered document packs via `listPacks()`. The state residential packs were all mapped to the same display label, `Residential Remodel Contract`, so separate packs appeared as duplicate dropdown entries even though the underlying pack keys remained distinct.

### Proposal duplicate status badges
`ProposalPipelineCard` rendered two badge-like elements in the same header cluster:
- An aging/activity chip from `getProposalAging()`, such as `Draft`, `Follow up`, or `Stale`.
- The canonical `ProposalStatusBadge`, which reflects the actual proposal status.

This made proposal cards look like they had duplicate status badges.

## Files changed
### `src/features/documents/ui/DocumentBuilderPage.tsx`
Changed only the UI display labels returned by `templateLabel()` for state residential packs:
- `CA_RESIDENTIAL` now displays as `California Residential Remodel Contract`.
- `FL_RESIDENTIAL` now displays as `Florida Residential Remodel Contract`.
- `NY_RESIDENTIAL` now displays as `New York Residential Remodel Contract`.
- `TX_RESIDENTIAL` now displays as `Texas Residential Remodel Contract`.
- `GA_RESIDENTIAL` now displays as `Georgia Residential Remodel Contract`.
- `GU_RESIDENTIAL` now displays as `Guam Residential Remodel Contract`.

All document packs remain registered and selectable. No pack keys, document types, templates, assembly behavior, compliance behavior, or engine logic changed.

### `src/components/proposals/ProposalPipelineCard.tsx`
Removed the extra badge-style aging chip from the proposal card header.

Kept:
- `ProposalStatusBadge` as the single canonical proposal status badge.
- Existing status values and status update logic.
- Activity/aging text via `aging.activityLine`, displayed as plain text below the amount area.
- Expanded card activity timeline.

Removed:
- The header aging chip markup that used `aging.badgeLabel` and `aging.badgeClass`.

## Validation
### `npm run lint`
Result: failed due to existing repository-wide lint errors.

Observed summary:
- 206 total lint problems reported across the repository.
- 174 errors and 32 warnings.
- Failures include unrelated unused variables, `any` usage, and React hook dependency warnings across many files.

Follow-up targeted check:
- `npx eslint src/features/documents/ui/DocumentBuilderPage.tsx src/components/proposals/ProposalPipelineCard.tsx`
- Result: passed with no output.

### `npx tsc -p tsconfig.app.json --noEmit`
Result: failed due to existing repository-wide TypeScript errors.

Observed summary:
- Broad type failures across many app areas, including core type mismatches, missing properties on shared types, unused declarations, and incompatible props.
- The failures were not introduced by the two UI-only edits in this pass.

### `npm run build`
Result: passed.

Observed summary:
- Vite production build completed successfully.
- 3201 modules transformed.
- Build completed in 17.31s.
- PWA assets and service worker were generated.
- One existing dynamic/static import chunking warning for `employeeService.ts` was reported, but it did not fail the build.

## Acceptance criteria status
- Dropdown no longer shows visually duplicated state residential template names.
- All document packs remain present and selectable.
- Document engine logic is unchanged.
- Proposal cards show only one canonical status badge.
- Proposal status update logic is unchanged.
- Activity/aging information remains available as non-badge text and timeline detail.
