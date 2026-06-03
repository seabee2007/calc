import { filterDocumentsTabBuilderDocuments } from './projectDocumentDisplay';
import type { ProjectDocumentRow } from './projectDocumentService';

/** Total records for the top-level Documents tab (matches Documents page category sums). */
export function countProjectDocumentsNavTotal(
  builderDocs: ProjectDocumentRow[],
  safetyMeetingCount: number,
  inspectionCount: number,
): number {
  const grouped = filterDocumentsTabBuilderDocuments(builderDocs);
  return (
    grouped.contracts.length +
    grouped.submittals.length +
    grouped.dailyReports.length +
    grouped.qcReports.length +
    grouped.punchLists.length +
    grouped.closeout.length +
    grouped.other.length +
    safetyMeetingCount +
    inspectionCount
  );
}
