# Contract Builder UI Refinement Report

## Before

- Contract Builder showed the same project choice in two places: the top field-tool project selector and a second `Project (optional)` field inside the New Contract card.
- Compliance warnings appeared immediately, before the user had entered enough information.
- Export repeated the same compliance warnings, making the right side noisy.
- The preview was below risk/compliance/export, so the actual contract document did not feel like the primary workspace.
- `Jurisdiction / Pack` used engine terminology that is not contractor-facing.
- Contract mode buttons had minimal explanation.
- Save appeared before most intake fields.
- Draft-only warnings appeared in multiple places.

## After

- The top Project selector is the single source of truth for project linkage, storage, Planner Documents integration, prefill, and client portal contract links.
- A dedicated Project Summary card appears immediately below the top Project selector and shows:
  - Project Name
  - Client
  - Project Type
  - Jobsite Address
  - Proposal Total
  - Contract Value
- Missing project data displays as `Not available`.
- `Refresh From Project` is available from the Project Summary card.
- Compliance now starts quiet with: `Complete the contract details to run compliance checks.`
- Compliance warnings appear only after Run Compliance, Preview Contract, Save Draft, Export, or Send for signature.
- Export now focuses only on Draft PDF, Manifest JSON, and final export availability/reason.
- `Jurisdiction / Pack` is renamed to `Contract Template`.
- Contract modes now include explanatory text and visually mark Standard as recommended.
- Save moved to a sticky preview-side action area with:
  - Save Draft
  - Run Compliance
  - Preview Contract
- Desktop layout is now preview-dominant:
  - Left: project/intake controls, risk, compliance, export, signing
  - Right: sticky action bar and contract preview
- Draft warning repetition was reduced to the page-level banner and export final availability reason.

## Files Changed

- `src/components/tools/FieldToolPageLayout.tsx`
- `src/features/documents/ui/DocumentBuilderPage.tsx`
- `src/features/documents/ui/contractBuilderConstants.ts`
- `src/features/documents/ui/panels/DocumentMetaPanel.tsx`
- `src/features/documents/ui/panels/ProjectSummaryPanel.tsx`
- `src/features/documents/ui/panels/IntakePanel.tsx`
- `src/features/documents/ui/panels/CompliancePanel.tsx`
- `src/features/documents/ui/panels/ExportPanel.tsx`
- `src/features/documents/ui/panels/PreviewPanel.tsx`

## Verification

`npm run build` passed.

The existing Vite warning about `employeeService.ts` being both dynamically and statically imported remains unrelated to this sprint.

## Remaining Recommendations

- Add true template-specific catalogs later for Remodel, Concrete, Roofing, and Insurance Restoration rather than using labels over the current pack registry.
- Consider a dedicated “Send for Signature” action area near the sticky preview controls once revocation/resend UX is added.
- Add a lightweight visual empty-state for preview when required core fields are still blank.
