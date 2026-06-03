# Punch List Repeatable Discrepancies Report

## Summary

Punch List documents now support **multiple discrepancies** via `answers.punchItems` JSON stored in `contract_document_versions.input_snapshot.answers`. A dedicated form editor replaces flat single-item questionnaire fields. Preview, PDF, save, and reopen handle all items; legacy flat drafts still render via adapter fallback.

**No database migration.** No changes to RLS, save RPC, routing, or other document renderers.

---

## Files created

| File | Purpose |
|------|---------|
| `src/features/documents/packs/punchList/punchListItemTypes.ts` | `PunchListItemAnswer`, parse/empty/duplicate/legacy helpers |
| `src/features/documents/packs/punchList/punchListItemTypes.test.ts` | Unit tests for parsers |
| `src/features/documents/ui/panels/PunchListItemsEditor.tsx` | Repeatable discrepancy cards + actions |

## Files changed

| File | Change |
|------|--------|
| `src/features/documents/packs/punchList/questions.ts` | Document-level fields only; per-item keys removed |
| `src/features/documents/ui/adapters/punchListPreviewAdapter.ts` | `punchItems` first; legacy fallback; extended item view |
| `src/features/documents/ui/adapters/punchListPreviewAdapter.test.ts` | Multi-item + preference tests |
| `src/features/documents/ui/renderers/PunchListDocument.tsx` | All items as cards; per-item impacts/comments |
| `src/features/documents/ui/pdf/punchListPdf.ts` | Summary table + detail blocks; pagination |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Editor wiring; one-time legacy hydrate |

**Unchanged:** Supabase, `projectDocumentService`, `projectDocumentDisplay`, other renderers/PDFs.

---

## `punchItems` data shape

Stored on `answers.punchItems` as an array:

```json
{
  "punchItems": [
    {
      "id": "uuid",
      "itemNumber": "1",
      "locationArea": "Lobby",
      "description": "Touch-up paint",
      "category": "finishes",
      "trade": "Painting",
      "responsibleParty": "Sub A",
      "priority": "high",
      "status": "open",
      "dueDate": "2026-07-01",
      "correctiveAction": "...",
      "completionDate": "",
      "verifiedBy": "",
      "verificationDate": "",
      "ownerComment": "",
      "contractorResponse": "",
      "costImpact": "",
      "scheduleImpact": "",
      "photoReferences": "",
      "attachmentNotes": ""
    }
  ]
}
```

- `id`: `crypto.randomUUID()` per row (fallback string if unavailable).
- Adapter maps `description` → preview `itemDescription`.

---

## Form behavior

**Component:** `PunchListItemsEditor` (after `IntakePanel` on Punch List packs).

| Feature | Behavior |
|---------|----------|
| Section title | Punch List Items / Discrepancies |
| Add | **+ Add Discrepancy** appends `emptyPunchListItem()` |
| Card header | Item # · Location · Status · Priority |
| Duplicate / Remove / Move up / Move down | Per card |
| Collapse | Accordion toggle per item |

**Mode gating:**

| Mode | Fields per item |
|------|-----------------|
| Quick | itemNumber, locationArea, description, responsibleParty, priority, status, dueDate |
| Standard | + category, trade, correctiveAction, completionDate, verifiedBy, verificationDate |
| Advanced | + ownerComment, contractorResponse, costImpact, scheduleImpact, photoReferences, attachmentNotes |

**Legacy hydrate:** On first open, if `punchItems` is empty but flat legacy keys exist, copies one row into `punchItems` (ref resets on load/new document).

---

## Preview behavior

- `buildPunchListPreviewFromDocumentAnswers` uses `parsePunchListItems(answers.punchItems)` when non-empty.
- Otherwise `buildPrimaryItem` from flat keys (old drafts).
- Each item renders as a card with optional per-item impacts/comments/attachments.
- Document-level Impacts/Comments/Photos sections only when legacy document-level fields exist (not when using `punchItems` only).
- `signatureVerifiedBy`: first item with `verifiedBy`.

---

## PDF behavior

- **Summary table** for all items: #, Location, Description (truncated), Responsible, Priority, Status, Due.
- **Detail blocks** per item when extras exist or ≤2 items (verification, comments, impacts, photos).
- Page breaks via `ensureSpace`; footer on all pages.
- Legacy document-level sections unchanged when populated.

---

## Save / reopen behavior

1. User edits `punchItems` → `setAnswer('punchItems', items)`.
2. Manual **Save draft** → `saveProjectDocumentDraft` → `input_snapshot.answers` includes full array.
3. Reopen loads version snapshot → `restoreBuilderStateFromSnapshot` → editor shows all items.
4. No autosave added.

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **220 passed** (34 files) |
| `npm run build` | **Success** |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing `ScheduleEventFormModal` error only; **no new punch-list file errors** |

---

## Known limitations

- Items are not queryable per row in SQL (JSON only).
- No bulk import, templates, or attachment file uploads.
- Legacy flat keys are not written on new saves (only `punchItems`).
- PDF table uses hand-drawn columns; very long descriptions may wrap to additional pages.
- Question engine still has no native repeater type (custom UI only for punch list).

---

## Manual acceptance checklist

1. Open Punch List builder → add 3 discrepancies with different priorities/statuses.
2. Preview shows all 3 cards.
3. Export PDF → all 3 in summary table.
4. Save draft → leave → reopen → all 3 restore.
5. Edit one item → save → reopen → edit persists.
6. Remove one item → save → reopen → only remaining items.
7. Confirm other document types unchanged.
