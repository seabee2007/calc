# Phase 5D — Daily Report Professional Document Renderer Report

## Summary

Professional Daily Report preview and PDF export are wired into the Contract & Document Builder using Phase 5A shared paper components. Selecting **Daily Report** (`GENERIC_DAILY_REPORT`) shows a white-paper field report layout. Change Order, RFI, Submittal, and Residential Contract previews are unchanged.

---

## Files created

| File | Purpose |
|------|---------|
| `src/features/documents/ui/renderers/DailyReportDocument.tsx` | Daily Report paper renderer (13 sections) |
| `src/features/documents/ui/adapters/dailyReportPreviewAdapter.ts` | Maps answers + project + company → `DailyReportDocumentView` |
| `src/features/documents/ui/pdf/dailyReportPdf.ts` | Draft PDF export via jsPDF |
| `src/features/documents/packs/dailyReport/questions.ts` | Document Builder intake (quick / standard / advanced) |
| `src/features/documents/packs/dailyReport/template.ts` | Minimal template (renderer owns layout) |
| `src/features/documents/packs/dailyReport/clauses.ts` | Empty clause list |
| `src/features/documents/packs/dailyReport/index.ts` | `GENERIC_DAILY_REPORT_PACK` metadata |

## Files changed

| File | Change |
|------|--------|
| `src/features/documents/ui/panels/DocumentPreviewRouter.tsx` | Daily Report branch after Submittal → `DailyReportDocument` |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Pack routing, title sync from `reportDate` + project, PDF export, hide contract title |
| `src/features/documents/packs/registry.ts` | Register `GENERIC_DAILY_REPORT` catalog |
| `src/features/documents/registry/questionnaireRegistry.ts` | Register `daily_report` question bank |
| `src/features/documents/registry/documentTypeRegistry.ts` | `daily_report` runtime-supported type |

---

## Pack metadata

| Field | Value |
|-------|--------|
| `packKey` | `GENERIC_DAILY_REPORT` |
| `label` | Daily Report |
| `documentType` | `daily_report` |
| `status` | `draft_only` |
| `finalExportAllowed` | `true` |
| `templateKey` | `GENERIC_DAILY_REPORT_TEMPLATE` |

---

## Adapter mapping

| Answer key | View field | Notes |
|------------|------------|-------|
| `reportNumber` | `documentNumber` | Fallback `Draft` |
| `reportDate` / `documentDate` | `generatedDate` | Formatted with `date-fns` |
| `status` | `status` | Select labels; default `Draft` |
| `preparedBy` | `preparedBy`, `signaturePreparedBy` | Also in `projectRows` |
| `weatherConditions` | `weatherConditions` | Select labels resolved |
| `temperature`, `rain`, `wind`, `siteConditions` | same | |
| `crewSummary`, `crewMembers`, `trade`, `hoursWorked`, `foremanLead` | same | |
| `equipmentUsed`, `equipmentHours`, `idleEquipment`, `equipmentIssues` | same | |
| `workPerformed`, `workAreas`, `quantitiesInstalled` | same | |
| `deliveries`, `deliveryTicketNumbers`, `supplier`, `materialsAcceptedRejected` | same | |
| `delays`, `delayCause`, `responsibleParty`, `scheduleImpact` | same | |
| `visitors`, `inspectors`, `ownerArchitectEngineerVisits` | same | |
| `safetyNotes`, `safetyMeetingHeld`, `incidentsNearMisses`, `ppeIssues`, `correctiveActions` | same | |
| `qcNotes`, `inspectionsPerformed`, `deficiencies`, `testsPerformed`, `followUpRequired` | same | |
| `photos`, `attachmentNotes` | same | |
| `reviewedBy` | `signatureReviewedBy` | |
| `signatureDate` | `signatureDate` | |

**Title:** `title` state, or `Daily Report — {reportDate} — {projectName}`, or `Daily Report`.

**Project / company (fallback only):**

- Project name, address, owner/client from `selectedProject`
- Contractor from `companySettings.companyName`
- Company header: logo, address, phone, email, license

All strings through `cleanDocumentBody` + `displayValue()` → `—` for empty values.

---

## Preview router change

```typescript
const isDailyReport = documentType === 'daily_report' || packKey === 'GENERIC_DAILY_REPORT';

// Order: CO → RFI → Submittal → Daily Report → Residential → PreviewPanel
if (dailyReportPreview) {
  return (
    <PaperPreviewShell>
      <DailyReportDocument view={dailyReportPreview} />
    </PaperPreviewShell>
  );
}
```

---

## PDF export routing

`DocumentBuilderPage.handleExport`:

- `change_order` → `generateChangeOrderPDF` (unchanged)
- `rfi` → `generateRfiPDF` (unchanged)
- `submittal` → `generateSubmittalPDF` (unchanged)
- `daily_report` → `buildDailyReportPreviewFromDocumentAnswers` + `generateDailyReportPDF`
- else → `exportContractDraftPdf` (residential, unchanged)

Filename: `DAILY-REPORT-{reportNumber or generatedDate}.pdf`

---

## Title sync (Document Builder)

For `daily_report`, contract title input is hidden. Internal `title` updates from:

- `reportDate` + `selectedProject.name` → `Daily Report — {date} — {project}`
- `reportDate` only → `Daily Report — {date}`
- project only → `Daily Report — {project}`
- else → `Daily Report`

---

## How to test in Document Builder

1. Open Contract & Document Builder
2. Select pack **Daily Report**
3. Choose a project
4. Quick mode: report date, prepared by, weather, crew summary, work performed
5. Standard/advanced: equipment, deliveries, delays, safety, QC, etc.
6. Confirm live paper preview (readable in light and dark app theme)
7. **Draft PDF** exports daily report layout

**Regression:** CO, RFI, Submittal, and Residential packs unchanged; single **Daily Report** dropdown entry.

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 28 files, 203 tests |
| `npm run build` | **Pass** |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing repo drift; **no errors in Phase 5D files** |

---

## Known limitations

1. **Empty template/clauses** — Preview is entirely from `DailyReportDocument`, not generic clause assembly.
2. **Draft-only pack** — No attorney-reviewed export path.
3. **Saved version preview** — Historical versions still use `PreviewPanel`.
4. **Signatures** — Read-only blocks; no canvas capture in builder.
5. **Photos / attachments** — Text references only; no image thumbnails in preview/PDF.
6. **Compliance profile** — Uses default residential fallback until a dedicated `daily_report` profile is added (optional).
7. **Planner daily logs** — Not integrated; builder uses questionnaire `answers` + selected project only.

---

## Out of scope (unchanged)

- Supabase schema / RLS / auth
- Pricing math
- Change Order / RFI / Submittal / Residential renderer behavior
- Document engine core assembly logic
- Planner routes
- Repo-wide TypeScript debt cleanup
